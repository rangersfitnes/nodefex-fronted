import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Fuerza tomar el SW nuevo (v3+) en cuanto esté listo.
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        registration.update().catch(() => {})
      })
      .catch((error) => {
        console.warn('[pwa] No se pudo registrar el service worker', error)
      })
  })
}
