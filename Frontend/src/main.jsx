import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/outfit'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'

import { LanguageProvider } from './context/LanguageContext.jsx'

// Clear stale PWA/SW caches for billing mutation endpoints on every startup
// This prevents old cached JS or API responses from blocking bill generation
if ('caches' in window) {
  caches.keys().then(cacheNames => {
    cacheNames.forEach(cacheName => {
      // Clear mutation-related API caches (bills-mutations-nocache etc.)
      if (cacheName.includes('bills') || cacheName.includes('mutation') || cacheName.includes('api-cache')) {
        console.log('[SW Cache] Clearing stale cache:', cacheName);
        caches.delete(cacheName);
      }
    });
  }).catch(e => console.warn('[SW Cache] Could not clear caches:', e));
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
)

