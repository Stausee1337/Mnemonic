import { FunctionComponent, createContext, isValidElement, ComponentChildren } from "preact";
import { useState, useContext, useMemo } from "preact/hooks"
import { Children } from "preact/compat"

type Navigator = { go: (change: string | null) => void }
export interface PaginationContextObject {
    currentId: string | null,
    navigator: Navigator;
}

interface SwitchObject {
    element: ComponentChildren;
    id: string;
    index: boolean
}

const PaginationContext = createContext<PaginationContextObject>(null!);

export function useNavigation(): (change: string | null) => void {
    return useContext(PaginationContext).navigator.go;
}


export const Case: FunctionComponent<{ id: string, index?: boolean }> = ({ children }) => {
    throw Error()
}

export const Switch: FunctionComponent = ({
    children
}) => {
    const cases = createCasesFromChildren(children);
    const index = cases.find(_case => _case.index) ?? null
    
    const [currentId, setId] = useState(index?.id ?? null);


    const navigatorGo = useMemo(() => {
        return (newId: string | null) => setId(newId);
    }, []);

    const pagination: PaginationContextObject = {
        currentId,
        navigator: { go: navigatorGo }
    };

    return (
        <PaginationContext.Provider value={pagination}>
            { cases.filter(_case => _case.id === currentId)
                .map(_case => _case.element) }
        </PaginationContext.Provider>
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
        })
    })

    return cases;
}
