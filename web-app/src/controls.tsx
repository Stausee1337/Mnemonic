import { FunctionComponent, JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { forwardRef } from "preact/compat"
import { Overlay } from "@restart/ui"
import { UsePopperState } from "@restart/ui/usePopper"
import _default from "@popperjs/core/lib/modifiers/popperOffsets";
import { classNames, makeId, nullOrUndefined } from "./utils";
import styles from "./controls.module.scss";
import { Icon } from "./icons";
import { Rust } from "./interface";
import { useEventProvider } from "./window";
import { RouteChanged, RouterInit, useRouter } from "./router";
import { MemoryHistory, Update } from "history";


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
    const router = useRouter()!;
    const eventProvider = useEventProvider();

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
            console.log(data);
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
                <button disabled={buttonDisabled} class={styles['menu-back']} onClick={() => router.history.back()}>
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
        </div>
    );
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
    const [container, setContainer] = useState<HTMLDivElement | null>(null!);

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
