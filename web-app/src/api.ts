import { Observable } from "rxjs";


const event = new Event('application-init');

type RejectFn = (reason: string) => void;
type ResolveFn = (value: any) => void;
interface IPCHandler {
    // Internal
    _dispatchResolver(handle: Handle, object: any): void;

    registerResolver(callback: ResolveFn, error: RejectFn): Handles;
} 

type Handle = number;
type Handles = { callback: Handle, error: Handle }
export interface IRustInterface {
    sendIPCMessage: (rawMessage: string) => void;
    ipcHandler: IPCHandler;
    onChannelEvent(listener: (event: { type: "accept" | "message" }) => void): void;

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
        rustOpenChannel(name).then(id => {
            rustInterface.onChannelEvent(event => {
                switch (event.type) {
                    case "accept":
                        
                        break;
                }
            })
        })
    })
}

export function initializeApi() {
    (<any>window)['RustInterface'] = rustInterface
    window.dispatchEvent(event);
    rustInterface._ready = true;
    console.log(rustInterface);
}
