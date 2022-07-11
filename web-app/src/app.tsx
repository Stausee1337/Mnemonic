import { FunctionComponent } from 'preact';
import { GeneratePage } from './components/generate'
import { RestorePage } from './components/restore';
import { WelcomePage } from './components/welcome';
import { Switch, Case, TitleBar, Navigation } from './controls'
import { NotificationProvider } from './notification';
import { ConfigData } from './types';

export const App: FunctionComponent = () => {
    const config: ConfigData = {
        characters: true,
        digits: true,
        punctuation: true,
        special: false,
        length: 48
    };
    
    return (
        <NotificationProvider>
            <Navigation>
                <TitleBar/>
                <div id="page-content">
                    <Switch>
                        <Case id="start-page" title="Get Started - Mnemonic" index>
                            <WelcomePage/>
                        </Case>
                        <Case id="generate" title="Generate - Mnemonic">
                            <GeneratePage config={config}/>
                        </Case>
                        <Case id="restore" title="Restore - Mnemonic">
                            <RestorePage/>
                        </Case>
                    </Switch>
                </div>
            </Navigation>
        </NotificationProvider>
    )
}
