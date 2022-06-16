import { FunctionComponent, JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Tooltip } from "../popper";
import { Overlay } from "../popper";
import { classNames, makeId } from "../utils";
import styles from "./controls.module.scss";


export const Button: FunctionComponent<{ onClick?: JSX.MouseEventHandler<EventTarget> }> = (props) => 
    <button class={styles.button} onClick={props.onClick}>{props.children}</button>;

export const Box: FunctionComponent<{ width?: number }> = (props) => 
    <div class={styles.box} style={{width: props.width ? `${props.width}rem` : '100%' }}>{props.children}</div>

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
        <label class={styles.toggle} for={id}>
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

export const TooltipIcon: FunctionComponent<{ tooltip: string, src: string }> = ({ src, tooltip }) => {
    const ref = useRef<HTMLImageElement>(null!);
    const [show, setShow] = useState(false);

    return (
        <>
            <img 
                ref={ref} 
                class={styles['tooltip-icon']} 
                src={src}
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
            />
            <Overlay
                show={show}
                target={ref}
                placement="left"
                offset={[0, 8]}
            >
                {(popper, arrowProps) => (
                    <Tooltip
                        arrowProps={arrowProps}
                        popper={popper}    
                    >
                        { tooltip }
                    </Tooltip>
                )}
            </Overlay>
        </>
    );
}

