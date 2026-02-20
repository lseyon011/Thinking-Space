import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, BrowserRouter } from 'react-router-dom'
import App from './App'
import { MarkdownViewerProvider } from './components/orchestrators/MarkdownViewerOrch'
import { UILayoutProviderBlock } from './components/lego_blocks/UILayoutBlock'
import { UIThemeProviderBlock } from './components/lego_blocks/UIThemeBlock'
import { isElectron, isCapacitorNative } from './services/orchestrators/runtimeOrch'
import './index.css'

// Electron and Capacitor use HashRouter (no server to handle routes).
// Web uses BrowserRouter with /thinking-space. Keep /ltm-pilot support for legacy links.
const isLocalApp = isElectron() || isCapacitorNative()
const Router = isLocalApp ? HashRouter : BrowserRouter
const webBasename = window.location.pathname.startsWith('/ltm-pilot')
  ? '/ltm-pilot'
  : '/thinking-space'
const routerProps = isLocalApp ? {} : { basename: webBasename }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router {...routerProps}>
      <UIThemeProviderBlock>
        <UILayoutProviderBlock>
          <MarkdownViewerProvider>
            <App />
          </MarkdownViewerProvider>
        </UILayoutProviderBlock>
      </UIThemeProviderBlock>
    </Router>
  </React.StrictMode>,
)
