import { cloneElement, FunctionComponent, VNode } from "preact";
import { useMemo } from "preact/hooks";

export type ValidatorFn = (value: string) => boolean;

export interface ValidationObject {
    validators: { [key: string]: ValidatorFn };


    // once the user altered the input
    dirty: boolean;
    // once finish is called
    touched: boolean;
    // if all the valiators returned true
    valid: boolean;

    // runs the validators; automatically called onChange
    validate(value: string): boolean;
    // sets dirty and touched back to false
    clear(): void;
    // sets touched to true, automattically called onBlur
    finish(value: string): boolean
}

class Validation implements ValidationObject {
    validators: { [key: string]: ValidatorFn; };
    dirty = false;
    touched = false;
    valid = false;

    constructor (validators: { [key: string]: ValidatorFn }) {
        this.validators = validators;
    }

    validate(value: string): boolean {
        this.valid = Object.values(this.validators).map(fn => fn(value)).every(v => v);
        return this.valid;
    }

    clear(): void {
        this.touched = false;
        this.dirty = false;
        this.valid = false;
    }

    finish(value: string): boolean {
        this.touched = true;
        return this.validate(value);
    }
}

export function useValidation(validators: { [key: string]: ValidatorFn }): ValidationObject {
    return useMemo<ValidationObject>(() => new Validation(validators), []);
}

export const ValidatorModel: FunctionComponent<{
    children: VNode,
    validation: ValidationObject
    onChange?: (value: string) => void,
}> = ({ children, onChange, validation }) => {
    if (!(validation instanceof Validation)) {
        throw new Error('useValidation for the valudation prop.')
    }

    const inputHandler = (e: JSX.TargetedEvent<HTMLInputElement>) => {
        const value = e.currentTarget.value;
        validation.dirty = true;
        validation.validate(value);
        onChange?.call(undefined, value);
    }

    return (
        cloneElement(children, { onInput: inputHandler })
    )
}

