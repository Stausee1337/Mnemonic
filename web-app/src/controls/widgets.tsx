import { FunctionComponent, JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { forwardRef } from "preact/compat"
import { Overlay } from "@restart/ui"
import { UsePopperState } from "@restart/ui/usePopper"
import { makeId } from "../utils";
import styles from "./controls.module.scss";
import _default from "@popperjs/core/lib/modifiers/popperOffsets";

import checkIcon from "../icons/check2.svg";


export const Button: FunctionComponent<{ onClick?: JSX.MouseEventHandler<EventTarget> }> = (props) => 
    <button class={styles.button} onClick={props.onClick}>{props.children}</button>;

export const ToggleSwitch: FunctionComponent<{
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
        <label class={styles.toggle} for={id} disabled={disabled}>
            { children }
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
    const sliderRef = useRef<HTMLSpanElement>(null!);

    const sliderWidth = 200;
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
        const ratio = ((e.clientX - diffX)/ sliderWidth);
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
        const ratio = ((e.clientX - left) / sliderWidth);
        const newValue = Math.round((ratio * range) + min);
        if (newValue >= min && newValue <= max) {
            setValue(newValue);
        } else {
            setValue(Math.max(Math.min(min, newValue), max));
        }
    }

    const ratio = (currentValue - min) / range;
    return (
        <div class={styles['slider-container']}>
            <span class={styles['padding-contanier']} onMouseDown={sliderMouseDown}/>
            <span ref={sliderRef} class={styles.background}>
                <span class={styles.slider} style={{ 'transform': `translateX(-${200 - (sliderWidth * ratio)}px)` }}/>
            </span>
            <span onMouseDown={handleMouseDown} style={{ transform: `translateX(${sliderWidth * ratio}px)` }} class={styles.handle}/>
        </div>
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
        <label class={styles.checkbox} style={{ '--mn-tick-icon-src': `url("${checkIcon}")` }} for={id} disabled={disabled}>
            { children }
            <input type="checkbox" disabled={disabled} id={id} onChange={e => onChanged ? onChanged(e.currentTarget.checked) : undefined} checked={checked} />
            <span class={styles.check}/>
        </label>
    ) 
}
