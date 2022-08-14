import { dequal } from "dequal";
import { useEffect, useRef, useState } from "preact/hooks";
import { establishChannel } from "./api";
import { Rust } from "./interface";
import { resolveTypes } from "./utils";

export namespace Config {
    export type LazyProperty = {
        getOrDefault<T>(value?: T): Promise<T>,
    } & { [key: string]: LazyProperty; };


    // @ts-ignore
    interface GlobalConfig extends LazyProperty {
        // @ts-ignore
        clear(): void;
        // @ts-ignore
        exists(): Promise<boolean>;
    }

    const TARGET = Symbol('$$config.target');

    export function setProperty<T>(property: LazyProperty, value: T) {
        const target = (property as any)[TARGET];
        const path = target['name'].split('.');
        writeToConfig(path, value);
    }

    // @ts-ignore: Type Error
    const lazyPropertyImpl: LazyProperty = {
        getOrDefault: async function (value?) {
            const target = (this as any)[TARGET];
            const path = target['name'].split('.');
            const result = await readFromConfig(path);
            if (value !== undefined) {
                if (!dequal(resolveTypes(value), resolveTypes(result))) {
                    return value;
                }
            }
            return result;
        },
    };

    function readFromConfig(dottedPath: string[]): Promise<any> {
        return Rust.configGetProperty(dottedPath);
    }

    async function writeToConfig(dottedPath: string[], value: any): Promise<void> {
        return Rust.configSetProperty(dottedPath, value);
    }

    function buildProxyFor(propName: string, extended={}): LazyProperty {
        const t: any = {...lazyPropertyImpl, name: propName, ...extended};
        t[TARGET] = t;
        return new Proxy(t, {
            get(target, p, receiver) {
                if (p === "getOrDefault" || typeof p === 'symbol') {
                    return Reflect.get(target, p, receiver)
                }
                return buildProxyFor([propName, p].join('.'));
            },
            set(target, p, value, receiver) {
                if (p === "getOrDefault" || typeof p === 'symbol') {
                    return false;
                }
                writeToConfig([...propName.split('.'), p], value);
                return true;
            },
        })
    }

    
    export const globalConfig: GlobalConfig = buildProxyFor('globalConfig', {
        clear() { writeToConfig(['globalConfig'], {}) },
        exists() { return Rust.configIsFile(); }
    }) as any;
}