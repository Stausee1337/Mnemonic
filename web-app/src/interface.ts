import {  Rust as RustNamespace } from './interface.d';
import { callRustCommand } from './api';

type RustType = typeof RustNamespace;
export const Rust = new Proxy({}, {
    get(_, prop) {
        if (typeof prop === 'symbol') return;
        return (...args: any[]) => callRustCommand(prop, args);
    }
}) as RustType;
