/* Service worker para instalar la PWA del panel admin.
 * Navegaciones (HTML) van siempre a red: evita que Safari abra la landing
 * cacheada en "/" al entrar a /admin.
 */
const CACHE = 'nodefex-shell-v2'
const PRECACHE = ['/admin', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png']

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

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Documentos / rutas SPA: red primero (nunca servir "/" para "/admin").
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          const cachedExact = await caches.match(request)
          if (cachedExact) return cachedExact
          // Fallback offline del shell admin (no la landing).
          return (await caches.match('/admin')) || (await caches.match('/index.html'))
        }),
    )
    return
  }

  // Assets estáticos: cache con actualización en segundo plano.
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
