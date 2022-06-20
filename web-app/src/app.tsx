import { GeneratePage } from './components/generate'
import { RestorePage } from './components/restore';
import { Header, Columns, SpaceFiller, Button, HCenter, Switch, Case, useNavigation } from './controls'
import { NotificationProvider } from './notification';
import { ConfigData } from './types';
const demoWords = [
    'anaphase', 'floods', 'hoofing', 'signalised', 'fosses', 'chariest',
    'multiplicand', 'plover', 'plucking', 'galligaskin', 'thrifty', 'claypans', 
]


export function StartPage() {
    const demo = demoWords.map(word => <>{word}</>)
        .reduce((prev, cur) => <>{prev} <strong>-</strong> {cur}</>);
    const navigate = useNavigation();

    return (
        <>
            <Columns>
                <SpaceFiller>
                    <h2 style={{ textAlign: 'center' }}>Generate</h2>
                    <h3>What's the problem?</h3>
                    <p>
                        Our brains are incredibly bad at remembering a 12 character random password,
                        so we've come up with the idea of Mnemonic.
                    </p>
                    <h3>How it works</h3>
                    <p>
                        Mnemonic will give you 12 random words picked from our <strong>wordlist</strong>.
                        For example:
                    </p>

                    <blockquote>
                        {demo}
                    </blockquote>

                    <p>
                        Those need to be rememberd by you in some way. At best would be if you strore them in your brain,
                        but having a physical backup copy, like a piece of paper, wouldn't matter the worse.
                    </p>
                    
                    <h3>How about generating your first Mnemoinc phrase?</h3>                    

                    <HCenter>
                        <Button onClick={() => navigate('generate')} >Generate Mnemonic</Button>
                    </HCenter>
                </SpaceFiller>
                <SpaceFiller>
                    <h2 style={{ textAlign: 'center' }}>Reconstruct</h2>

                    <p>
                        Your password can be reconstructed, by entering the 12 words, from the generate step.<br/>
                        Mnemonic will reconstruct you a (pseudo)random password from your words, via a cryptographic
                        function
                        (To the words in generate step):
                    </p>

                    <blockquote>
                        <strong>Password: <br/></strong>
                        uqTz&gt;o^9KH]wdK:6i:jma^#/.51WYCHnH%*Eu@'
                    </blockquote>

                    <p>
                        The password will be the same for the same words, and the same settings. The length of the password, for example, can be varied, to fit your
                        personal needs.
                    </p>

                    <p>
                        For extra conviniece our input fiels have autocompletion and the Mnemonic phrase contains 
                        a checksum to figure out if you misstyped your phrase.
                    </p>

                    <label style={{ display: 'block', marginBottom: '1rem' }} for="_checkbox" >
                        <input type="checkbox" id="_checkbox" />
                        Always skip to resotre page
                    </label>
                    <HCenter>
                        <Button onClick={() => navigate('restore')}>Restore Password</Button>
                    </HCenter>
                </SpaceFiller>
            </Columns>
            <HCenter>
                <span style={{ display: 'block', color: '#ff3333', fontSize: '1.2rem', marginBottom: '0.5rem' }} >
                    Don't use this example as your password, they aren't secure anymore!
                </span>
            </HCenter>
        </>
    )
}

export function App() {
    const config: ConfigData = {
        characters: true,
        digits: true,
        punctuation: true,
        special: false,
        length: 48
    };
    
    return (
        <NotificationProvider>
            <Header>Mnemonic</Header>
            <Switch>
                <Case id="start-page" index>
                    <StartPage/>
                </Case>
                <Case id="generate">
                    <GeneratePage config={config}/>
                </Case>
                <Case id="restore">
                    <RestorePage/>
                </Case>
            </Switch>
        </NotificationProvider>
    )
}
