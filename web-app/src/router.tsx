import { Component, createContext, createRef, Fragment, FunctionComponent, VNode } from "preact";
import { useContext, useEffect, useMemo, useRef } from "preact/hooks";
import { Location, History, createMemoryHistory, Update, Action  } from "history";
import { classNames, nullOrUndefined } from "./utils";
import { BehaviorSubject, filter, Observable, Subject } from "rxjs";
import styles from "./router.module.scss";

export abstract class RouteEvent {}

export class RouterInit extends RouteEvent {
    data: Promise<{ [key: string]: any }>;
    private resolve: (data: { [key: string]: any }) => void = null!;

    constructor (
        public location: Location,
    ) {
        super();
        this.data = new Promise(resolve => {
            this.resolve = resolve;
        })
    }

    initWithData(data: { [key: string]: any }) {
        this.resolve(data);
    }
}

export class RouteChanged extends RouteEvent {
    data: Promise<{ [key: string]: any }>;
    private resolve: (data: { [key: string]: any }) => void = null!;

    constructor(
        public action: Action,
        public location: Location
    ) {
        super();
        this.data = new Promise(resolve => {
            this.resolve = resolve;
        })
    }

    initWithData(data: { [key: string]: any }) {
        this.resolve(data);
    }
}

export class NavigationFinished extends RouteEvent {};

export class Router {
    public location: Location;
    public events: Observable<RouteEvent>;
    
    constructor(
        public history: History
    ) {
        this.events = new BehaviorSubject<RouteEvent>(new RouterInit(history.location));
        this.location = history.location;
        const events = this.events as Subject<RouteEvent>;
        history.listen(update => {
            events.next(new RouteChanged(
                update.action,
                update.location
            ));
        });
    }
}

class Container extends Component<{}, { children: VNode[] }> {

    constructor() {
        super();
        this.attachElement = this.attachElement.bind(this);
        this.detachElementAt = this.detachElementAt.bind(this);
        this.state = { children: [] };
    }

    attachElement(element: VNode, index?: number) {
        if (index === undefined) {
            this.setState({
                children: [
                    ...this.state.children,
                    element,
                ]
            })
        } else {
            this.state.children.splice(index, 0, element);
            this.setState({
                children: [ ...this.state.children ]
            })
        }
    }

    detachElementAt(index: number) {
        if (index < this.state.children.length) {
            this.state.children.splice(index, 1);
            this.setState({
                children: [...this.state.children]
            })
        }
    }

    isEmpty(): boolean {
        return this.state.children.length === 0;
    }

    render(): any {     
        return <>{ this.state.children }</>
    }
}

enum Direction { BACK, FORTH }

class RoutingAnimation extends Component<
{ children: VNode, onAnimaionEnd?: (direction: Direction) => void },
{ animating: boolean, direction: Direction | null }> {
    containerRef = createRef<Container>();

    constructor(props: any) {
        super(props);
        this.compileProps = this.compileProps.bind(this);
        this.animateTo = this.animateTo.bind(this);
        this.animationEnd = this.animationEnd.bind(this);
        this.state = { animating: false, direction: null }
    }

    componentDidMount() {
        if (nullOrUndefined(this.containerRef.current)) {
            console.warn("container not found");
            return;
        }
        this.containerRef.current!.attachElement(this.props.children);
    }

    compileProps(): { [key: string]: any } {
        console.assert(this.state.animating, "Animation should be active");
        console.assert(!nullOrUndefined(this.state.direction), "Direction should be set");

        const classString = classNames({
            [styles['router-animation']]: true,
            [styles['animating']]: true,
            [styles['backward']]: this.state.direction === Direction.BACK,
            [styles['foreward']]: this.state.direction === Direction.FORTH,
        });

        return {
            class: classString
        }
    }

    animateTo(direction: Direction, element: VNode, className?: string) {
        switch (direction) {
            case Direction.BACK:
                this.containerRef.current!.attachElement((<div id="container" class={className} children={element}/>), 0);
                this.setState({ animating: true, direction: direction });
                break;
            case Direction.FORTH:
                this.containerRef.current!.attachElement((<div id="container" class={className} children={element}/>));
                this.setState({ animating: true, direction: direction });
                break;
        };
        setTimeout(() => {
            this.animationEnd();
        }, 300)
    }

    animationEnd() {
        switch (this.state.direction) {
            case Direction.FORTH:
                this.containerRef.current!.detachElementAt(0);
                break;
            case Direction.BACK:
                this.containerRef.current!.detachElementAt(1);
                break;
        }
        if (!nullOrUndefined(this.props.onAnimaionEnd)) {
            this.props.onAnimaionEnd!(this.state.direction!);
        }
        this.setState({ animating: false, direction: null });
    }

    render(): any {
        const props = this.state.animating ? this.compileProps() : {class: styles['router-animation']};
        return (
            <div {...props}>
                <Container ref={this.containerRef}/>
            </div>
        )
    }
}

const RouterContext = createContext<Router>(null!);

export const RouterProvider: FunctionComponent = ({ children }) => {
    const router = useMemo<Router>(() => {
        const history = createMemoryHistory();
        return new Router(history);
    }, []);

    return <RouterContext.Provider value={router} children={children}/>
}

export function useRouter(): Router | null {
    return useContext(RouterContext);
}

type NavigationFunction = (path: string) => { element: VNode, data?: { [key: string]: any } };

export const RouterOutlet: FunctionComponent<{
    children: NavigationFunction
}> = ({ children }) => {
    const router = useContext(RouterContext);
    const animation = useRef<RoutingAnimation>(null);

    useEffect(() => {
        router.events.pipe(
            filter((e: RouteEvent): e is RouteChanged => e instanceof RouteChanged)
        ).subscribe({
            next(e) {
                if (!nullOrUndefined(animation.current)) {
                    const result = children(e.location.pathname);
                    const data = result.data ?? {};
                    if (e.action === Action.Pop) {
                        animation.current!.animateTo(Direction.BACK, result.element, data.class);
                    } else if (e.action === Action.Push) {
                        animation.current!.animateTo(Direction.FORTH, result.element, data.class);
                    }
                    e.initWithData(data);
                }
            }
        })
    }, []);

    const [route, data] = useMemo<[VNode, any]>(() => {
        const config = children(router.location.pathname);
        router.events.pipe(
            filter((e: RouteEvent): e is RouterInit => e instanceof RouterInit)
        ).subscribe({
            next(e) {
                e.initWithData(config.data ?? {});
            }
        })
        return [config.element, config.data ?? {}];
    }, [])

    const naviationFinished = () => {
        const events = router.events as Subject<RouteEvent>;
        events.next(new NavigationFinished());
    }

    return (
        <RoutingAnimation ref={animation} onAnimaionEnd={naviationFinished}>
            { <div id="container" class={data.class} children={route}/> }
        </RoutingAnimation>
    )
}
