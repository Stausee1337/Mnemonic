import { render } from 'preact'
import { App } from './app'
import './index.scss'
import { initializeApi, establishChannel } from './api'
import { Rust } from './interface';

initializeApi();
render(<App />, document.getElementById('app')!);
Rust.setInitialized();

establishChannel("window-events").subscribe(console.log)
