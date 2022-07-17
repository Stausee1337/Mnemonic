import { FunctionComponent } from 'preact';

import { GeneratePage } from './components/generate'
import { RestorePage } from './components/restore';
import { WelcomePage } from './components/welcome';
import { TitleBar } from './controls';
import { NotificationProvider } from './notification';
import { RouterOutlet, RouterProvider } from './router';
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
            <RouterProvider>
                <TitleBar/>
                <div id="page-content">
                    <RouterOutlet>
                        {   path => {
                                switch (path) {
                                    case '/':
                                        return { 
                                            element: <WelcomePage/>,
                                            data: {
                                                title: "Get Started - Mnemonic"
                                            }
                                        };
                                    case '/generate':
                                        return {
                                            element: <GeneratePage config={config}/>,
                                            data: {
                                                title: "Generate - Mnemonic"
                                            }
                                        };
                                    case '/retrieve':
                                        return {
                                            element: <RestorePage/>,
                                            data: {
                                                title: "Retrieve - Mnemonic"
                                            }
                                        }
                                    default:
                                        return { element: <h1>Not Found</h1> };
                                }
                            } 
                        }
                    </RouterOutlet>
                </div>
            </RouterProvider>
        </NotificationProvider>
    )
}
