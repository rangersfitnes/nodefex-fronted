/* Service worker PWA (panel admin).
 * Prioriza red para HTML/JS/CSS y evita mostrar una landing o bundle viejos.
 */
const CACHE = 'nodefex-shell-v3'
const PRECACHE = ['/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of PRECACHE) {
        try {
          await cache.add(url)
        } catch {
          // Prefetch opcional; no bloquear instalación.
        }
      }
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

function isShellAsset(url) {
  return (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.map')
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Documentos / rutas SPA: siempre red primero.
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          const cachedExact = await caches.match(request)
          if (cachedExact) return cachedExact
          return (await caches.match('/admin')) || Response.error()
        }),
    )
    return
  }

  // JS/CSS del bundle: red primero (evita UI pública desactualizada).
  if (isShellAsset(url) || request.destination === 'script' || request.destination === 'style') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => caches.match(request)),
    )
    return
  }

  // Iconos y estáticos menores: cache con actualización en segundo plano.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
