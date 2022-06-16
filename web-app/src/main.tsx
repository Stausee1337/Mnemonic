import { render } from 'preact'
import { App } from './app'
import './index.scss'
import { initializeApi } from './api'

initializeApi();
render(<App />, document.getElementById('app')!)
