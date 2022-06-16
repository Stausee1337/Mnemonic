

export function classNames(input: { [key: string]: boolean }): string;
export function classNames(input: string[]): string;
export function classNames(input: any): any {
    if (Array.isArray(input)) {
        return input.join(' ');
    } else {
        return classNames(
            Object.entries(input).filter(([_, value]) => value).map(([name, _]) => name)
        )
    }
}

export function random(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
}

const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
export function makeId(len: number = 4): string {
    const result: string[] = [];
    for (let i = 0; i < len; i++) {
        result.push(characters.at(random(0, characters.length))!)
    }
    return result.join('')
}
