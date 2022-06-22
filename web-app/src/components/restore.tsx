import usePopper from "@restart/ui/esm/usePopper";
import { FunctionComponent, JSX } from "preact";
import { useEffect, useLayoutEffect, useMemo, useState } from "preact/hooks";
import { Rust } from "../interface";
import { classNames } from "../utils";
import styles from "./restore.module.scss";

type WordClassType = 'gray' | 'blue' | 'green' | 'red';

function runValidators(word: string): boolean {
    if (!word) return false;

    const wordlist = getWordlist();
    if (wordlist === null) {
        // todo: call global error handler
        throw Error('Cant open wordlist');
    }
    return wordlist.includes(word);
}

function storeWordlist(wordlist: string[]) {
    (window as any)['wordlist'] = wordlist;
}

function getWordlist(): string[] | null {
    let wordlist = (window as any)['wordlist'];
    if (!wordlist) return null;
    return wordlist as any;
}

function suggest(input: string): string[] {
    const wordlist = getWordlist();
    if (wordlist === null) {
        // todo: call global error handler
        throw Error('Cant open wordlist');
    }
    return wordlist.filter(predicate => predicate.startsWith(input)).slice(0, 5);
}

const Suggestions: FunctionComponent<{ 
    input: string,
    selected?: number,
    onSelect: (index: number, word: string) => void,
    onUpdate: (nSuggestions: number) => void
}> = ({ 
    input,
    onSelect,
    onUpdate,
    selected: selectedProp,
}) => {
    const [selected, setSelected] = useState<number>(null!);
    const [suggestions, setSuggestions] = useState<string[]>([]);

    useEffect(() => {
        if (!Number.isInteger(selectedProp)) setSelected(-2);
        let value = selectedProp!;
        if (value === -2) return; // Don't deal with the abcense of a selection

        setSelected(value >= suggestions.length ? 0 : value < 0 ? suggestions.length-1 : value);

    }, [selectedProp]);

    useEffect(() => {
        onSelect(selected, suggestions[selected] ?? suggestions[0] ?? null!);
    }, [selected])

    useEffect(() => {
        setSuggestions(suggest(input));
        setSelected(-2);
    }, [input])

    useEffect(() => {
        onSelect(selected, suggestions[selected] ?? suggestions[0] ?? null!);
        onUpdate(suggestions.length);
    }, [suggestions])

    // calculateClassString
    const ccs = (i: number) => classNames({
        [styles.suggestion]: true,
        [styles.selected]: i === selected,
    });

    return (
        <>
            {
                suggestions.map((word, idx) => {
                    
                    return <span class={ccs(idx)}>{input}<b>{word.slice(input.length)}</b></span>
                })
            }
        </>
    )
}

type ObserverWrapperType = {
    callback: ResizeObserverCallback | null,
    observer: ResizeObserver
};

