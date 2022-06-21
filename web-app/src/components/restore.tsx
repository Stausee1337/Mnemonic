import usePopper from "@restart/ui/esm/usePopper";
import { FunctionComponent } from "preact";
import { useEffect, useLayoutEffect, useMemo, useState } from "preact/hooks";
import styles from "./restore.module.scss";

type WordClassType = 'gray' | 'blue' | 'green' | 'red';

function runValidators(word: string): boolean {
    if (!word) return false;
    return false;
}

const Word: FunctionComponent<{ 
    index: number, 
    selected: number,
    onSelected: (newIndex: number) => void, 
}> = ({ 
    index, selected, onSelected
}) => {
    const [wordContainer, setSpan] = useState<HTMLSpanElement | null>(null);
    const [suggestionContainer, setSuggestionContainer] = useState<HTMLDivElement | null>(null);

    const [active, setActive] = useState(false);
    const [input, setInput] = useState<HTMLInputElement | null>(null);
    const [value, setValue] = useState("");
    const popper = usePopper(
        wordContainer,
        suggestionContainer,
        {
            placement: "bottom-start"
        }
    )

    let validationClass = useMemo<WordClassType>(() => {
        const isEmpty = value.length === 0;
        if (active) {
            return 'blue';
        } else {
            if (isEmpty && index > selected) return 'gray';
            return runValidators(value) ? 'green' : 'red';
        }
    }, [active, value, selected])

    useEffect(() => {
        if (selected === index) {
            setActive(true);
        } else if (active) {
            setActive(false);
        }
    }, [selected]);

    useEffect(() => {
        if (active) {
            if (input === null) {
                console.log('input element is null');
                return;
            }
            input.focus();
        }
    }, [active]);

    useLayoutEffect(() => {
        popper.forceUpdate();
    }, [active && value.length])

    
    const inputHandler = () => {
        if (input === null) return;
        setValue(input.value);
        input.parentElement!.dataset.text = input.value;
    };

    const suggestionActive = active && value.length > 0 ? styles['suggestion-active'] : ''
    return (
        <span ref={setSpan} class={`${styles['word']} ${styles[validationClass ?? '']} ${suggestionActive}`}>
            <input 
                onInput={inputHandler} 
                size={1} type="text"
                autoCapitalize="off" autoComplete="off" autoCorrect="off" spellcheck={false}
                ref={setInput}
                onFocus={() => onSelected(index)}/>
            { active ? (
            <div 
                {...popper.attributes.popper}
                style={popper.styles['popper'] as any}
                ref={setSuggestionContainer} 
                class={`${styles['suggestion-container']} ${value.length > 0 ? styles['show'] : ''}`}
            >

            </div> ): null
            }
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
                    { array.map((_, i) => <Word 
                        key={`word-${i}`}
                        index={i}
                        selected={activeIndex}
                        onSelected={setIndex}
                    />) }
                </div>
                <div class={styles.misc}></div>
            </div>
        </>
    );
}
