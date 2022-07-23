import { FunctionComponent } from 'preact';

import { GeneratePage } from './components/generate'
import { RestorePage } from './components/restore';
import { WelcomePage, containerClass } from './components/welcome';
import { Breadcrumb, TitleBar } from './controls';
import { Icon } from './icons';
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
                    <Breadcrumb/>
                    <RouterOutlet>
                        {   path => {
                                switch (path) {
                                    case '/':
                                        return { 
                                            element: <WelcomePage/>,
                                            data: {
                                                title: "Get Started - Mnemonic",
                                                class: containerClass,
                                                heading: "Home"
                                            }
                                        };
                                    case '/generate':
                                        return {
                                            element: <GeneratePage config={config}/>,
                                            data: {
                                                title: "Generate - Mnemonic",
                                                heading: "Generate"
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
