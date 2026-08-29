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

// Global Application-Wide Strict Protections for ALL number input fields:
// 1. Prevent mouse wheel scroll from changing numbers in any number field
document.addEventListener('wheel', (e) => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
    e.target.blur();
  }
  if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.type === 'number') {
    document.activeElement.blur();
  }
}, { passive: true });

// 2. Block typing negative sign ('-', 'Minus', 'NumpadSubtract') and scientific notation ('e', 'E')
document.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
    if (e.key === '-' || e.key === 'Minus' || e.code === 'NumpadSubtract' || e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}, true);

// 3. Sanitize paste or direct input to never allow negative numbers
document.addEventListener('input', (e) => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
    let val = e.target.value;
    if (typeof val === 'string' && val.includes('-')) {
      e.target.value = val.replace(/-/g, '');
    }
    const num = parseFloat(e.target.value);
    if (!isNaN(num) && num < 0) {
      e.target.value = Math.max(0, Math.abs(num)).toString();
    }
  }
}, true);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
)

