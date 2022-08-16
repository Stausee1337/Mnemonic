import usePopper from "@restart/ui/esm/usePopper";
import { FunctionComponent, JSX } from "preact";
import { MutableRef, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { createPortal } from "preact/compat"
import { Rust } from "../interface";
import { classNames, nullOrUndefined, useSafeState, useValidationState } from "../utils";
import styles from "./restore.module.scss";
import { Button, ExpansionContainer, ExpansionGroup, ProgessSpinner } from "../controls";
import { Icon } from "../icons";
import {
    PasswordForm, 
    passwordGenerationRulesDefault, 
    PasswordOuput,
    PasswordSettings as InnerPassworSettings,
    PhraseData, 
    Word as SimpleWord 
} from "./generate"
import { useNotifier } from "../notification";
import { Config } from "../config";
import { useEventProvider } from "../window";

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
    if (input.length === 0) {
        return []
    }
    return getWordlistWithErrorHandler().filter(predicate => predicate.startsWith(input));
}

function measureText(text: string): number {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = '500 18px / 34px -apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", system-ui, Ubuntu, "Droid Sans", sans-serif';
    return Math.max(ctx.measureText(text).width, 1);
}

interface SuggestionControl {
    incrementSelection(): void;
    decrementSelection(): void;
    readonly selection: number;
}

const Suggestions: FunctionComponent<{
    slice: string,
    suggestions: string[],
    controlRef: MutableRef<SuggestionControl | null>,
    onClick: (idx: number) => void,
}> = ({ slice, suggestions, controlRef, onClick }) => {
    const [selected, setSelected] = useValidationState<number>(
        0,
        value => value >= suggestions.length ? 0 : value < 0 ? suggestions.length-1 : value
    )
    const [hover, setHover] = useState<number>(-1);

    useEffect(() => {
        document.querySelector(`span.${styles.suggestion}.${styles.selected}`)?.scrollIntoViewIfNeeded(false);
    }, [selected])

    controlRef.current = {
        incrementSelection: () => setSelected(selected + 1),
        decrementSelection: () => setSelected(selected - 1),
        selection: selected
    }
    // calculateClassString
    const ccs = (i: number) => classNames({
        [styles.suggestion]: true,
        [styles.selected]: i === selected,
        [styles.hover]: i === hover,
    });
    return (
        <>
            {
                suggestions.map((word, idx) => <span 
                    class={ccs(idx)}
                    onMouseDown={e => { e.stopPropagation(); onClick(idx); }}
                    onMouseOver={() => setHover(idx)}
                >
                    <b>{slice}</b>{word.slice(slice.length)}
                </span>)
            }
        </>
    )
}

const Word: FunctionComponent<{
    onCursorInjection: (where: "before" | "after") => void,
    onEdit: () => void,
    isValid: boolean
}> = ({ children, onCursorInjection, onEdit, isValid }) => {
    const wordMouseDown = (e: JSX.TargetedMouseEvent<HTMLSpanElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const element = e.currentTarget;
        const rect = element.getBoundingClientRect();
        const relativeX = e.clientX - (rect.left - 5);
        if (relativeX > ((rect.width + 10) / 2)) {
            onCursorInjection("after")
        } else {
            onCursorInjection("before")
        }
    }

    const props = {
        valid: isValid ? '' : null,
        invalid: !isValid ? '' : null
    }
    return (
        <span class={styles.word} {...props} onMouseDown={wordMouseDown}>
            { children }
            <span class={styles.content} onDblClick={() => onEdit()} onMouseDown={e => e.stopPropagation()}>{children}</span>
        </span>
    );
}

interface InputControl {
    clear(): void;
    focus(): void;
    validate(): void;
    invalidate(): void;
}

type WordAddEvent = { 
    wordCount: number,
    valid: boolean | null,
    done: boolean,
    phrase: string[] | null
};

