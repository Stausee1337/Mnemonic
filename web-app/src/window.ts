import { cloneElement, createContext, createElement, FunctionComponent, VNode } from "preact";
import { useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { filter } from "rxjs/operators";
import { establishChannel, rustInterface } from "./api";
import { Rust } from "./interface";
import { RouteChanged, RouteEvent, RouterInit, useRouter } from "./router";
import { makeId, nullOrUndefined } from "./utils";

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
        const listener = (e: Event) => {
            let index: number;
            if ((index = ["deactivate", "activate"].indexOf(e.type)) !== -1) {
                const listener = listenersMap.get("activeChange");
                if (!nullOrUndefined(listener)) {
                    listener!(Boolean(index));
                }
            } else if ((index = ["minimize", "restore"].indexOf(e.type)) !== -1) {
                const listener = listenersMap.get("stateChange");
                if (!nullOrUndefined(listener)) {
                    listener!(Boolean(index));
                }
            }
        };

        window.addEventListener("minimize", listener);
        window.addEventListener("restore", listener);
        window.addEventListener("activate", listener);
        window.addEventListener("deactivate", listener);
                
        return () => {
            window.removeEventListener("minimize", listener);
            window.removeEventListener("restore", listener);
            window.removeEventListener("activate", listener);
            window.removeEventListener("deactivate", listener);
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

const minimize = new Event("minimize");
const restore = new Event("restore");
const focus = new Event("activate");
const blur = new Event("deactivate");

export function installWindowEventHook() {
    let minimized = false;
    let eatNextEvent = false;
    console.info("establishChannel(window-events)");
    establishChannel<WindowEvent>("window-events").subscribe({
        next(event) {
            switch (event) {
                case "minimized":
                    if (!minimized) {
                        minimized = true;
                        window.dispatchEvent(minimize);
                    } else {
                        eatNextEvent = true;
                    }
                    break;
                case "blur":
                    window.dispatchEvent(blur);
                    break;
                case "focus":
                    if (!eatNextEvent) {
                        window.dispatchEvent(focus);
                    } else {
                        minimized = false;
                        eatNextEvent = false;
                        window.dispatchEvent(restore);
                    }
                    break;
            }
        },
    });
}

export type LocationContextType = "Auto" | "Generate" | "Retrieve";

const LocationContext = createContext<LocationContextType>(null!);

export function getLocationContext(): LocationContextType {
    return useContext(LocationContext);
}

export const Resetable: FunctionComponent<{ children: VNode<any> }> = ({ children }) => {
    const [key, setKey] = useState(makeId());
    const [clc, setClc] = useState<LocationContextType>("Auto");

    useEffect(() => {
        establishChannel<LocationContextType>("ui-events")
            .subscribe(location => {
                setKey(makeId());
                setClc(location);
            });
        Rust.setInitialized();
    }, [])

    return createElement(
        LocationContext.Provider,
        { 
            value: clc,
            children: cloneElement(children, { key })
        }
    );
}
