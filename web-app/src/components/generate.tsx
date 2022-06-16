import { FunctionComponent, JSX } from "preact";
import { Button, Columns, Center, SpaceFiller, HCenter, ToggleSwitch, Slider, TooltipIcon } from "../controls"
import styles from "./generate.module.scss"
import { random, classNames } from "../utils"
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Rust } from "../interface"
import copyIcon from "../icons/copy.svg"
import updateIcon from "../icons/update.svg"
import printerIcon from "../icons/printer.svg"

const Spacer: FunctionComponent = () => <span class={styles.spacer}></span>

const Word: FunctionComponent = ({ children }) => {
    const [delay, _] = useState(random(0, 300));
    return <span 
        className={styles.word} 
        style={{ animationDelay: `${delay}ms` }}>
        {children}
    </span>
}

export interface PasswordForm {
    characters: boolean,
    digits: boolean,
    punctuation: boolean,
    special: boolean,
    length: number
}

const PasswordSettings: FunctionComponent<{
    data?: PasswordForm,
    onChange: (data: PasswordForm) => void
}> = ({ onChange, data }) => {
    const [characters, setCharacters] = useState(data?.characters ?? true);
    const [digits, setDigits] = useState(data?.digits  ?? true);
    const [punctuation, setPunctuation] = useState(data?.punctuation ?? true);
    const [special, setSpecial] = useState(data?.special ?? false);

    const [length, setLength] = useState(data?.length ?? 48);

    useEffect(() => {
        onChange({
            characters, digits, punctuation, special, length
        })
    }, [characters, digits, punctuation, special, length])

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2>Password Settings</h2>
            <ToggleSwitch checked={characters} onChanged={setCharacters}>Characters</ToggleSwitch>
            <ToggleSwitch checked={digits} onChanged={setDigits}>Numbers</ToggleSwitch>
            <ToggleSwitch checked={punctuation} onChanged={setPunctuation}>Punctuation</ToggleSwitch>
            <ToggleSwitch checked={special} onChanged={setSpecial}>Special Punctuation</ToggleSwitch>
            <span class={styles['length-indicator']} >{length}</span>
            <Slider value={length} onChange={setLength} min={8} max={88}/>
        </div>
    )
}

export const GeneratePage: FunctionComponent<{ config: PasswordForm }> = ({
    config: initialConfig 
}) => {
    const [initialized, setInitialzed] = useState(false);
    const [wordlist, setWordlist] = useState<string[]>(null!);
    const [password, setPassword] = useState<string>(null!);
    const [config, setConfig] = useState(initialConfig);
    const [fontSize, setSize] = useState(3);
    const [fadeR, setFadeR] = useState(false);
    const [fadeL, setFadeL] = useState(false);
    const [animating, setAnimating] = useState(false);
    const pwdContent = useRef<HTMLSpanElement>(null!);

    useEffect(() => {
        Rust.generateMnemonicPhrase(initialConfig).then(data => {
            setWordlist(data.phrase);
            setPassword(data.password);
            setInitialzed(true);
        }).catch(console.error);
    }, []);

    useEffect(() => {
        if (!initialized) return;
        Rust.fromMnemonicPhrase(wordlist, config).then(data => {
            setPassword(data.password);
        }).catch(console.error);
    }, [config]);

    useEffect(() => {
        checkScroll();

        if (password.length < 44 || password.length > 50) return;
        const ratio = 1 - ((password.length - 40) / 10);
        setSize((ratio * 0.5) + 2.5);
    }, [password]);

    useEffect(() => {
        if (animating) {
            setTimeout(() => setAnimating(false), 800);
        }
    }, [animating])

    const checkScroll = () => {
        const element = pwdContent.current;
        if (element.scrollWidth > element.offsetWidth) {
            let value = true;
            if (element.scrollWidth - element.scrollLeft === 730) {
                value = false;
            }
            setFadeR(value);
        } else {
            setFadeR(false);
        }

        setFadeL(element.scrollLeft > 0);
    }

    const clickHandler = async () => {
        Rust.generateMnemonicPhrase(config).then(data => {
            setWordlist(data.phrase);
            setPassword(data.password);
        }).catch(console.error);
    }

    const animationHandler = () => {
        if (!animating) setAnimating(true);
    }

    
    return (
        <div class={styles['generate-grid']}>
            <div 
                onAnimationStart={animationHandler} 
                className={classNames({ 
                    [styles['word-container']]: true,
                    [styles['animating']]: animating
                })}>
                { wordlist ?  wordlist.map((w, i) => <Word key={`${w}-${i}`}>{w}</Word>) 
                    .reduce((prev, cur) => <>{prev} <Spacer/> {cur}</>) : null }
            </div>
            <div 
                id="pwdbox" 
                class={classNames({ 
                    [styles['password-box']]: true, 
                    [styles['fade-r']]: fadeR, 
                    [styles['fade-l']]: fadeL 
                })}>
                <span onScroll={() => checkScroll()} style={{ fontSize: `${fontSize}rem` }} ref={pwdContent}>{ password ? password : null }</span>
            </div>
            <div>
                <div class={styles['controls-container']}>
                    <PasswordSettings data={config} onChange={setConfig}/>
                    <div class={styles['action-sidebar']}>
                        <TooltipIcon tooltip="Copy Password" src={copyIcon} />
                        <TooltipIcon tooltip="Generate Phrase" src={updateIcon} />
                        <TooltipIcon tooltip="Print Mnemonic" src={printerIcon} />
                    </div>
                </div>
            </div>
        </div>
    );
}
