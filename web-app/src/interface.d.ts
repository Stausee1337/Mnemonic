export namespace Rust {
    export async function generateMnemonicPhrase<S, T>(config: S): Promise<T>;
    export async function fromMnemonicPhrase<S, T>(pharse: string[], config: S): Promise<T>;
    export async function checkChecksum(pharse: string[]): Promise<boolean>;
    export async function setInitialized(): Promise<void>;
    export async function getWordlist(): Promise<string>;
    export async function windowDragMove(): Promise<void>;
    export async function windowShowSysMenu(x: number, y: number): Promise<void>;
    export async function windowClose(): Promise<void>;
    export async function windowMinimize(): Promise<void>;
    export async function windowSetTitle(title: string): Promise<void>;
    export async function showMessageBox(config: { [ key: string ]: any }): Promise<any>;
    export async function configGetProperty(path: string[]): Promise<any>;
    export async function configSetProperty(path: string[], value: any): Promise<void>;
    export async function configObserveProperty(path: string[]): Promise<void>;
    export async function configIsFile(): Promise<boolean>;
}