const Word: FunctionComponent<{ 
    index: number, 
    selected: number,
    onSelected: (newIndex: number) => void, 
    onFinished: (content: string) => void
}> = ({ 
    index, selected, onSelected, onFinished
}) => {
    const [wordContainer, setSpan] = useState<HTMLSpanElement | null>(null);
    const [suggestionContainer, setSuggestionContainer] = useState<HTMLDivElement | null>(null);
    const [input, setInput] = useState<HTMLInputElement | null>(null);

    const [active, setActive] = useState(false);
    const [suggestions, setSuggestions] = useState(0);
    const [value, setValue] = useState("");
    const [selectedState, setSelected] = useState<{ index: number, word: string }>({ word: null!, index: null! })

    const popper = usePopper(
        wordContainer,
        suggestionContainer,
        {
            placement: "bottom-start"
        }
    )

    const validationClass = useMemo<WordClassType>(() => {
        const isEmpty = value.length === 0;
        if (active) {
            return 'blue';
        } else {
            if (isEmpty && index > selected) return 'gray';
            return runValidators(value) ? 'green' : 'red';
        }
    }, [active, value, selected])

    const observerWrapper = useMemo<ObserverWrapperType>(() => {
        const resizeObserver = new ResizeObserver((...args) => {
            if (result.callback === null) return;
            result.callback(...args);
        });

        const result: ObserverWrapperType = {
            callback: null,
            observer: resizeObserver
        };

        return result;
    }, []);

    useEffect(() => {
        observerWrapper.observer.disconnect();
        if (wordContainer)
            observerWrapper.observer.observe(wordContainer);
        if (suggestionContainer)
            observerWrapper.observer.observe(suggestionContainer);
        return () => observerWrapper.observer.disconnect();
    }, [wordContainer, suggestionContainer])

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

    useEffect(() => {
        if (input === null || wordContainer === null) return;
        console.log('minWidth', value);
        input.style.minWidth = '0';
        wordContainer.dataset.text = value.trimEnd();
    }, [!active && value.length > 0])

    useLayoutEffect(() => {
        popper.forceUpdate();
    }, [active && value.length]);

    observerWrapper.callback = (entries) => {
        if (suggestionContainer === null) return;
        if (entries.length > 1) return;

        const event = entries[0];
        if (event.target === wordContainer) {
            // suggestionContainer.style.minWidth = `${wordContainer.offsetWidth}px`
        } else if (event.target === suggestionContainer) {
            console.log(suggestionContainer.offsetWidth);
            const newWidth = suggestionContainer.offsetWidth - 40; 
            input!.style.minWidth = (newWidth > 120 ? `${newWidth}px` : null) as any;
        }
    };
    
    const inputHandler = () => {
        if (input === null) return;
        setValue(input.value);
        input.parentElement!.dataset.text = input.value;
    };

    const keyHandler = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
        if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
            e.preventDefault();

            switch(e.key) {
                case 'ArrowUp':
                    setSelected({
                        word: selectedState.word,
                        index: selectedState.index - 1,
                    });
                    break;
                case 'ArrowDown':
                    setSelected({
                        word: selectedState.word,
                        index: selectedState.index + 1,
                    })
                    break;
                case 'Enter':
                    if (selectedState.word === null) return;
                    setValue(selectedState.word);
                    onFinished(selectedState.word);
                    break;
            }
        }
    }

    const suggestionActive = active && value.length > 0 && suggestions > 0 ? styles['suggestion-active'] : ''
    return (
        <span ref={setSpan} class={`${styles['word']} ${styles[validationClass ?? '']} ${suggestionActive}`}>
            <input 
                onInput={inputHandler} 
                onKeyDown={keyHandler}
                size={1} type="text"
                autoCapitalize="off" autoComplete="off" autoCorrect="off" spellcheck={false}
                ref={setInput}
                onFocus={() => onSelected(index)}
                value={value}/>
            { active ? (
            <div 
                {...popper.attributes.popper}
                style={popper.styles['popper'] as any}
                ref={setSuggestionContainer} 
                class={`${styles['suggestion-container']} ${value.length > 0 ? styles['show'] : ''}`}
            >
                { value.length > 0 ? 
                    <Suggestions 
                        input={value} 
                        onSelect={(index, word) => setSelected({index, word})}
                        onUpdate={setSuggestions}
                        selected={selectedState.index} /> : null }
            </div> ): null
            }
        </span>
    );
}

const Spacer: FunctionComponent = () => <span class={styles.spacer}></span>

function iterateWords(words: JSX.Element[]): JSX.Element[] {
    const result: JSX.Element[] = [];

    words.forEach((word, index) => {
        result.push(word);
        if (index < words.length - 1)
            result.push(<Spacer/>) 
    })

    return result;
}

export const RestorePage: FunctionComponent = () => {
    const [initalized, setInitalized] = useState(false);
    const [activeIndex, setIndex] = useState(0);
    const [words, setWords] = useState([""]);

    useEffect(() => {
        Rust.getWordlist().then(data => {
            let wordlist = data.split('\r\n')
            wordlist.pop()
            wordlist = wordlist.sort((a, b) => a.localeCompare(b))
            storeWordlist(wordlist);
            setInitalized(true);
        }).catch(console.error); // todo: implement global error handler
    }, [])

    const finishedHandler = (word: string) => {
        console.log('executed', word);
        words[activeIndex] = word;
        setWords([...words, ""]);
        setIndex(activeIndex + 1);
    }

    if (!initalized) return null;
    return (
        <>
            <div class={styles['grid-view']}>
                <div class={styles['word-box']}>
                    { iterateWords(words.map((_, i) => <Word 
                        key={`word-${i}`}
                        index={i}
                        selected={activeIndex}
                        onSelected={() => {}}
                        onFinished={finishedHandler}
                    />)) }
                </div>
                <div class={styles.misc}></div>
            </div>
        </>
    );
}
