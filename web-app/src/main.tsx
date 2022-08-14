import { render } from 'preact'
import { App } from './app'
import './index.scss'
import { initializeApi, establishChannel } from './api'
import { Rust } from './interface';
import './config';
import { RouterProvider } from './router';
import { Resetable, installWindowEventHook } from './window';

initializeApi();
render((
    <Resetable>
        <RouterProvider>
            <App />
        </RouterProvider>
    </Resetable>
), document.getElementById('app')!);
installWindowEventHook();
