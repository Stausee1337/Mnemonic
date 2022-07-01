import { FunctionComponent } from "preact";
import styles from "./welcome.module.scss";
import generateIcon from "../icons/generate-password.svg";
import restoreIcon from "../icons/restore-password.svg";
import { Checkbox, useNavigation } from "../controls";

export const Action: FunctionComponent<{
    content: string,
    icon?: string,
    onClick?: () => void
}> = ({ content, icon, onClick, children }) => (
    <button onClick={onClick} class={styles.action} style={{ '--mn-action-icon-src': `url("${icon}")` }}>
        <h3 class={styles['main-content']}>{ content }</h3>
        <span class={styles.description}>{children}</span>
        <span class={styles['hover-arrow']}/>
    </button>
)

export const WelcomePage: FunctionComponent = () => {
    const navigate = useNavigation();

    return (
        <div class={styles.container}>
            <div class={styles.header}>
                <h1 class={styles.caption}>Mnemonic</h1>
                <p class={styles.subtitle}>Password Memorizer</p>
            </div>
            <div class={styles.actions}>
                <Action content="Generate Mnemonic Phrase" icon={generateIcon} onClick={() => navigate('generate')}>
                    Start by generating a Password-Phrase-Pair to secure your accounts
                </Action>
                <Action content="Retrieve Password from Phrase" icon={restoreIcon} onClick={() => navigate('restore')}>
                    Enter your Mnemonic phrase and get back your Password
                </Action>
            </div>
            <div class={styles.footer}>
                <Checkbox>Skip to retrieve page</Checkbox>
            </div>
        </div>
    )
}
