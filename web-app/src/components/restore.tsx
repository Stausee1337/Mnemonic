import { FunctionComponent } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import styles from "./restore.module.scss";

enum WordState {
    Idle,
    Inactive,
    Active,
    Correct,
    Incorret
}

const Word: FunctionComponent<{ active: boolean }> = ({
    active
}) => {
    const [wordState, setState] = useState<WordState>(WordState.Idle);

    useEffect(() => {
        if ([WordState.Correct, WordState.Incorret].includes(wordState))
            return; // this states are immutable from outside
        
        setState(active ? WordState.Active : WordState.Inactive);
    }, [active]);

    console.log(WordState[wordState]);

    return (
        <span class={styles['word']}>
            <input 
                onInput={e => e.currentTarget.parentElement!.dataset.text = e.currentTarget.value} 
                size={1} type="text"
                autoCapitalize="off" autoComplete="off" autoCorrect="off" spellcheck={false}
                autoFocus={wordState === WordState.Active} />
        </span>
    );
}

export const RestorePage: FunctionComponent = () => {
    let [activeIndex, setIndex] = useState(0);
    
    let array = useMemo(() => Array.from(Array(12)), [])
    console.log(3, array);

    return (
        <>
            <div class={styles['grid-view']}>
                <div class={styles['word-box']}>
                    { array.map((_, key) => <Word key={`word-${key}`} active={key === activeIndex}/>) }
                </div>
                <div class={styles.misc}></div>
            </div>
        </>
    );
}
