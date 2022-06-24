import usePopper from "@restart/ui/esm/usePopper";
import { FunctionComponent, JSX } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { forwardRef } from "preact/compat"
import { Rust } from "../interface";
import { classNames, useValidationState } from "../utils";
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

interface SuggestionComponent {
    incrementSelection(): void;
    decrementSelection(): void;
}

type SuggestionUpdateEvent = {
    suggestionAmmount: number,
    currentSelection: string,
    isClick: boolean
};

type SuggestionsProps = { 
    input: string,
    onUpdate: (event: SuggestionUpdateEvent) => void
};

const Suggestions = forwardRef<SuggestionComponent, SuggestionsProps>(({ 
    input, onUpdate
}, ref) => {
    const [selected, setSelected] = useValidationState<number>(
        0,
        value => value >= suggestions.length ? 0 : value < 0 ? suggestions.length-1 : value
    )
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [clicked, setClick] = useState<boolean>(false);

    useEffect(() => {
        onUpdate({
            suggestionAmmount: suggestions.length,
            currentSelection: suggestions[selected] ?? null!,
            isClick: false
        });
    }, [selected])

    useEffect(() => {
        const newSuggestions = suggest(input);
        setSuggestions(newSuggestions);
        if (selected >= newSuggestions.length) {
            setSelected(0);
        }
    }, [input])

    useEffect(() => {
        onUpdate({
            suggestionAmmount: suggestions.length,
            currentSelection: suggestions[selected] ?? null!,
            isClick: false
        });
    }, [suggestions])

    if (ref) {
        const component: SuggestionComponent = (ref as any).current = {
            incrementSelection: () => setSelected(selected + 1),
            decrementSelection: () => setSelected(selected - 1)
        }
    }

    // calculateClassString
    const ccs = (i: number) => classNames({
        [styles.suggestion]: true,
        [styles.selected]: i === selected,
    });
    return (
        <>
            {
                suggestions.map((word, idx) => <span 
                    class={ccs(idx)}
                    onClick={() => onUpdate({
                        suggestionAmmount: suggestions.length,
                        currentSelection: suggestions[idx] ?? null!,
                        isClick: true,
                    })}
                >
                    {input}<b>{word.slice(input.length)}</b>
                </span>)
            }
        </>
    )
});

type ObserverWrapperType = {
    callback: ResizeObserverCallback | null,
    observer: ResizeObserver
};

function getTextLength(text: string): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = "2.5rem 'Helvetica Neue', arial, sans-serif"
    return ctx.measureText(text).width;
}

const Word: FunctionComponent<{ 
    index: number, 
    selected: number,
    onSelected: (newIndex: number) => void, 
    onFinished: (content: string) => void
}> = ({ 
    index, selected, onSelected, onFinished
}) => {
    const [wordContainer, setSpan] = useState<HTMLSpanElement | null>(null);
    const [suggestionContainer, setSuggestionContainer] = useState<HTMLSpanElement | null>(null);
    const [input, setInput] = useState<HTMLInputElement | null>(null);
    const suggestion = useRef<SuggestionComponent>(null);

    const [active, setActive] = useState(false);
    const [value, setValue] = useState("");
    const [selectedState, setSelected] = useState<SuggestionUpdateEvent>({
        suggestionAmmount: null!,
        currentSelection: null!,
        isClick: false
    })

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
        if (suggestionContainer)
            observerWrapper.observer.observe(suggestionContainer);
        return () => observerWrapper.observer.disconnect();
    }, [suggestionContainer])

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
        if (selectedState.isClick) {
            finish();
        }
    }, [selectedState.isClick])

    useEffect(() => {
        if (input === null || wordContainer === null) return;
        input.style.minWidth = (null as any);
        input.style.width = `${getTextLength(value)}px`;
        wordContainer.dataset.text = value.trimEnd();
    }, [!active && value.length > 0])

    useLayoutEffect(() => {
        popper.forceUpdate();
    }, [active && value.length]);

    observerWrapper.callback = (entries) => {
        if (suggestionContainer === null) return;
        console.log(entries.length);
        if (entries.length > 1) return;

        const event = entries[0];
        if (event.target === wordContainer) {
            // suggestionContainer.style.minWidth = `${wordContainer.offsetWidth}px`
        } else if (event.target === suggestionContainer) {
            console.log(event.contentRect.width);
            const newWidth = event.contentRect.width - 40; 
            input!.style.minWidth = newWidth > 120 ? `${newWidth}px` : `120px`;
        }
    };
    
    const inputHandler = () => {
        if (input === null) return;
        setValue(input.value);
        input.parentElement!.dataset.text = input.value;
    };

    const finish = () => {
        if (selectedState.currentSelection === null) return;
        setValue(selectedState.currentSelection);
        onFinished(selectedState.currentSelection);
    };

    const keyHandler = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
        if (['ArrowUp', 'ArrowDown', 'Enter'].includes(e.key)) {
            e.preventDefault();

            switch(e.key) {
                case 'ArrowUp':
                    if (suggestion.current)
                        suggestion.current.decrementSelection();
                    break;
                case 'ArrowDown':
                    if (suggestion.current)
                        suggestion.current.incrementSelection();
                    break;
                case 'Enter':
                    finish();
                    break;
            }
        }
    }

    const suggestionActive = active && value.length > 0 && selectedState.suggestionAmmount > 0 ? styles['suggestion-active'] : ''
    return (
        <span ref={setSpan} class={`${styles['word']} ${styles[validationClass ?? '']} ${suggestionActive}`}>
            <input 
                onInput={inputHandler} 
                onKeyDown={keyHandler}
                type="text"
                autoCapitalize="off" autoComplete="off" autoCorrect="off" spellcheck={false}
                ref={setInput}
                onFocus={() => onSelected(index)}
                value={value}
                size={1}/>
            { active ? (
            <span 
                {...popper.attributes.popper}
                style={popper.styles['popper'] as any}
                ref={setSuggestionContainer} 
                class={`${styles['suggestion-container']} ${value.length > 0 ? styles['show'] : ''}`}
            >
                { value.length > 0 ? 
                    <Suggestions 
                        ref={suggestion}
                        input={value} 
                        onUpdate={setSelected}
                        /> : null }
            </span>): null
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
