import { Observable, Subject, filter, map, first, flatMap } from "rxjs";
import { nullOrUndefined } from "./utils";
import { dequal } from "dequal"
import { Rust } from "./interface";


const event = new Event('application-init');

type RejectFn = (reason: string) => void;
type ResolveFn = (value: any) => void;
interface IPCHandler {
    // Internal
    _dispatchResolver(handle: Handle, object: any): void;

    registerResolver(callback: ResolveFn, error: RejectFn): Handles;
} 

type Uuid = [
    number, number, number, 
    [number, number, number, number,
    number, number, number, number]
];
interface ChannelAcceptEvent { token: number, acceptId: Uuid }
interface ChannelMessageEvent { channelId: Uuid, data: Record<string, any>, resolver?: number }

type Handle = number;
type Handles = { callback: Handle, error: Handle }
export interface IRustInterface {
    sendIPCMessage: (rawMessage: string) => void;
    ipcHandler: IPCHandler;
    onChannelEvent(
        type: "accept",
        listener: (event: ChannelAcceptEvent) => void,
        once?: boolean
    ): () => void;
    onChannelEvent(
        type: "message",
        listener: (event: ChannelMessageEvent) => void,
        once?: boolean
    ): () => void;
    onChannelEvent(
        type: "close",
        listener: (event: { channelId: Uuid }) => void,
        once?: boolean
    ): () => void;

    ready: Promise<void>;
    _ready: boolean;
    _resolve: () => void;
    _update(changes: IRustInterface): void;
}

export const rustInterface: IRustInterface = <IRustInterface>{ 
    _ready: false,
    _update(changes: IRustInterface) {
        Object.entries(changes).forEach(([key, value]) => {
            (<any>rustInterface)[key] = value
        })
        rustInterface._ready = true;
    },
    onChannelEvent(ctype, listener, once) {
        once = once ?? false;
        let channel = <Observable<{
            type: "accept" | "message",
            [key:string]: any
        }>>(<any>window)['channel'];
        
        return channel.subscribe(data => {
            const {type, ...event} = data;
            if (type === ctype) {
                listener(event as any);
            }
        }).unsubscribe.bind(channel)
    }
};

rustInterface.ready = new Promise<void>(resolve => rustInterface._resolve = resolve)

function randomId(): number {
    return window.crypto.getRandomValues(new Uint32Array(1))[0];
}

export async function callRustCommand<R>(name: string, args: any[]): Promise<R> {
    if (!rustInterface._ready) {
        throw new Error("Rust Interface API isn't ready jet; Make sure to call initializeApi() first.");
    }

    // serialize call

    const prom = new Promise<R>((resolve, reject) => {
        const handles = rustInterface.ipcHandler.registerResolver(resolve, reject);
        rustInterface.sendIPCMessage(JSON.stringify({
            ...handles,
            command: name,
            inner: args
        }));
    });

    return await prom;
}

async function rustOpenChannel(name: string): Promise<number> {
    let id = randomId();
    await callRustCommand("establishChannel", [name, id]);
    return id;
}



export function establishChannel<T>(name: string): Observable<T> {
    return new Observable(subscriber =>  {
        let storedChannelId: Uuid;
        
        const timeout = setTimeout(() => {
            subscriber.error('Channel has timed out after 1 second');
            subscriber.complete();
        }, 1000)

        const setInitialzed = (channelId: Uuid) => {
            storedChannelId = channelId;
            rustInterface.onChannelEvent("message", event => {
                if (dequal(event.channelId, channelId)) {
                    const result = subscriber.next(event.data as T);
                    if (!nullOrUndefined(event.resolver)) {
                        callRustCommand("resolve", [event.resolver!, true]);
                    }
                }
            });
            rustInterface.onChannelEvent("close", ({channelId: eventChannelId}) => {
                if (dequal(eventChannelId, channelId)) {
                    subscriber.complete();
                }
            })
            clearTimeout(timeout);
        };

        rustOpenChannel(name).then(async id => {
            rustInterface.onChannelEvent("accept", event => {
                const {token, acceptId} = event;
                if (token === id) {
                    setInitialzed(acceptId);
                }
            })
        });

        return () => {
            if (storedChannelId)
                callRustCommand("closeChannel", [storedChannelId]);
        };
    })
}

interface MessageBoxOptions {
    message: string;
    type?: "none" | "info" | "warning" | "error" | "shield";
    buttons?: string[];
    defaultId?: number;
    title?: string;
    detail?: string;
    checkboxLabel?: string;
    checkboxChecked?: boolean;
    cancelId?: number;
    noLink?: boolean;
}

export enum DialogResult {
    Ok = "ok",
    Cancel = "cancel",
    Retry = "retry",
    Yes = "yes",
    No = "no",
    Close = "close"
}

export type DialogResponse = {
    response: DialogResult | number,
    checkboxChecked: boolean 
}

const resultMapping = [
    undefined,  // 0
    "ok",       // 1
    "cancel",   // 2
    undefined,  // 3
    "retry",    // 4
    undefined,  // 5
    "yes",      // 6
    "no",       // 7
    "close"     // 8
]
export function showMessageBox(options: MessageBoxOptions): Promise<DialogResponse> {
    const {
        type,
        cancelId,
        ...roptions
    } = options;
    return Rust.showMessageBox({
        dialog_type: type ?? "",
        ...Object.fromEntries(
            Object.entries(roptions).map(
                ([n, v]) => [
                    n.split(/(?=[A-Z])/).join('_').toLowerCase(),
                    v
                ] 
            )
        )
    }).then(({ response, checkboxChecked }) => {
        if (response >= 100) {
            response -= 100;
            if (!nullOrUndefined(cancelId) && response === cancelId) {
                response = DialogResult.Cancel;
            }
        } else {
            response = resultMapping[response] ?? response;
        }

        return {
            response: response,
            checkboxChecked: checkboxChecked
        }
    })
}

export function initializeApi() {
    const subject = new Subject<any>();
    (<any>window)['channel'] = subject;
    (<any>window)['RustInterface'] = rustInterface;
    window.dispatchEvent(event);
    rustInterface._ready = true;
    rustInterface._resolve();
}
