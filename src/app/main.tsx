import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { installGlobalErrorHandlers } from '../observability/clientErrorReporter'

const uninstallErrorHandlers = installGlobalErrorHandlers()
if (import.meta.hot) import.meta.hot.dispose(uninstallErrorHandlers)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
      <Analytics />
    </ErrorBoundary>
  </React.StrictMode>
)
