import { FunctionComponent, VNode } from "preact";
import styles from "./welcome.module.scss";
import { Checkbox, useNavigation } from "../controls";
import { Icon } from "../icons";

export const Action: FunctionComponent<{
    content: string,
    icon?: VNode<typeof Icon>,
    onClick?: () => void
}> = ({ content, icon, onClick, children }) => (
    <button onClick={onClick} class={styles.action}>
        <h3 class={styles['main-content']}>{ content }</h3>
        <span class={styles.description}>{children}</span>
        <span class={styles['hover-arrow']}/>
        <span class={styles['icon-container']}>
            {icon}
        </span>
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
                <Action content="Generate Mnemonic Phrase" icon={<Icon width={35} name="generate-password"/>} onClick={() => navigate('generate')}>
                    Start by generating a Password-Phrase-Pair to secure your accounts
                </Action>
                <Action content="Retrieve Password from Phrase" icon={<Icon width={35} name="restore-password"/>} onClick={() => navigate('restore')}>
                    Enter your Mnemonic phrase and get back your Password
                </Action>
            </div>
            <div class={styles.footer}>
                <Checkbox>Skip to retrieve page</Checkbox>
            </div>
        </div>
    )
}
