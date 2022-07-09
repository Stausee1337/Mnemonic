import { FunctionComponent } from "preact";
import { useState } from "preact/hooks";
import iconMapping from "./assets/mapping.json";
import { nullOrUndefined } from "./utils";

function getRatio(text: string): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = "16px iconfont"
    return 16 / ctx.measureText(text).width;
}


export const Icon: FunctionComponent<{ 
    name: string,
    width?: number,
    height?: number
}> = ({ name, width, height }) => {
    const [initialized, setInitialized] = useState(false);
    const IconType: string = 'icon';
    const iconNumber = ((iconMapping as any)[name]) as number;
    const iconChar = eval(`'\\u${iconNumber.toString(16)}'`);

    const props = {style: {}};
    if (!nullOrUndefined(width)) {
        props['style'] = {'font-size': `${getRatio(iconChar) * width!}px`};
    }
    if (!nullOrUndefined(height)) {
        props['style'] = {'font-size': `${height!}px`}
    }
    
    document.fonts.ready.then(() => setInitialized(true));
    return !initialized ? null : <IconType {...props} data-char={iconChar}/>;
}
