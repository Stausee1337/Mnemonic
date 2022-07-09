import { FunctionComponent } from 'preact';
import { GeneratePage } from './components/generate'
import { RestorePage } from './components/restore';
import { WelcomePage } from './components/welcome';
import { Switch, Case, TitleBar } from './controls'
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
            <TitleBar/>
            <div id="page-content">
                <Switch>
                    <Case id="start-page" index>
                        <WelcomePage/>
                    </Case>
                    <Case id="generate">
                        <GeneratePage config={config}/>
                    </Case>
                    <Case id="restore">
                        <RestorePage/>
                    </Case>
                </Switch>
            </div>
        </NotificationProvider>
    )
}
