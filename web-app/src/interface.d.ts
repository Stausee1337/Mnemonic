export namespace Rust {
    export function generateMnemonicPhrase<S, T>(config: S): Promise<T>;
    export function fromMnemonicPhrase<S, T>(pharse: string[], config: S): Promise<T>;
    export function checkChecksum(pharse: string[]): Promise<boolean>;
    export function setInitialized(): Promise<void>;
    export function pageContentLoaded(): Promise<void>;
    export function getWordlist(): Promise<string>;
    export function windowDragMove(): Promise<void>;
    export function windowShowSysMenu(x: number, y: number): Promise<void>;
    export function windowClose(): Promise<void>;
    export function windowMinimize(): Promise<void>;
    export function windowSetTitle(title: string): Promise<void>;
    export function showMessageBox(config: { [ key: string ]: any }): Promise<any>;
    export function autostartRegistryExecuteCommand(command: string): Promise<boolean | null>;
    export function clipboardWriteTextSecure(newClipText: string): Promise<void>;
    export function configGetProperty(path: string[]): Promise<any>;
    export function configSetProperty(path: string[], value: any): Promise<void>;
    export function configObserveProperty(path: string[]): Promise<void>;
    export function configIsFile(): Promise<boolean>;
}