const IntelligentWordInput: FunctionComponent<{
    words?: string[],
    controlRef: MutableRef<InputControl | null>,
    onWordAdded: (event: WordAddEvent) => void
}> = ({ controlRef, words: initialWords, onWordAdded }) => {
    const [phraseValid, setPhraseValid] = useState<boolean | null>(null);
    const [words, setWords] = useValidationState<string[]>(initialWords ?? [], value => {
        const done = value.length === 12;
        const valid = done ? value.every(v => validate(v)) : null;
        onWordAdded({
            done,
            valid,
            phrase: valid ? value : null,
            wordCount: value.length,
        });
        return value;
    }); 
    const [slice, setSlice] = useState("");
    const [isEmpty, setIsEmpty] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [slicingIndex, setIndex] = useState(words.length);
    const [input, setInput] = useSafeState<HTMLInputElement | null>(null!);
    const [suggestionContainer, setContainer] = useSafeState<HTMLDivElement | null>(null!);
    const focusRef = useRef(true);
    const suggestionControlRef = useRef<SuggestionControl | null>(null!);

    const popper = usePopper(
        input,
        suggestionContainer,
        {
            placement: "bottom-start",
            modifiers: [
                { name: "offset", options: { offset: [-4, 0] } }
            ]
        }
    )

    useLayoutEffect(() => {
        popper.update();
    }, [slicingIndex, words, slice])
    
    useEffect(() => {
        if (focusRef.current) {
            input?.focus();
        } else {
            focusRef.current = true;
        }
        inputChange();
        updateSlice();
    }, [slicingIndex])

    const emptyChange = () => {
        const inputValue = input?.value ?? "";
        setIsEmpty(words.length === 0 && inputValue.length === 0)
    }

    useEffect(emptyChange, [words])

    controlRef.current = {
        invalidate: () => setPhraseValid(false),
        validate: () => setPhraseValid(true),
        clear: () => {
            setWords([]);
            setIndex(0);
        },
        focus: () => input?.focus()
    };

    const inputChange = () => {
        if (nullOrUndefined(input)) return;
        input!.style.width = `${measureText(input!.value)}px`;
        emptyChange();
    }

    const setCursorAtEnd = (e: JSX.TargetedEvent<HTMLElement>) => {
        if (phraseValid === false) {
            setPhraseValid(null);
        }
        if (input?.value.trim() !== "") {
            words.splice(slicingIndex, 0, input!.value.toLowerCase())
            setWords([...words])
            input!.value = "";
        }
        focusRef.current = false,
        setIndex(words.length);
    }

    const inputKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLInputElement>) => {
        setPhraseValid(null);
        switch (e.code) {
            case "Tab":
                e.preventDefault();
                if (input?.value.trim() !== "") {
                    const word = words.splice(slicingIndex, 1, input!.value.toLowerCase())[0] ?? "";
                    setWords([...words])
                    setIndex(slicingIndex+1);
                    input!.value = word;
                    input!.select();
                } else {
                    const word = words.splice(slicingIndex, 1)[0] ?? "";
                    setWords([...words])
                    input!.value = word;
                    inputChange();
                    input!.select();
                }
                break;
            case "Space":
                {
                    e.preventDefault();
                    let value = (input?.value ?? "").slice(0, input?.selectionStart ?? 0);
                    const rest = (input?.value ?? "").slice(input?.selectionStart!);
                    value = suggestions[suggestionControlRef.current?.selection ?? 0] ?? value;
                    if (value.trim() !== "") {
                        const word = words.splice(slicingIndex, 1, value.toLowerCase())[0] ?? rest;
                        setWords([...words])
                        setIndex(slicingIndex+1);
                        input!.value = word;
                        input!.setSelectionRange(0, 0);
                    }
                }
                break;
            case "Enter": 
                {
                    e.preventDefault();
                    let value = (input?.value ?? "").slice(0, input?.selectionStart ?? 0);
                    value = suggestions[suggestionControlRef.current?.selection ?? 0] ?? value;
                    if (value.trim() !== "") {
                        words.splice(slicingIndex, 0, value)
                        setWords([...words])
                        input!.value = "";
                    }
                    setIndex(words.length);
                }
                break;
            case "Backspace":
                if (input?.selectionStart === 0 && 
                    input?.selectionEnd === 0 &&
                    words.length > 0
                    ) {
                    e.preventDefault();
                    const currentInputLength = input!.value.length;
                    const newWord = words.splice(slicingIndex-1, 1)!;
                    input!.value = newWord + input!.value;
                    input!.selectionStart = input.value.length - currentInputLength;
                    input!.selectionEnd = input.value.length - currentInputLength;
                    setWords([...words])
                    setIndex(words.length);
                }
                break;
            case "ArrowUp":
                e.preventDefault();
                suggestionControlRef.current?.decrementSelection();
                break;
            case "ArrowDown":
                e.preventDefault();
                suggestionControlRef.current?.incrementSelection();
                break;
            default:
                if (e.key.length === 1 && !/^[a-zA-Z]$/.test(e.key)) {
                    e.preventDefault();
                }
                break;
        }
    }

    const updateSlice = () => {
        if (!nullOrUndefined(input)) {
            const slice = input!.value.slice(0, input!.selectionStart ?? 0);
            setSlice(slice);
            setSuggestions(suggest(slice));
        }
    }

    const onClickSelection = (idx: number) => {
        let value = (input?.value ?? "").slice(0, input?.selectionStart ?? 0);
        const rest = (input?.value ?? "").slice(input?.selectionStart!);
        value = suggestions[idx ?? 0] ?? value;
        if (value.trim() !== "") {
            const word = words.splice(slicingIndex, 1, value.toLowerCase())[0] ?? rest;
            setWords([...words])
            setIndex(slicingIndex+1);
            input!.value = word;
            input!.setSelectionRange(0, 0);
        }
        setTimeout(() => input?.focus(), 0);
    }

    // edit handler factory
    const ehf = (idx: number) => () => {
        setPhraseValid(null);
        const word = words.splice(idx, 1)[0] ?? "";
        setWords([...words]);
        setIndex(idx);
        input!.value = word;
        inputChange();
        input!.select();
    }

    // cursor handler factory
    const chf = (idx: number) => (where: "before" | "after") => {
        setPhraseValid(null);
        if (input!.value !== "") {
            words.splice(slicingIndex, 0, input!.value.toLowerCase());
            setWords([...words]);
            input!.value = "";
        }
        switch (where) {
            case "before":
                setIndex(idx)
                break;
            case "after":
                setIndex(idx+1)
                break;
        }
    }

    const validate = (word: string) => getWordlistWithErrorHandler().includes(word);
    const props = { disabled: phraseValid === true ? '' : null, empty: isEmpty ? '' : null } as any;
    return (
        <div {...props} class={styles['styled-box']} onMouseDown={setCursorAtEnd} onClick={() => input?.focus()}>
            <div class={styles.editor}>
                {
                    words.slice(0, slicingIndex)
                        .map((w, i) => <Word 
                            onEdit={ehf(i)} 
                            onCursorInjection={chf(i)}
                            isValid={validate(w) && (phraseValid??true)}
                            >
                            {w}
                        </Word>)
                }
                <input 
                    ref={setInput}
                    onBlur={setCursorAtEnd}
                    onInput={inputChange}
                    onMouseDown={e => e.stopPropagation()}
                    onKeyDown={inputKeyDown}
                    onKeyUp={updateSlice}
                    onPaste={e => e.preventDefault()}
                    onCopy={e => e.preventDefault()}
                    type="text"
                    size={1}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    spellcheck={false}
                />
                {
                    words.slice(slicingIndex, words.length)
                        .map((w, i) => <Word 
                            onEdit={ehf(i+slicingIndex)} 
                            onCursorInjection={chf(i+slicingIndex)}
                            isValid={validate(w) && (phraseValid??true)}>
                                {w}
                            </Word>)
                }
            </div>
            { createPortal((
                <div 
                    { ...popper.attributes.popper }
                    style={(popper.styles.popper) as any}
                    ref={setContainer}
                    class={classNames({
                        [styles['editor-live-suggestions']]: true,
                        [styles['hidden']]: suggestions.length <= 0
                    })}
                >
                    {suggestions.length > 0 ? (<Suggestions
                        slice={slice}
                        suggestions={suggestions}
                        controlRef={suggestionControlRef}
                        onClick={onClickSelection}
                    />) : null}
                </div>), 
                document.body
            ) }
        </div>
    );
}

