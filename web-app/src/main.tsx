import { render } from 'preact'
import { App } from './app'
import './index.scss'
import { initializeApi, establishChannel } from './api'
import { Rust } from './interface';
import './config';
import { RouterProvider } from './router';

initializeApi();
render((
    <RouterProvider>
        <App />
    </RouterProvider>
), document.getElementById('app')!);

Rust.setInitialized();
