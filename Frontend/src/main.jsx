import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import LandingRoutes from './landing/LandingRoutes.jsx'

const path = window.location.pathname;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {path === '/' ? <LandingRoutes /> : <App />}
  </StrictMode>,
)
