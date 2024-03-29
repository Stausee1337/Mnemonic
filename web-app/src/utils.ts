import { StateUpdater, useState, useRef, useEffect, useCallback } from "preact/hooks";


export function classNames(input: { [key: string]: boolean }): string;
export function classNames(input: string[]): string;
export function classNames(input: any): any {
    if (Array.isArray(input)) {
        return input.join(' ');
    } else {
        return classNames(
            Object.entries(input).filter(([_, value]) => value).map(([name, _]) => name)
        )
    }
}

export function random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
}

const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
export function makeId(len: number = 4): string {
    const result: string[] = [];
    for (let i = 0; i < len; i++) {
        result.push(characters.at(random(0, characters.length))!)
    }
    return result.join('')
}

export function useValidationState<S>(
    initialState: S | (() => S),
    onSetCallback: (value: S) => S
): [S, StateUpdater<S>] {
    const [state, stateSetter] = useState<S>(initialState);
    const stateSetterWrapper: StateUpdater<S> = (value) => {
        if (typeof value === 'function') {
            value = <S>(<any>value)(state)
        }
        stateSetter(onSetCallback(value));
    };
    return [state, stateSetterWrapper];
}

export function useForceUpdate(): () => void {
    const [value, setter] = useState(0);

    return () => setter(value + 1);
}

export function useMounted(): () => boolean {
    const mounted = useRef(true);
    const isMounted = useRef(() => mounted.current);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        }
    }, [])
    return isMounted.current;
}

export function useSafeState<S>(
    initialState: S | (() => S)
): [S, StateUpdater<S>] {
    const isMounted = useMounted();
    const state = useState<S>(initialState);
    return [
        state[0],
        useCallback(
            (nextState) => {
                if (!isMounted()) return;
                return state[1](nextState);
            },
            [isMounted, state[1]]
        )
    ]
}

export function nullOrUndefined(value: any): boolean {
    return value === undefined || value === null;
}

export function hasString(value: string): number {
    let hash = 0;
    if (value.length === 0) 
        return hash;
    
    for (let i = 0; i < value.length; i++) {
        const c   = value.charCodeAt(i);
        hash = (((hash << 5) - hash) + c) | 0;
    }
    return hash;
}

export function resolveTypes(value: any): any {
    if (value === null || value === undefined) {
        return `${value}`;
    }
    if (Array.isArray(value)) {
        return value.map(v => resolveTypes(v));
    }
    if (typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, value]) => [key, resolveTypes(value)])
        );
    }
    return typeof value;
}