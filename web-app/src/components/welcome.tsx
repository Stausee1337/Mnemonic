import { FunctionComponent } from "preact";
import styles from "./welcome.module.scss";
import { Action, Checkbox, ProgessSpinner } from "../controls";
import { Icon } from "../icons";
import { useRouter } from "../router";
import { useEffect, useState } from "preact/hooks";
import { Config } from "../config";



export const WelcomePage: FunctionComponent = () => {
    const history = useRouter()!.history;
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        Config.globalConfig.generalApp.skipToRetrieve.getOrDefault(false)
            .then(data => setChecked(data));
    }, [])

    const updateSettings = (value: boolean) => {
        setChecked(value);
        Config.globalConfig.generalApp.skipToRetrieve = value as any;
    }

    return (
        <>
            <div class={styles.header}>
                <div class={styles.heading}>
                    <h1 class={styles.caption}>Mnemonic</h1>
                    <p class={styles.subtitle}>Password Memorizer</p>
                </div>
                <div class={styles['cmd-links']}>
                    <h5>Misc</h5>
                    <a 
                        class={styles['cmd-link']}
                        onClick={() => history.push('/settings')}>
                        <Icon height={18} name="settings-gear"/>
                        Preferences
                    </a>
                </div>
            </div>
            <div class={styles.actions}>
                <h5>Actions</h5>
                <Action 
                    content="Generate Mnemonic Phrase"
                    icon={<Icon height={28} name="generate-password"/>} 
                    onClick={() => history.push('/generate')}>
                    Start by generating a Password-Phrase-Pair to secure your accounts
                </Action>
                <Action 
                    content="Retrieve Password from Phrase"
                    icon={<Icon height={28} name="restore-password"/>}
                    onClick={() => history.push('/retrieve')} >
                    Enter your Mnemonic phrase and get back your Password
                </Action>
            </div>
            <div class={styles.footer}>
                <Checkbox checked={checked} onChanged={updateSettings}>Skip to Retrieve Page</Checkbox>
            </div>
        </>
    )
}

export const containerClass = styles['container'];