export const PasswordSettings: FunctionComponent<{
    data: PasswordForm,
    onChange: (data: PasswordForm) => void
}> = ({ data, onChange }) => {
    const notify = useNotifier();

    const saveToDb = () => {
        Config.globalConfig.passwordGenerationRules = data as any;
        const closeFn = notify({
            type: "info",
            content: "Password generation rules saved!"
        })
        setTimeout(() => {
            closeFn();
        }, 3000)
    }

    return (
        <ExpansionGroup>
            <ExpansionContainer
                buttons={[
                    { icon: 'save', onClick: saveToDb }
                ]}
                heading="Password Generation Settings"
                icon={<Icon name="option-sliders" height={28}/>}
                description="Change the length and the type of characters that are included in your password">
                <InnerPassworSettings data={data} onChange={onChange}/>
            </ExpansionContainer>
        </ExpansionGroup>
    );
}

const InputForm: FunctionComponent<{
    onNext: (phrase: string[], config: PasswordForm) => void
}> = ({ onNext }) => {
    const [wordCount, setWordCount] = useState(0);
    const [buttonDisabled, setDisabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const [buttonText, setButtonText] = useState("Submit");
    const inputControlRef = useRef<InputControl | null>(null);
    const [button, setButton] = useSafeState<HTMLButtonElement | null>(null!);
    const [formError, setFormError] = useState("");
    const [config, setConfig] = useState<PasswordForm>(passwordGenerationRulesDefault);

    useEffect(() => {
        Config.globalConfig.passwordGenerationRules.getOrDefault(passwordGenerationRulesDefault)
            .then(rules => {
                setConfig(rules);
            });
    }, [])

    const onWordAdd = (event: WordAddEvent) => {
        setWordCount(event.wordCount);
        setFormError("");
        if (event.done) {
            setDisabled(!event.valid!);
            setLoading(true);
            Rust.checkChecksum(event.phrase!).then(response => {
                if (!response) {
                    setButtonText("Clear");
                    setLoading(false);
                    button!.focus();
                    inputControlRef.current?.invalidate();
                    setFormError("Checksum calculations mismatch; maybe you misstyped something.")
                } else {
                    inputControlRef.current?.validate();
                    setTimeout(() => onNext(event.phrase!, config), 500);
                }
            })
        }
    }

    const onButtonClick = () => {
        if (buttonText === "Submit") {
            setDisabled(true);
            setFormError(`12 words are required. You've got ${wordCount}`);
        } else if (buttonText === "Clear") {
            inputControlRef.current?.clear();
            setButtonText("Submit");
            inputControlRef.current?.focus();
        }
    }

    return (
        <>
            <div class={styles['form-container']}>
                <h6>Mnemonic Phrase</h6>
                <IntelligentWordInput controlRef={inputControlRef} onWordAdded={onWordAdd}/>
                <span class={styles.error}>{ formError }</span>
                <div class={styles['status-bar']}>
                    <h6>{wordCount}/12</h6>
                    <Button ref={setButton} disabled={buttonDisabled} onClick={onButtonClick}>
                        { !loading ? buttonText : <ProgessSpinner size={21} /> }
                    </Button>
                </div>
            </div>
            <div>
                <h6>Settings</h6>
                <PasswordSettings data={config} onChange={setConfig}/>
            </div>
        </>
    );
}

const PasswordDisplay: FunctionComponent<{
    phrase: string[],
    config: PasswordForm
}> = ({ phrase, config: initialConfig }) => {
    const [password, setPassword] = useState<string | null>(null!);
    const [config, setConfig] = useState<PasswordForm>(initialConfig);
    const changesSaved = useRef(false);
    const autoCopy = useRef(true);
    const eventProvider = useEventProvider();

    const notfiy = useNotifier();

    const windowEventListener = async (active: boolean) => {
        const closeOnBlur = await Config.globalConfig.restorePage.closeOnBlur.getOrDefault(true);
        if (!active && changesSaved.current && closeOnBlur) {
            Rust.windowClose();
        }
    }

    eventProvider.on<boolean>("activeChange", windowEventListener);
    eventProvider.on<boolean>("stateChange", windowEventListener);

    useEffect(() => {
        const listener = (e: ClipboardEvent) => {
            e.preventDefault();
            copyPassword(password);
        }
        document.addEventListener('copy', listener);
        return () => {
            document.removeEventListener('copy', listener);
        }
    }, [])

    const copyPassword = (password: string | null) => {
        if (password === null) return;
        const close = notfiy({
            type: "info",
            content: "Password Copied to Clipboard!"
        });
        setTimeout(() => {
            close();
        }, 3000)
        Rust.clipboardWriteTextSecure(password)
            .then(ok => { changesSaved.current = ok; console.log('executed', ok) })
            .catch(console.error); // todo: call global error handler        
    }
    useEffect(() => {
        Rust.fromMnemonicPhrase<PasswordForm, PhraseData>(phrase, config).then(data => {
            setPassword(data.password);
            if (autoCopy.current) {
                autoCopy.current = false;
                copyPassword(data.password);
            }
        }).catch(console.error);  // todo: call global error handler
    }, [config]);

    return (
        <>
            <h6>Mnemonic</h6>
            <div class={`${styles['styled-box']} ${styles.simple} ${styles.flex}`}>
                { phrase.map(w => <SimpleWord>{w}</SimpleWord>) }
            </div>
            <PasswordSettings 
                data={config} 
                onChange={e => {
                    changesSaved.current = false;
                    setConfig(e);
                }}/>
            <h6 class={styles['output-heading']}>
                Password Output
                <button 
                    onClick={() => copyPassword(password)}
                    class={styles['copy-button']}>
                        <Icon name="copy"/>
                </button>
            </h6>
            <div class={`${styles['styled-box']} ${styles.simple} ${styles['hover-action']}`}>
                <PasswordOuput entropy={0} password={password ?? ""}/>
            </div>
        </>
    );
}

export const RestorePage: FunctionComponent = () => {
    const [page, setPage] = useState<"form" | "password">("form");
    const phraseRef = useRef<string[] | null>([]);
    const configRef = useRef<PasswordForm | null>(null!);

    useEffect(() => {
        Rust.getWordlist().then(data => {
            let wordlist = data.split('\r\n')
            wordlist.pop()
            wordlist = wordlist.sort((a, b) => a.localeCompare(b))
            storeWordlist(wordlist);
        }).catch(console.error); // todo: implement global error handler
    })

    return (
        <div class={classNames([ styles['grid-container'], styles[page] ])}>
            { (page === "form" ? (
                <InputForm 
                    onNext={(phrase, config) => {
                        phraseRef.current = phrase;
                        configRef.current = config;
                        setPage("password"); 
                    }}/>
            ) : (
                <PasswordDisplay config={configRef.current!} phrase={phraseRef.current!}/>
            )) }
        </div>
    );
}
