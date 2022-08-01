import { FunctionComponent } from "preact";
import styles from "./welcome.module.scss";
import { Action, Checkbox, ProgessSpinner } from "../controls";
import { Icon } from "../icons";
import { useRouter } from "../router";



export const WelcomePage: FunctionComponent = () => {
    const history = useRouter()!.history;

    return (
        <>
            <div class={styles.header}>
                <h1 class={styles.caption}>Mnemonic</h1>
                <p class={styles.subtitle}>Password Memorizer</p>
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
                <Checkbox>Skip to retrieve page</Checkbox>
            </div>
        </>
    )
}

export const containerClass = styles['container'];
