import { FunctionComponent, createContext, isValidElement, ComponentChildren } from "preact";
import { useState, useContext, useMemo, useEffect } from "preact/hooks"
import { Children } from "preact/compat"

export type Navigator = { 
    go: (change: string | null) => void,
    back: () => { newId: string | null, hasNext: boolean },
    hasNext: () => boolean,
    initilized: Promise<Navigator>
}
interface PaginationContextObject {
    currentId: string | null;
    navigator: Navigator;
    history: string[];

    initilize(index: SwitchObject | null): void;
}

interface SwitchObject {
    element: ComponentChildren;
    id: string;
    index: boolean;
    title: string;
}

const PaginationContext = createContext<PaginationContextObject>(null!);

export function useNavigation(): (change: string | null) => void {
    return useContext(PaginationContext).navigator.go;
}

export function useNavigator(): Navigator | null {
    return useContext(PaginationContext).navigator;
}

export const Case: FunctionComponent<{ id: string, title: string, index?: boolean }> = ({ children }) => {
    throw Error()
}

export const Navigation: FunctionComponent = ({ children }) => {
    const [currentId, setId] = useState<string | null>(null!);
    const [index, setIndex] = useState<SwitchObject | null>(null!);
    const [initilized, setInitialized] = useState(false);
    
    const initilizedObject = useMemo(() => {
        const returnObject = {
            promise: null!,
            resolve: null!
        } as any;

        returnObject.promise = new Promise<Navigator>(resolve => {
            returnObject.resolve = resolve;
        })

        return returnObject;
    }, [])

    const pagination: PaginationContextObject = {
        currentId,
        navigator: { 
            go(newId) {
                pagination.history.push(currentId!);
                setId(newId);
            },
            back() {
                let newId = pagination.history.pop() ?? null;
                let hasNext = true;
                if (pagination.history.length === 0 && newId === index?.id) {
                    hasNext = false;
                }
                if (newId === null) {
                    console.assert(pagination.history.length === 0);
                    newId = index?.id ?? null;
                }
    
                setId(newId);
                return { newId, hasNext }
            },
            hasNext() {
                const history = pagination.history;
                return !(history.length <= 1 && history[history.length-1] === index?.id)
            },
            initilized: initilizedObject.promise
        },
        history: [],
        initilize(index) {
            if (!initilized) {
                setInitialized(true);
                setIndex(index);
                setId(index?.id ?? null);
                initilizedObject.resolve(pagination.navigator);
            }
        },
    };

    return <PaginationContext.Provider value={pagination} children={children}/>
};

export const Switch: FunctionComponent = ({
    children
}) => {
    const cases = createCasesFromChildren(children);
    const index = cases.find(_case => _case.index) ?? null
    
    const pagination = useContext(PaginationContext);
    pagination.initilize(index);

    useEffect(() => {
        const _case = cases.find(_case => _case.id === pagination.currentId);
        document.title = _case?.title ?? "";
    }, [pagination.currentId])

    return (
        <>
            { cases.filter(_case => _case.id === pagination.currentId)
        .map(_case => _case.element) }
        </>
    )
}

function createCasesFromChildren(
    children: ComponentChildren
): SwitchObject[] {
    const cases: SwitchObject[] = [];

    Children.forEach(children, element => {
        if (!isValidElement(element)) {
            return;
        }

        if (element.type !== Case) {
            return;
        }
        const props = element.props as any;

        cases.push({
            element: element.props.children,
            id: props.id as string,
            index: (props.index as boolean | undefined) ?? false,
            title: props.title as string
        })
    })

    return cases;
}
