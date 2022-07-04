import type { ConfigData, PhraseData } from './types'

namespace Rust {
    export async function generateMnemonicPhrase(config: ConfigData): Promise<PhraseData>;
    export async function fromMnemonicPhrase(pharse: string[], config: ConfigData): Promise<PhraseData>;
    export async function setInitialized(): Promise<void>;
    export async function getWordlist(): Promise<string>;
    export async function windowDragMove(): Promise<void>;
    export async function windowShowSysMenu(x: number, y: number): Promise<void>;
}