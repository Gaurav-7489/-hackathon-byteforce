/* SeatLock service worker — offline page + static asset cache. Never caches API calls. */
const VERSION = 'seatlock-v4'
const STATIC = `${VERSION}-static`
const PAGES = `${VERSION}-pages`
const PRECACHE = ['/offline.html', '/icon.svg', '/manifest.webmanifest']

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
  // Cross-origin requests (including the organizer API) and anything that isn't a page or static asset pass straight through.
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    // Network-first for pages; fall back to the offline page.
    event.respondWith(
      fetch(req).catch(async () => (await caches.match(req)) || (await caches.match('/offline.html')) || Response.error()),
    )
    return
  }

  if (url.pathname.startsWith('/assets/')) {
    // Hashed build assets are immutable: cache-first.
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
