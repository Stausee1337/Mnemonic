import { FunctionComponent, JSX } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { createPortal, forwardRef } from "preact/compat"
import { Overlay } from "@restart/ui"
import { UsePopperState } from "@restart/ui/usePopper"
import mergeOptionsWithPopperConfig from "@restart/ui/mergeOptionsWithPopperConfig"
import _default from "@popperjs/core/lib/modifiers/popperOffsets";
import { classNames, makeId, nullOrUndefined, useForceUpdate, useSafeState } from "./utils";
import styles from "./controls.module.scss";
import { Icon } from "./icons";
import { Rust } from "./interface";
import { useEventProvider } from "./window";
import { Direction, RouteChanged, RouteEvent, RouterInit, useRouter } from "./router";
import { Action, Location, MemoryHistory, Update } from "history";
import { filter } from "rxjs";
import { dequal } from "dequal";
import usePopper from "@restart/ui/cjs/usePopper";


export const Button: FunctionComponent<{ onClick?: JSX.MouseEventHandler<EventTarget> }> = (props) => 
    <button class={styles.button} onClick={props.onClick}>{props.children}</button>;

export const ToggleSwitch: FunctionComponent<{
    onChanged?: (checked: boolean) => void,
    checked?: boolean,
    disabled?: boolean
}> = ({
    checked,
    onChanged,
    disabled
}) => {
    let id = useMemo(() => makeId(), []);
    disabled = disabled ?? false

    return (
        <label class={styles.toggle} for={id} disabled={disabled}>
            { checked ? 'On' : 'Off' }
            <input type="checkbox" disabled={disabled} id={id} onChange={e => onChanged ? onChanged(e.currentTarget.checked) : undefined} checked={checked} />
            <span class={styles.switch}/>
        </label>
    )
}

type MouseEventListener = (event: MouseEvent) => void;
interface MemoDocument {
    onMouseup: MouseEventListener | null;
    onMousemove: MouseEventListener | null;

    executeEvent(id: string, e: MouseEvent): void;
}

export const Slider: FunctionComponent<{
    min: number,
    max: number,
    onChange?: (value: number) => void,
    value?: number
}> = ({ value, min, max, onChange }) => {
    const range = max - min;
    const [currentValue, setValue] = useState(value ?? (range / 2) + min);
    const [diffX, setDiffX] = useState(0);
    const [active, setActive] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null!);

    const sliderWidth = 234;
    const memoDocument = useMemo<MemoDocument>(() => {
        const rv: MemoDocument = {
            onMouseup: null,
            onMousemove: null,

            executeEvent(id, e) {
                switch (id) {
                    case 'mouseup':
                        rv.onMouseup ? rv.onMouseup(e) : undefined
                        break;
                    case 'mousemove':
                        rv.onMousemove ? rv.onMousemove(e) : undefined
                        break;
                }
            }
        };
        return rv;
    }, [])

    useEffect(() => {
        document.addEventListener('mousemove', (e) => memoDocument.executeEvent('mousemove', e));
        document.addEventListener('mouseup', (e) => memoDocument.executeEvent('mouseup', e));
    }, []);

    useEffect(() => {
        onChange ? onChange(Math.round(currentValue)) : undefined
    }, [currentValue])

    memoDocument.onMousemove = (e) => {
        if (!active) return;
        const ratio = ((e.clientX - diffX) / sliderWidth);
        const newValue = Math.round((ratio * range) + min);
        if (newValue >= min && newValue <= max) {
            setValue(newValue);
        } else {
            setValue(Math.min(Math.max(newValue, min), max));
        }
    };

    memoDocument.onMouseup = (e) => {
        if (active) setActive(false);
    }

    const handleMouseDown = () => {
        if (sliderRef.current) {
            setDiffX(sliderRef.current.getBoundingClientRect().left);
            setActive(true);
        }
    }

    const sliderMouseDown = (e: JSX.TargetedMouseEvent<HTMLSpanElement>) => {
        const left = e.currentTarget.getBoundingClientRect().left;
        const ratio = ((e.clientX - left - 7) / sliderWidth);
        const newValue = Math.round((ratio * range) + min);
        if (newValue >= min && newValue <= max) {
            setValue(newValue);
        } else {
            setValue(Math.max(Math.min(min, newValue), max));
        }
        setActive(true);
    }

    const ratio = (currentValue - min) / range;
    const props = { active: active ? '' : null };
    return (
        <label class={styles.slider}>
            { currentValue }
            <div class={styles['slider-container']} onMouseDown={sliderMouseDown} {...props}>
                <div ref={sliderRef} class={styles['track']}>
                    <div class={styles['track-background']}/>
                    <div class={styles['track-fill']} style={{ transform: `scaleX(${ratio})` }}/>
                </div>
                <span onMouseDown={handleMouseDown} style={{ left: `${sliderWidth * ratio}px` }} class={styles.handle}/>
            </div>
        </label>
    )
}

