import { FunctionComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { GeneratePage } from './components/generate'
import { RestorePage } from './components/restore';
import { WelcomePage, containerClass } from './components/welcome';
import { Config } from './config';
import { Breadcrumb, CustomScrollbar, TitleBar } from './controls';
import { NotificationProvider } from './notification';
import { RouterOutlet, useRouter } from './router';

export const App: FunctionComponent = () => {
    const [contentContainer, setContaienr] = useState<HTMLDivElement | null>(null!);
    const router = useRouter();

    useEffect(() => {
        Config.globalConfig.generalApp.skipToRetrieve.getOrDefault(false)
            .then(skp2r => {
                if (skp2r) {
                    router?.history.push('/retrieve')
                }
            })
    }, [])
    
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
