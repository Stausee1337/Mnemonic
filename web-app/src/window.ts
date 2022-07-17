import { useEffect, useMemo } from "preact/hooks";
import { filter } from "rxjs";
import { establishChannel } from "./api";
import { RouteChanged, RouteEvent, RouterInit, useRouter } from "./router";
import { nullOrUndefined } from "./utils";

type ListenerType<T> = (event: T) => void;
export interface EventProvider {
    on<T>(type: string, listener: ListenerType<T>): void;
    off(type: string): void;
}

type WindowEvent = "minimized" | "focus" | "blur";

export function useEventProvider(): EventProvider {
    const listenersMap = useMemo(() => new Map<string, ListenerType<any>>(), []);
    const router = useRouter();

    useEffect(() => {
        let active = true;
        let minimized = false;
        let eatNextEvent = false;
        console.info("establishChannel(window-events)");
        let subscribtion = establishChannel<WindowEvent>("window-events").subscribe({
            next(event) {
                switch (event) {
                    case "minimized":
                        if (!minimized) {
                            active = false;
                            minimized = true;
                        } else {
                            eatNextEvent = true;
                        }
                        break;
                    case "blur":
                        active = false;
                        break;
                    case "focus":
                        if (!eatNextEvent) {
                            active = true;
                        } else {
                            active = true;
                            minimized = false;
                            eatNextEvent = false;
                        }
                        break;
                }

                const listener = listenersMap.get("stateChanged");
                if (!eatNextEvent && !nullOrUndefined(listener)) {
                    listener!({
                        active,
                        minimized
                    });
                }
            },
        });
        return () => {
            console.warn("closing channel window-events");
            subscribtion.unsubscribe();
        }
    }, []);

    useEffect(() => {
        console.info("create(MutationObserver)");
        const observer = new MutationObserver(mutations => {
            const listener = listenersMap.get("titleChanged");
            const title = mutations[0].target.textContent;
            if (!nullOrUndefined(listener)) {
                listener!(title);
            }
        });
        const titleElement = document.querySelector('title');
        observer.observe(titleElement!, { subtree: true, characterData: true, childList: true  });

        return () => {
            console.warn("disconnection mutation observer");
            observer.disconnect();
        }
    }, []);

    useEffect(() => {
        router?.events.pipe(
            filter((e: RouteEvent): e is RouteChanged => e instanceof RouteChanged)
        ).subscribe({
            next(value) {
                const listener = listenersMap.get("routeChanged");
                if (!nullOrUndefined(listener)) {
                    listener!(value);
                }
            }
        })
    }, [])

    useEffect(() => {
        router?.events.pipe(
            filter((e: RouteEvent): e is RouterInit => e instanceof RouterInit)
        ).subscribe({
            next(value) {
                const listener = listenersMap.get("init");
                if (!nullOrUndefined(listener)) {
                    listener!(value);
                }
            }
        })
    }, [])

    return {
        on(type, listener) {
            listenersMap.set(type, listener);
        },
        off(type) {
            console.error(`Not implemented off(type: ${type})`);
        }
    };
}
