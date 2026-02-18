import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, BrowserRouter } from 'react-router-dom'
import App from './App'
import { MarkdownViewerProvider } from './components/orchestrators/MarkdownViewerOrch'
import { isElectron, isCapacitorNative } from './services/orchestrators/runtimeOrch'
import './index.css'

// Electron and Capacitor use HashRouter (no server to handle routes).
// Web uses BrowserRouter with the /ltm-pilot prefix.
const isLocalApp = isElectron() || isCapacitorNative()
const Router = isLocalApp ? HashRouter : BrowserRouter
const routerProps = isLocalApp ? {} : { basename: '/ltm-pilot' }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router {...routerProps}>
      <MarkdownViewerProvider>
        <App />
      </MarkdownViewerProvider>
    </Router>
  </React.StrictMode>,
)
