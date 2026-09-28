// Service worker for the Arcyn Find PWA.
//
// Cache names carry a version. Bumping it is how a bad cache gets purged:
// `activate` deletes every cache not in the current set, so v2 rollout also
// discards anything v1 stored -- which matters here, because v1 cached
// authenticated API responses and signed-in pages into shared storage.
const VERSION = 'v2'
const STATIC_CACHE = `arcyn-find-static-${VERSION}`
const RUNTIME_CACHE = `arcyn-find-runtime-${VERSION}`

// Precache: public, non-redirecting URLs only.
//
// `/home` used to be in this list and is auth-gated -- it answers 307 to
// /sign-in. That either aborted the whole precache or stored the sign-in page
// under the `/home` key, so an offline visit to /home showed a login screen
// from cache. Every entry below was verified to answer 200 anonymously.
const STATIC_ASSETS = [
  '/',
  '/tools',
  '/offline',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
]

// Routes that require a session. Never written to any cache.
//
// Cache Storage is per-origin, not per-user, and nothing clears it when a
// session ends. Caching these meant that after a sign-out on a shared browser,
// one network blip served the previous user's profile back to whoever was
// sitting there.
const PRIVATE_PATHS = [
  /^\/settings/,
  /^\/profile/,
  /^\/collections/,
  /^\/home/,
  /^\/followers/,
  /^\/reviews/,
  /^\/sign-in/,
]

// The only API routes safe to cache: public reads that carry no user state.
// An allowlist rather than a denylist, because the failure mode of forgetting
// to add a route here is a missing offline fallback, while the failure mode of
// forgetting to exclude one is leaking a user's data to the next person.
const CACHEABLE_API = [
  /^\/api\/tools\//,
  /^\/api\/trending/,
  /^\/api\/ai-models/,
]

// RUNTIME_CACHE previously grew without bound across a ~2,900 page catalog.
const RUNTIME_MAX_ENTRIES = 60

function isPrivate(pathname) {
  return PRIVATE_PATHS.some((re) => re.test(pathname))
}

function isCacheableApi(pathname) {
  return CACHEABLE_API.some((re) => re.test(pathname))
}

/**
 * Whether a response may be stored.
 *
 * `response.redirected` is the load-bearing check: every auth-gated route here
 * answers 307 to /sign-in, so a redirected response is one that was refused.
 * Storing it under the originally requested URL is how a cache ends up serving
 * a login page for /home.
 */
function isStorable(response) {
  return Boolean(response) && response.status === 200 && !response.redirected
}

/** Trim a cache to its most recent N entries. keys() is in insertion order. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= maxEntries) return
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)))
}

// Install - precache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Added one at a time rather than with `cache.addAll()`, which is atomic:
      // a single failing URL rejects the whole call and leaves *nothing*
      // cached. That happened twice here -- once on icon paths that did not
      // exist, once on an auth-gated route -- and both times a `.catch()`
      // swallowed it, so the precache silently did nothing for months.
      const results = await Promise.allSettled(STATIC_ASSETS.map((url) => cache.add(url)))
      const failed = STATIC_ASSETS.filter((_, i) => results[i].status === 'rejected')
      if (failed.length) console.warn('SW precache skipped:', failed.join(', '))
    })
  )
  self.skipWaiting()
})

// Activate - drop caches from older versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      )
    )
  )
  return self.clients.claim()
})

// Let the page order a full cache wipe, which it does on sign-out.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n)))))
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.origin !== location.origin) return

  // Anything behind a session: straight to the network, never stored, no cache
  // fallback. An offline user seeing a stale settings page is not worth the
  // risk of showing it to the wrong person.
  if (isPrivate(url.pathname)) return

  if (url.pathname.startsWith('/api/')) {
    // Everything not explicitly public is network-only.
    if (!isCacheableApi(url.pathname)) return

    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isStorable(response)) {
            const copy = response.clone()
            caches.open(RUNTIME_CACHE).then(async (cache) => {
              await cache.put(request, copy)
              await trimCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES)
            })
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          return (
            cached ||
            new Response(JSON.stringify({ error: 'Offline', message: 'No internet connection' }), {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        })
    )
    return
  }

  // Static assets - cache first. Safe to hold indefinitely because Next.js
  // content-hashes everything under /_next/static/.
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/) ||
    url.pathname.startsWith('/_next/static/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (isStorable(response)) {
              const copy = response.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          })
      )
    )
    return
  }

  // HTML - network first, cache as offline fallback.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (isStorable(response)) {
          const copy = response.clone()
          caches.open(RUNTIME_CACHE).then(async (cache) => {
            await cache.put(request, copy)
            await trimCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES)
          })
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        // A real page rather than `caches.match('/')`, which served the home
        // page as though the navigation had succeeded.
        const offline = await caches.match('/offline')
        return offline || new Response('Offline', { status: 503 })
      })
  )
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-ai-tools') {
    event.waitUntil(syncAITools())
  }
})

async function syncAITools() {
  try {
    // Sync logic for offline actions
    console.log('Syncing AI tools...')
  } catch (error) {
    console.error('Sync failed:', error)
  }
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {}
  const title = data.title || 'Arcyn Find'
  const options = {
    body: data.body || 'New update available',
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    tag: 'arcyn-find-notification',
    data: data.url || '/',
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data || '/'))
})