const Tooltip = forwardRef(
    ({ children, popper, show: _default, ...props }: any, ref: any) => (
        <div ref={ref} {...props}>
            <div class={styles.tooltip} >{ children }</div>
        </div>
    )
);

export const TooltipButton: FunctionComponent<{ 
    tooltip: string,
    onClick?: JSX.MouseEventHandler<HTMLElement>
}> = ({ children, tooltip, onClick }) => {
    const ref = useRef<HTMLButtonElement>(null);
    const popperRef = useRef<UsePopperState>();
    const [show, setShow] = useState(false);

    return (
        <>
            <button 
                onClick={onClick}
                ref={ref} 
                class={styles['tooltip-button']} 
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                children={children}
            />
            <Overlay
                show={show}
                target={ref}
                placement="left"
                offset={[0, 8]}
                containerPadding={10}
            >
                {(props, {popper}) => {
                    if (popper) popperRef.current = popper;

                    return (<Tooltip
                        {...(props as any)}
                        popper={popper}
                    >
                        { tooltip }
                    </Tooltip>) as any;
                }}
            </Overlay>
        </>
    );
}

export const Checkbox: FunctionComponent<{
    onChanged?: (checked: boolean) => void,
    checked?: boolean,
    disabled?: boolean
}> = ({
    checked,
    children,
    onChanged,
    disabled
}) => {
    let id = useMemo(() => makeId(), []);
    disabled = disabled ?? false

    return (
        <label class={styles.checkbox} for={id} disabled={disabled}>
            { children }
            <input type="checkbox" disabled={disabled} id={id} onChange={e => onChanged ? onChanged(e.currentTarget.checked) : undefined} checked={checked} />
            <span class={styles.check}/>
        </label>
    ) 
}

export const Title: FunctionComponent<{ children: string }> = ({ children }) => {
    document.title = children;
    return null;
}

export const TitleBar: FunctionComponent = () => {
    const [active, setActive] = useState(true);
    const [title, setTitle] = useState("");
    const [buttonDisabled, setDisabled] = useState(true);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [backButton, setBackButton] = useState<HTMLButtonElement | null>(null!);
    const historyContainerRef = useRef<HTMLSpanElement>(null);
    const timeoutRef = useRef<number>(null!);
    const historyOpenRef = useRef<{ historyOpen: boolean, setHistoryOpen: (v: boolean) => void }>(null!);
    historyOpenRef.current = { historyOpen, setHistoryOpen };
    const router = useRouter()!;
    const eventProvider = useEventProvider();

    const popper = usePopper(
        backButton,
        historyContainerRef.current,
        {
            placement: "bottom",
            modifiers: [
                { name: "offset", options: { offset: [1, 3] } }
            ]
        }
    )

    useEffect(() => {
        const listener = (e: MouseEvent) => {
            if (!historyOpenRef.current.historyOpen) {
                return;
            }
            if (!e.composedPath().includes(historyContainerRef.current!)) {
                historyOpenRef.current.setHistoryOpen(false);
            }
        }
        document.addEventListener("mousedown", listener);
        return () => {
            document.addEventListener("mousedown", listener);
        }
    }, [])
    
    useLayoutEffect(() => {
        if (historyOpen) {
            popper.update();
        }
    }, [historyOpen])

    eventProvider.on<{ active: boolean }>("stateChanged", ({ active }) => {
        setActive(active);
    })

    eventProvider.on<string>("titleChanged", newTitle => {
        setTitle(newTitle);
        Rust.windowSetTitle(newTitle);
    });

    eventProvider.on<RouterInit>("init", e => {
        e.data.then(data => {
            document.title = data.title ?? ""
        })
    });

    eventProvider.on<RouteChanged>("routeChanged", e => {
        e.data.then(data => {
            document.title = data.title ?? "";
        })
        const history = router.history as MemoryHistory;
        setDisabled(history.index <= 0);
    });

    const mouseDown = (event: JSX.TargetedMouseEvent<HTMLDivElement>) => {
        if ((event.target! as HTMLElement).hasAttribute('drag-region')) {
            if (event.button === 0) {
                Rust.windowDragMove();
            } else if (event.button === 2) {
                Rust.windowShowSysMenu(event.screenX, event.screenY);
            }
        }

    }

    const buttonMouseLeave = (e: JSX.TargetedMouseEvent<HTMLElement>) => {
        clearTimeout(timeoutRef.current);
    }

    const minimize = () => {
        Rust.windowMinimize();
    }

    return (
        <div onMouseDown={mouseDown} class={classNames({
            [styles['title-bar']]: true,
            [styles['window-active']]: active,
            [styles['window-inactive']]: !active
        })} drag-region>
            <span class={styles.menu}>
                <button 
                    ref={setBackButton}
                    class={styles['menu-back']} 
                    disabled={buttonDisabled}
                    onClick={() => !historyOpen ? router.history.back() : undefined}
                    onMouseDown={() => timeoutRef.current = setTimeout(() => setHistoryOpen(true), 500)}
                    onMouseUp={buttonMouseLeave}>
                    <Icon name="arrow-back"/>
                </button>
            </span>
            <div class={styles.title}>{ title }</div>
            <div class={styles['window-controls']}>
                <div onClick={minimize}><Icon name="minimize"/></div>
                <div onClick={() => Rust.windowClose()} style={{ '--hover-bg-color': '#c42a1c', '--hover-ic-color': 'white' }}>
                    <Icon name="close"/>
                </div>
            </div>
            { createPortal(
                <span 
                    {...popper.attributes.popper}
                    style={{ ...popper.styles['popper'] } as any}
                    ref={historyContainerRef} 
                    class={classNames({ 
                        [styles.history]: true, 
                        [styles.hidden]: !historyOpen
                    })}
                    onClick={() => popper.forceUpdate()}
                    children={<History close={() => setHistoryOpen(false)}/>}/>,
                document.body
            ) }
        </div>
    );
}

