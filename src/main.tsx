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

/**
 * En producción: al desplegar un build nuevo el service worker se actualiza
 * y la app se recarga sola para reflejar los cambios.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  let refreshing = false

  const reloadOnce = () => {
    if (refreshing) return
    refreshing = true
    window.location.reload()
  }

  navigator.serviceWorker.addEventListener('controllerchange', reloadOnce)

  const watchRegistration = (registration: ServiceWorkerRegistration) => {
    const askWaitingToActivate = () => {
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
    }

    askWaitingToActivate()

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          worker.postMessage({ type: 'SKIP_WAITING' })
        }
      })
    })

    const checkUpdate = () => {
      void registration.update().catch(() => {})
    }

    checkUpdate()
    window.setInterval(checkUpdate, 60_000)

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkUpdate()
    })

    window.addEventListener('focus', checkUpdate)
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then(watchRegistration)
      .catch((error) => {
        console.warn('[pwa] No se pudo registrar el service worker', error)
      })
  })
}
