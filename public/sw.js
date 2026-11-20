/* SeatLock service worker.
 * - App shell: network-first navigations; the last good index.html is cached so
 *   the SPA (and the Offline Ticket Vault) opens without a connection.
 * - Hashed /assets/ are immutable: cache-first.
 * - API calls, the organizer API and anything cross-origin are never cached:
 *   seat availability is never served from cache, and offline mode can't fake a booking.
 */
const VERSION = 'seatlock-v2'
const STATIC = `${VERSION}-static`
const PAGES = `${VERSION}-pages`
const SHELL = '/index.html'
const PRECACHE = ['/', '/offline.html', '/icon.svg', '/icon-maskable.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
            const copy = res.clone()
            void caches.open(PAGES).then((c) => c.put(SHELL, copy))
          }
          return res
        })
        .catch(async () => (await caches.match(SHELL)) || (await caches.match('/')) || (await caches.match('/offline.html')) || Response.error()),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.woff2')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              void caches.open(STATIC).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
