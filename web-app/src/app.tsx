import { FunctionComponent } from 'preact';
import { useRef, useState } from 'preact/hooks';

import { GeneratePage } from './components/generate'
import { RestorePage } from './components/restore';
import { WelcomePage, containerClass } from './components/welcome';
import { Breadcrumb, CustomScrollbar, TitleBar } from './controls';
import { Icon } from './icons';
import { NotificationProvider } from './notification';
import { RouterOutlet, RouterProvider } from './router';
import { ConfigData } from './types';

export const App: FunctionComponent = () => {
    const [contentContainer, setContaienr] = useState<HTMLDivElement | null>(null!);

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
                <Breadcrumb/>
                <div ref={setContaienr} id="page-content">
                    <CustomScrollbar referenceElement={contentContainer}/>
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
                                    case '/generate/print':
                                        return {
                                            element: <></>,
                                            data: {
                                                heading: "Printing"
                                            }
                                        }
                                    case '/retrieve':
                                        return {
                                            element: <RestorePage/>,
                                            data: {
                                                title: "Retrieve - Mnemonic",
                                                heading: "Retrieve"
                                            }
                                        }
                                    case '/retrieve/settings':
                                        return {
                                            element: <h1>Not Found</h1>,
                                            data: {
                                                title: "Password Settings - Mnemonic",
                                                heading: "Settings"
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
