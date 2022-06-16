import * as Popper from "@popperjs/core"
import { FunctionComponent, VNode, RefCallback, RefObject } from "preact";
import { useMemo, useState } from "preact/hooks"
import { forwardRef, createPortal, CSSProperties } from "preact/compat";
import { classNames as clsn } from "../utils"
import { usePopper, UsePopperState } from "./hook";
import styles from "./popper.module.scss"

console.log(styles);


export const Tooltip: FunctionComponent<{
    arrowProps: any, popper: any
}> = ({
    children, arrowProps, popper
}) => {
    return (
        <>
            <div
                {...arrowProps}
                style={arrowProps.style}
                class={clsn({
                    [styles.arrow]: true,
                    [styles.right]: popper.placement === 'left',
                    [styles.left]: popper.placement === 'right',
                    [styles.top]: popper.placement === 'bottom',
                    [styles.bottom]: popper.placement === 'top'
                })}
            />
            <div class={styles.tooltip} >{ children }</div>

        </>
    )
}

export interface ArrowProps extends Record<string, any> {
    ref: RefCallback<HTMLElement>;
    style: CSSProperties;
}

export interface OverlayProps {
    target: RefObject<HTMLElement> | null | undefined;
    placement: Popper.Placement,

    children: (
        popper: UsePopperState,
        arrowProps: Partial<ArrowProps>
    ) => VNode;
    show: boolean;
    offset?: [number, number]
}

export const Overlay: FunctionComponent<OverlayProps> = ({
    children, target, placement, show, offset
}) => {
    const [rootElement, attachRef] = useState<HTMLElement>(null!);
    const [arrowElement, attachArrowRef] = useState<Element>(null!);

    /* const container = useMemo<HTMLElement>(() => {
        let res = document.createElement('div');
        document.body.appendChild(res);
        console.log('executed');
        return res;
    }, []);*/

    const popper = usePopper(
        (target?.current ? target?.current : null) as any,
        rootElement,
        placement, 
        arrowElement,
        offset
    );

    if (!show) return;

    let child = children(
        popper,
        {
            ...popper.attributes.arrow,
            style: popper.styles.arrow as any,
            ref: attachArrowRef as RefCallback<HTMLElement>
        }
    )

    //& console.log(popper.styles.popper);

    return createPortal(<div
        {...popper.attributes.popper}
        style={popper.styles.popper as any}
        ref={attachRef as RefCallback<HTMLElement>}
        children={child}
        class={styles.absolute}
    />, document.body);
}

