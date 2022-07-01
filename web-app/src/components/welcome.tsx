import { FunctionComponent } from "preact";
import styles from "./welcome.module.scss";
import generateIcon from "../icons/generate-password.svg";
import restoreIcon from "../icons/restore-password.svg";

export const Action: FunctionComponent<{
    content: string,
    icon?: string
}> = ({ content, icon, children }) => (
    <button class={styles.action} style={{ '--mn-action-icon-src': `url("${icon}")` }}>
        <h3 class={styles['main-content']}>{ content }</h3>
        <span class={styles.description}>{children}</span>
        <span class={styles['hover-arrow']}/>
    </button>
)

export const WelcomePage: FunctionComponent = () => {
    return (
        <div class={styles.container}>
            <h1 class={styles.caption}>Mnemonic</h1>
            <p class={styles.subtitle}>Password Memorizer</p>
            <div class={styles.actions}>
                <Action content="Generate Mnemonic Phrase" icon={generateIcon}>
                    Start by generating a Password-Phrase-Pair to secure your accounts
                </Action>
                <Action content="Retrieve Password from Phrase" icon={restoreIcon}>
                    Enter your Mnemonic phrase and get back your Password
                </Action>
            </div>
        </div>
    )
}
