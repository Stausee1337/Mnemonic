import { createContext, FunctionComponent } from "preact";
import { useContext, useMemo, useState } from "preact/hooks";
import { createPortal } from "preact/compat";
import styles from "./notifications.module.scss"

interface NotificationContextObject {
    activeNaviations: NotificationObject[];
    eventId: number;
    notifyChanges?: () => void;

    push(n: NotificationObject): void;
    remove(self: NotificationObject): boolean;
    fadeOut(self: NotificationObject): void;
}

interface NotificationObject {
    class: 'error' | 'success' | 'info',
    closeButton: boolean,
    // controls: {},
    title: string,
    content?: string,
    stayOpen?: boolean;
    _removing?: boolean;
    _id?: string;
}

const NotificationContext = createContext<NotificationContextObject>(null!);

const NotificationArea: FunctionComponent = ({ }) => {
    let notifications = useNotifications();

    return (
        <div class={styles.area}>
            { notifications.activeNaviations.map(config => {
                const removing = config._removing ?? false;
                const fadeOut = removing ? 'fade-out' : undefined;
                const endTrigger = removing ? () => notifications.remove(config) : undefined;
                return (
                <div key={config._id!} onAnimationEnd={endTrigger} class={`${styles.notification} ${styles[config.class]} ${styles[fadeOut!]}`}>
                    <h1>{ config.title }</h1>
                    { config.closeButton ? <span onClick={() => notifications.fadeOut(config)} class={styles['close-button']} /> : null }
                    { config.content ? <article children={config.content} /> : null }
                </div>);
            }) }
        </div>
    );
}

export function useNotifier(): (n: NotificationObject) => (() => void) {
    const ctx = useContext(NotificationContext);
    return (n) => {
        ctx.push(n);
        return () => ctx.fadeOut(n); // close fn
    }
}

function useNotifications(): NotificationContextObject {
    const notification = useContext(NotificationContext);
    const [value, setState] = useState(0);
    notification.notifyChanges = () => {
        setState(value + 1)
    };

    return notification;
}

export const NotificationProvider: FunctionComponent = ({ children }) => {
    const notificationObject = useMemo<NotificationContextObject>(() => {
        
        let res: NotificationContextObject = {
            activeNaviations: [],
            eventId: 0,
            push(n) {
                if (!n.closeButton && !n.stayOpen) {
                    setTimeout(() => res.fadeOut(n), 5000);
                }
                n._id = `${Date.now()}`;
                res.activeNaviations.push(n);
                if (res.notifyChanges) res.notifyChanges();
            },
            remove(self) {
                const i = res.activeNaviations.indexOf(self)
                if (i > -1) {
                    res.activeNaviations.splice(i, 1);
                    if (res.notifyChanges) res.notifyChanges();
                    
                    return true;
                }
                return false;
            },
            fadeOut(self) {
                self._removing = true;
                if (res.notifyChanges) res.notifyChanges();
            }
        };

        return res;
    }, [])

    return (
        
        <NotificationContext.Provider value={notificationObject}>
            { children }
            { createPortal(<NotificationArea/>, document.body) }
        </NotificationContext.Provider>
    );
}

