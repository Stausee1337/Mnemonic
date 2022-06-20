import { render } from 'preact'
import { App } from './app'
import './index.scss'
import { initializeApi } from './api'
import { Rust } from './interface';

initializeApi();
render(<App />, document.getElementById('app')!);
Rust.setInitialized();
