import { Observable, Subject, filter, map, first } from "rxjs";
import { nullOrUndefined } from "./utils";
import { dequal } from "dequal"


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
interface ChannelMessageEvent { channelId: Uuid, data?: Record<string, any>, error?: Record<string, any> }

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

    _ready: boolean;
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
    onChannelEvent(type, listener, once) {
        once = once ?? false;
        let channel = <Observable<{
            type: "accept" | "message",
            [key:string]: any
        }>>(<any>window)['channel'];
        channel = channel.pipe(
            filter(p => p.type === type), 
            map(p => {
                delete p.type;
                return p;
            })
        );
        
        return channel.subscribe({ next: (listener as any) }).unsubscribe.bind(channel)
    }
};

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
            let teardown = rustInterface.onChannelEvent("message", event => {
                if (dequal(event.channelId, channelId)) {
                    if (nullOrUndefined(event.error)) {
                        subscriber.next((event.data ?? null) as T);
                    } else if (nullOrUndefined(event.data)) {
                        subscriber.error((event.error ?? null) as any);
                    }
                }
            });
            let teardown2 = rustInterface.onChannelEvent("close", ({channelId: eventChannelId}) => {
                if (dequal(eventChannelId, channelId)) {
                    teardown();
                    teardown2();
                    subscriber.complete();
                }
            })
            clearTimeout(timeout);
        };

        rustOpenChannel(name).then(async id => {
            const teardown = rustInterface.onChannelEvent("accept", event => {
                console.log(event);
                const {token, acceptId} = event;
                if (token === id) {
                    teardown();
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

export function initializeApi() {
    const subject = new Subject<any>();
    (<any>window)['channel'] = subject;
    (<any>window)['RustInterface'] = rustInterface;
    window.dispatchEvent(event);
    rustInterface._ready = true;
    console.log(rustInterface);
}
