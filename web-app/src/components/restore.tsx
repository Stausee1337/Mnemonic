import usePopper from "@restart/ui/esm/usePopper";
import { FunctionComponent, JSX } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { forwardRef } from "preact/compat"
import { Rust } from "../interface";
import { classNames, useForceUpdate, useValidationState } from "../utils";
import styles from "./restore.module.scss";
import { useValidation, ValidatorModel } from "../validation";
import { Button } from "../controls";
import { NavigationFinished, RouteEvent, useRouter } from "../router";
import { filter } from "rxjs";

type WordClassType = 'gray' | 'blue' | 'green' | 'red' | 'flushing';

function storeWordlist(wordlist: string[]) {
    (window as any)['wordlist'] = wordlist;
}

function getWordlist(): string[] | null {
    let wordlist = (window as any)['wordlist'];
    if (!wordlist) return null;
    return wordlist as any;
}

function getWordlistWithErrorHandler(): string[] {
    const wordlist = getWordlist();
    if (wordlist === null) {
        // todo: call global error handler
        throw Error('Cant open wordlist');
    }
    return wordlist;
}

function suggest(input: string): string[] {
    return getWordlistWithErrorHandler().filter(predicate => predicate.startsWith(input)).slice(0, 5);
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
        (ref as any).current = {
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
                    onMouseOver={() => setSelected(idx)}
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
    active: boolean,
    current: boolean,
    parentControls: PassedControlFunctions,
    onSelected: () => void,
}> = ({ 
    active, current, onSelected, parentControls
}) => {
    const forceUpdate = useForceUpdate();
    const [wordContainer, setSpan] = useState<HTMLSpanElement | null>(null);
    const [suggestionContainer, setSuggestionContainer] = useState<HTMLSpanElement | null>(null);
    const [input, setInput] = useState<HTMLInputElement | null>(null);
    const suggestion = useRef<SuggestionComponent>(null);

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
    );

    const validation = useValidation({
        required: v => Boolean(v.length),
        wordlist: v => getWordlistWithErrorHandler().includes(v)
    });

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
        if (active) {
            input?.focus();
        }
    }, [active, input]);

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

    useEffect(() => {
        if (active && !current) {
            validation.clear();
            validation.validate(value);
            forceUpdate();
            if (input) {
                input.style.width = (null as any);
                input.select();
            }
        }
    }, [active, current])

    useLayoutEffect(() => {
        popper.forceUpdate();
    }, [active && value.length && selectedState.suggestionAmmount]);

    observerWrapper.callback = (entries) => {
        if (suggestionContainer === null) return;
        if (entries.length > 1) return;

        const event = entries[0];
        if (event.target === suggestionContainer) {
            const newWidth = event.contentRect.width - 40; 
            input!.style.minWidth = newWidth > 120 ? `${newWidth}px` : `120px`;
        }
    };
    
    const inputHandler = () => {
        if (input === null) return;
        setValue(input.value);
        input.parentElement!.dataset.text = input.value;
    };

    const changeWord = () => {
        if (!active) return false;
        if (value.length > 0) {
            validation.finish(value);
            parentControls.setValue(value);
            validation.dirty = true;
            return false;
        }
    }

    const finish = () => {
        const predictedValue = selectedState?.currentSelection ?? input?.value;
        if (validation.finish(predictedValue)) {
            setValue(selectedState.currentSelection);
            parentControls.setValue(selectedState.currentSelection);
            parentControls.spawnNew();
            validation.dirty = true;
        } else {
            forceUpdate();
        }
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
        } else if (e.key === 'Tab') {
            if (changeWord()) {
                e.preventDefault();
            }
        }
    }

    const focusHandler = () => {
        onSelected();
    }

    const blurHandler = () => {
        if (active) {
            validation.finish(value);
            parentControls.setValue(value);
            validation.dirty = true;
        }
    }

    const valid2 = {
        valid: validation.valid,
        invalid: !validation.valid,
        touched: validation.touched,
        pristine: !validation.touched,
        dirty: validation.dirty,
        clean: !validation.dirty
    }

    const dynamicProps = { 
        'placement-up': popper.placement === "top-start" ? '' : null,
        'placement-down': popper.placement === "bottom-start" ? '' : null,
        'active': active ? '' : null,
        'inactive': !active ? '' : null
    }
    return (
        <span ref={setSpan} 
            class={classNames({
                [styles.word]: true,
                [styles['suggestion-active']]: active && value.length > 0 && selectedState.suggestionAmmount > 0,
                [styles.valid]: validation.touched && validation.dirty && validation.valid && !active,
                [styles.invalid]: validation.touched && validation.dirty && !validation.valid,
            })}
            {...dynamicProps}
            data-validation={Object.entries(valid2).filter(([_, b]) => b).map(([k, _]) => k).join(' ')}
        >
            <ValidatorModel onChange={inputHandler} validation={validation}>
                <input
                    onBlur={!current ? blurHandler : undefined}
                    onFocus={!active ? focusHandler : undefined}
                    onKeyDown={keyHandler}
                    type="text"
                    autoCapitalize="off" autoComplete="off" autoCorrect="off" spellcheck={false}
                    ref={setInput}
                    value={value}
                    size={1}/>
            </ValidatorModel>
            { active ? (
            <span 
                {...popper.attributes.popper}
                style={popper.styles['popper'] as any}
                ref={setSuggestionContainer} 
                class={`${styles['suggestion-container']} ${value.length > 0 && selectedState.suggestionAmmount > 0 ? styles['show'] : ''}`}
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

type PassedControlFunctions = {
    setValue: (value: string) => void,
    spawnNew: () => void,
    selectNext: () => void,
};

export const RestorePage: FunctionComponent = () => {
    const [activeIndex, setIndex] = useState(-1);
    const [words, setWords] = useState([""]);
    const [isSNCMode, setSNC] = useState(false); // SelectedNonCurrent

    const router = useRouter()!;

    useEffect(() => {
        const subscribtion = router.events.pipe(
            filter((e: RouteEvent): e is NavigationFinished => e instanceof NavigationFinished)
        ).subscribe({
            next() {
                setIndex(0);
                subscribtion.unsubscribe();
            }
        })

        Rust.getWordlist().then(data => {
            let wordlist = data.split('\r\n')
            wordlist.pop()
            wordlist = wordlist.sort((a, b) => a.localeCompare(b))
            storeWordlist(wordlist);
        }).catch(console.error); // todo: implement global error handler
    }, [])

    const functions: PassedControlFunctions = {
        setValue(word) {
            words[activeIndex] = word;
        },
        spawnNew() {
            if (words.length === 12) {
                setIndex(-1);
                document.body.focus();
                return;
            }
            console.log(isSNCMode, activeIndex, words.length);
            if (!isSNCMode) {
                setWords([...words, ""]);
                setIndex(activeIndex + 1);
            } else {
                setIndex(words.length - 1);
                setSNC(false);
            }
        },
        selectNext() {
            if (activeIndex === words.length-1) {
                functions.spawnNew();
            }
            setIndex(activeIndex + 1);
        },
    };

    // selectionHandlerFactory
    const shf = (idx: number) => () => {
        console.log(idx);
        setIndex(idx);
        setSNC(words.length-1 !== idx);
    }

    return (
        <>
            <h3>Restore</h3>
            <div class={styles['grid-view']}>
                <div class={styles['word-box']}>
                    { iterateWords(words.map((_, i) => <Word 
                        key={`word-${i}`}
                        active={i === activeIndex}
                        current={words.length-1 === i}
                        parentControls={i === activeIndex ? functions : null!}
                        onSelected={shf(i)}
                    />)) }
                </div>
                <div class={styles.misc}>
                    <Button>Calculate Password</Button>
                </div>
            </div>
        </>
    );
}
