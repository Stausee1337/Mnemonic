import { FunctionComponent } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { rustInterface } from './api';
import { GeneratePage } from './components/generate'
import { RestorePage } from './components/restore';
import { SettingsPage } from './components/settings';
import { WelcomePage, containerClass } from './components/welcome';
import { Config } from './config';
import { Breadcrumb, CustomScrollbar, TitleBar } from './controls';
import { Rust } from './interface';
import { NotificationProvider } from './notification';
import { RouterOutlet, useRouter } from './router';
import { getLocationContext, LocationContextType } from './window';

export const App: FunctionComponent = () => {
    const [contentContainer, setContaienr] = useState<HTMLDivElement | null>(null!);
    const locationContext = getLocationContext();
    const router = useRouter();

    useEffect((async () => {
        const skp2r = await Config.globalConfig.generalApp.skipToRetrieve.getOrDefault(false);
        if (locationContext === "Auto") {
            if (skp2r) {
                router?.history.push('/retrieve')
            }
        } else {
            router?.history.push(`/${locationContext.toLowerCase()}`)
        }
        Rust.pageContentLoaded()
    }) as any, [])
    
    return (
        <NotificationProvider>
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
                                        element: <GeneratePage/>,
                                        data: {
                                            title: "Generate - Mnemonic",
                                            heading: "Generate"
                                        }
                                    };
                                case '/generate/print':
                                    return {
                                        element: <></>,
                                        data: {
                                            title: "Generate (Printing) - Mnemonic",
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
                                case '/settings':
                                    return {
                                        element: <SettingsPage/>,
                                        data: {
                                            title: "Preferences - Mnemonic",
                                            heading: "Global Settings"
                                        }
                                    }
                                default:
                                    return { element: <h1>Not Found</h1> };
                            }
                        } 
                    }
                </RouterOutlet>
            </div>
        </NotificationProvider>
    )
}