export const History: FunctionComponent<{ close: () => void }> = ({ close }) => {
    const router = useRouter()!;
    const [history, setHistory] = useState<string[]>([]);

    useEffect(() => {
        const pushHistory = (promise: Promise<{ [key: string]: any }>) => promise.then(data => {
            history.push(data.heading ?? '');
            setHistory([...history])
        })

        router.events.pipe(
            filter((e: RouteEvent): e is RouterInit => e instanceof RouterInit)
        ).subscribe({
            next(e) {
                pushHistory(e.data);
            }
        })

        router.events.pipe(
            filter((e: RouteEvent): e is RouteChanged => e instanceof RouteChanged)
        ).subscribe({
            next(e) {
                if (e.action === Action.Push) {
                    pushHistory(e.data);
                } else if (e.action === Action.Pop) {
                    const newLength = (router.history as MemoryHistory).index + 1;
                    const diff = history.length - newLength;
                    history.splice(-diff, diff)
                    setHistory([ ...history ])
                }
            }
        })
    }, [])

    // clickHandlerFactory
    const chf = (index: number) => () => {
        if (index > 0) {
            router.history.go(-index);
        }
        close();
    }

    return (
        <>
            { [...history].reverse().map((heading, idx) => 
                <span class={styles.item} children={heading} onClick={chf(idx)}/>) }
        </>
    )
}

export const ContainerItem: FunctionComponent<{
    label: string
}> = ({ label, children }) => (
    <div class={styles['container-item']}>
        <span children={label}/>
        { children }
    </div>
);

export const ContainerBox: FunctionComponent<{ class?: string }> = ({ class: className, children }) => 
    <div class={`${styles['contanier-box']} ${className}`} children={children}/>

export const ExpansionContainer: FunctionComponent<{
    heading: string,
    expanded?: boolean,
    buttons?: { icon: string, onClick: () => void }[]
}> = ({ heading, expanded, buttons, children }) => {
    const [show, setShow] = useState(expanded ?? false);
    const [container, setContainer] = useSafeState<HTMLDivElement | null>(null!);

    useEffect(() => {
        if (show) {
            container?.animate([
                { height: '51px' },
                { height: `${container.offsetHeight}px` }
            ], {
                duration: 200,
                easing: 'ease-in-out'
            }).finished.then(() => {
                container.style.height = `${container.offsetHeight}px`;
            })
        } else {
            container?.animate([
                { height: `${container.offsetHeight}px` },
                { height: '51px' }
            ], {
                duration: 200,
                easing: 'ease-in-out'
            }).finished.then(() => {
                container.style.height = null as any;
            });
        }
    }, [show])

    const ensureHeight = () => {
        if (nullOrUndefined(container?.style.height)) {
            console.error("Get container failed");
            return;
        }
        if (show && container!.style.height === "") {
            container!.style.height = `${container!.offsetHeight}px`;
        }
    }
    
    const props = { 
        expanded: show ? '' : null,
        collapsed: !show ? '' : null
    }


    // generateActionButtonHandler
    const gabh = (handler: () => void) => (e: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        handler();
    }
    return (
        <div ref={setContainer} class={styles['expansion-container']} { ...props }>
            <button onClick={() => {ensureHeight(); setShow(!show)}} class={styles['expansion-button']}>
                <span children={heading}/>
                <div class={styles.expand}/>
                <div class={styles.buttons}>
                    {
                        (buttons ?? []).map(def => (
                        <button onClick={gabh(def.onClick)} class={styles['action-button']}>
                            <span class={styles.background}/>
                            <Icon name={def.icon}/>
                        </button>
                        ))
                    }
                </div>
            </button>
            { show ? children : null }
        </div>
    );
}

