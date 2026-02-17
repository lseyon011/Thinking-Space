import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, BrowserRouter } from 'react-router-dom'
import App from './App'
import { MarkdownViewerProvider } from './components/orchestrators/MarkdownViewerOrch'
import { isElectron } from './services/orchestrators/runtimeOrch'
import './index.css'

// Electron uses HashRouter (no server to handle routes).
// Web uses BrowserRouter with the /ltm-pilot prefix.
const Router = isElectron() ? HashRouter : BrowserRouter
const routerProps = isElectron() ? {} : { basename: '/ltm-pilot' }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router {...routerProps}>
      <MarkdownViewerProvider>
        <App />
      </MarkdownViewerProvider>
    </Router>
  </React.StrictMode>,
)
