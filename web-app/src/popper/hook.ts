import * as Popper from "@popperjs/core"
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks"
import { createPopper } from "./popper"


export interface UsePopperState {
    placement: Popper.Placement;
    update: () => void;
    forceUpdate: () => void;
    attributes: Record<string, Record<string, any>>;
    styles: Record<string, Partial<CSSStyleDeclaration>>;
    state?: Popper.State;
  }

export function usePopper(
    referenceElement: Popper.VirtualElement | null,
    popperElement: HTMLElement | null,
    placement: Popper.Placement = 'bottom',
    arrowElement: Element | null,
    offset: [number, number] | null | undefined
): UsePopperState {
    const popperInstanceRef = useRef<Popper.Instance>();

    const update = useCallback(() => {
        popperInstanceRef.current?.update();
    }, []);
    
    const forceUpdate = useCallback(() => {
        popperInstanceRef.current?.forceUpdate();
    }, []);

    const [popperState, setState] = useState<UsePopperState>({
        placement,
        update,
        forceUpdate,
        attributes: {},
        styles: {
            popper: {},
            arrow: {},
        },
    });

    const updateModifier = useMemo<Popper.Modifier<'updateStateModifier', any>>(() => ({
        name: 'updateStateModifier',
        enabled: true,
        phase: 'write',
        requires: ['computeStyles'],
        fn: ({ state }) => {
            const styles: UsePopperState['styles'] = {};
            const attributes: UsePopperState['attributes'] = {};

            Object.keys(state.elements).forEach((element) => {
                styles[element] = state.styles[element];
                attributes[element] = state.attributes[element];
            });

            setState({
                state,
                styles,
                attributes,
                update,
                forceUpdate,
                placement: state.placement,
            });
        },
    }), [update, forceUpdate, setState]);

    const arrowModifier = useMemo(() => ({
        name: 'arrow',
        enabled: !!arrowElement,
        options: {
            element: arrowElement
        }
    }), [arrowElement])

    const offsetModifier = useMemo(() => ({
        name: 'offset',
        options: {
            offset
        }
    }), [offset])

    useEffect(() => {
        if (!popperInstanceRef.current) return;
        popperInstanceRef.current.setOptions({
            placement,
            modifiers: [updateModifier, arrowModifier, offsetModifier]
        })
    }, [placement, updateModifier, arrowModifier, offsetModifier]);

    useEffect(() => {
        if (referenceElement === null || popperElement === null) return;

        popperInstanceRef.current = createPopper(referenceElement, popperElement, {
            placement,
            strategy: 'absolute',
            modifiers: [updateModifier, arrowModifier, offsetModifier]
        });

        return () => {
            if (popperInstanceRef.current) {
                popperInstanceRef.current.destroy();
                popperInstanceRef.current = undefined;

                setState((s) => ({
                    ...s,
                    attributes: {},
                    styles: { popper: {}, arrow: {} }
                }))
            }
        }
    }, [referenceElement, popperElement]);

    return popperState;
}