export const ExpansionGroup: FunctionComponent = ({ children }) => 
    <div class={styles['expension-group']} children={children}/>


export const Breadcrumb: FunctionComponent = () => {
    const router = useRouter()!;
    const [path, setPath] = useState<string[]>([]);
    const [headingMap, setHeadingMap] = useState<{ [key: string]: any }>({});
    const setPathRef = useRef<(defs: string[]) => void>(null!);
    setPathRef.current = setPath;

    useEffect(() => {
        const addEntry = async (
            location: Location,
            promise: Promise<{ [key: string]: any }>
        ) => {
            return promise.then(data => {
                const path = location.pathname.split('/');
                headingMap[path[path.length - 1]] = data.heading ?? '';
                setHeadingMap({ ...headingMap });
            });
        }

        router.events.pipe(
            filter((e: RouteEvent): e is RouterInit => e instanceof RouterInit)
        ).subscribe({
            async next(e) {
                await addEntry(e.location, e.data);
                setPathRef.current(e.location.pathname.split('/'));
            }
        })

        router.events.pipe(
            filter((e: RouteEvent): e is RouteChanged => e instanceof RouteChanged)
        ).subscribe({
            async next(e) {
                await addEntry(e.location, e.data);
                setPathRef.current(e.location.pathname.split('/'));
            }
        })
    
        
    }, [])

    const isVisible = () => {
        if (path.length === 0) {
            return false;
        }
        return !dequal(path, ['', '']);
    };

    if (isVisible()) {
        document.body.setAttribute('breadcrumb-active', '');
    } else {
        document.body.removeAttribute('breadcrumb-active');
    }


    // generatePathRouter
    const gpr = (path: string[]) => () => {
        let link = path.join('/');
        if (link === '') link = '/';
        if (link !== router.location.pathname) {
            router.history.push(link, { direction: Direction.BACK });
        }
    }
    return (
        <h3 class={classNames({
            [styles.breadcrumb]: true,
            [styles.hidden]: !isVisible()
        })}>
            { path.map((spath, idx) => 
                <span onClick={gpr(path.slice(0, idx+1))} children={headingMap[spath]}/>
             ) }
        </h3>
    )
}

export const CustomScrollbar: FunctionComponent<{
    referenceElement: HTMLElement | null
}> = ({referenceElement}) => {
    const [visible, setVisible] = useState(false);
    const [scrollY, setScrollY] = useState(0);
    const [pageRatio, setRatio] = useState(0);
    const [scrollbarElement, setScrollbar] = useState<HTMLSpanElement | null>(null!);
    const recalculateRef = useRef<() => void>(null!);
    const onScrollRef = useRef<() => void>(null!);
    recalculateRef.current = () => {
        if (nullOrUndefined(referenceElement)) {
            setVisible(false);
            return;
        }
        if (referenceElement!.scrollHeight > referenceElement!.offsetHeight) {
            setRatio(referenceElement!.offsetHeight / referenceElement!.scrollHeight)
            setVisible(true);
        } else {
            setVisible(false);
        }
    }; 
    onScrollRef.current = () => {
        if (nullOrUndefined(referenceElement)) {
            return;
        }
        setScrollY(referenceElement!.scrollTop);
    }

    useEffect(() => {
        if (nullOrUndefined(referenceElement)) {
            return;
        }
        let ready = false;
        const observer = new ResizeObserver(() => {
            if (!ready) return;
            recalculateRef.current();
        });

        observer.observe(referenceElement!);
        observer.observe(referenceElement!.lastElementChild!);

        window.requestAnimationFrame(() => {
            ready = true;
        })

        const listener = () => onScrollRef.current();
        referenceElement!.addEventListener('scroll', listener);

        return () => {
            observer.disconnect();
            referenceElement!.removeEventListener('scroll', listener);
        }
    }, [referenceElement])

    const sliderHeight = pageRatio * (scrollbarElement?.offsetHeight ?? 0) - 20;
    return (
        <div
            ref={setScrollbar} 
            class={classNames({
                [styles.scrollbar]: true,
                [styles.hidden]: !visible
            })}>
            <span 
                style={{
                    height: `${sliderHeight}px`,
                    transform: `translateY(${scrollY * pageRatio}px)`
                }}
                class={styles.slider}/>
        </div>
    )
}
