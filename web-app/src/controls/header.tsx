
import preact from 'preact';

export interface HeaderProps {
    children: string,
    subtitle?: string
}

export const Header: preact.FunctionComponent<HeaderProps> = (props) => {
    return (
        <>
            <h1 style={{margin: 0}}>{ props.children }</h1>
            { props.subtitle ? <span>{ props.subtitle }</span> : null}
        </>
    )
}
