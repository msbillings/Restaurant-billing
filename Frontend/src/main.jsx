import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LandingRoutes from './landing/LandingRoutes.jsx'

const path = window.location.pathname;

import { LanguageProvider } from './context/LanguageContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      {path === '/' || path === '/index.html' ? <LandingRoutes /> : <App />}
    </LanguageProvider>
  </StrictMode>,
)
