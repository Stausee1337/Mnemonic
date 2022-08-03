import { createContext, FunctionComponent, JSX, VNode } from "preact";
import { MutableRef, useContext, useEffect, useMemo, useState } from "preact/hooks";
import { createPortal, useRef } from "preact/compat";
import styles from "./notifications.module.scss"
import { Icon } from "./icons";
import { classNames, hasString } from "./utils";
import { Button } from "./controls";

interface NotificationContextObject {
    push(n: NotificationConfig): number;
    remove(id: number): boolean;
    fadeOut(id: number): void;
}

export interface NotificationConfig {
    type: 'error' | 'warning' | 'info',
    content: string,
    buttons?: VNode<typeof Button>[]
}

interface NotificationObject extends NotificationConfig {
    removeFunctionRef: MutableRef<(() => void) | null>
}

const NotificationContext = createContext<NotificationContextObject>(null!);

const NotificationComponent: FunctionComponent<{
    type: 'error' | 'warning' | 'info',
    content: string,
    buttons: VNode<typeof Button>[]
    removeControlRef: MutableRef<(() => void) | null>,
    onRemove: () => void
}> = ({ type, content, buttons, removeControlRef, onRemove }) => {
    const [animatingOut, setAnimating] = useState(false);
    const animatingOutRef = useRef<{ value: boolean, set: (v: boolean) => void }>();
    animatingOutRef.current = { value: animatingOut, set: setAnimating };

    const removeSelf = removeControlRef.current = useMemo(() => () => {
        if (animatingOutRef.current?.value === false) {
            animatingOutRef.current?.set(true);
            setTimeout(() => {
                onRemove();
            }, 300)
        }
    }, []);

    const props = {[type]: ''}
    return (
        <div 
            {...props}
            class={classNames({
                [styles.notification]: true,
                [styles['fade-out']]: animatingOut
            })}>
            <span><Icon name={type} height={18}/></span>
            <div class={styles['main-content']}>
                { content }
                <button onClick={removeSelf} class={styles['close-button']}>
                    <Icon name="close-thick"/>
                </button>
            </div>
            { buttons.length > 0 ? <div class={styles.buttons}>
                { buttons }
            </div> : null}
        </div>
    );
}

const NotificationArea: FunctionComponent = ({ children }) => <div class={styles.area} children={children}/>

export function useNotifier(): (n: NotificationConfig) => (() => void) {
    const ctx = useContext(NotificationContext);
    return (n) => {
        const id = ctx.push(n);
        return () => ctx.fadeOut(id); // close fn
    }
}

export const NotificationProvider: FunctionComponent = ({ children }) => {
    const [activeNotifications, setNotifications] = useState<Map<number, NotificationObject>>(new Map());

    const notificationObject = useMemo<NotificationContextObject>(() => {
        
        let res: NotificationContextObject = {
            push(config) {
                const id = Date.now() ^ hasString(config.content);
                activeNotifications.set(id, {
                    ...config,
                    removeFunctionRef: { current: null }
                });
                setNotifications(new Map(activeNotifications));
                return id;
            },
            remove(id) {
                try {
                    return activeNotifications.delete(id);
                } finally {
                    setNotifications(new Map(activeNotifications));
                }
            },
            fadeOut(id) {
                activeNotifications.get(id)?.removeFunctionRef.current?.call(undefined);
            }
        };

        return res;
    }, [])

    return (
        
        <NotificationContext.Provider value={notificationObject}>
            { children }
            { createPortal(
                <NotificationArea
                    children={Array.from(activeNotifications).map(([key, value]) => {
                        return (
                            <NotificationComponent 
                                key={key}
                                type={value.type}    
                                content={value.content}
                                buttons={value.buttons ?? []}
                                removeControlRef={value.removeFunctionRef}
                                onRemove={() => notificationObject.remove(key)}
                            />
                        );
                    })}/>,
                document.body)
            }
        </NotificationContext.Provider>
    );
}

