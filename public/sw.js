// Bump this whenever the caching strategy changes.
// Bumping forces the activate handler to nuke every previous cache,
// which is the only reliable way to evict stale shells from old SW versions.
const CACHE_NAME = 'bevigo-v3';

// Static assets we want to keep available offline. We deliberately do NOT
// precache the dashboard HTML — those pages must always be fetched fresh
// so deploys roll out instantly.
const PRECACHE_URLS = ['/login', '/order'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Allow the page to ask the SW to skip waiting and take over immediately
// (used when surfacing an "Update available" notification to the user).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never intercept anything that isn't a simple GET — POST/PUT/DELETE,
  // Convex websocket upgrades, and Bluetooth/USB calls must hit the network.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Don't touch cross-origin or backend traffic. Convex, Anthropic, etc.
  // must be live so auth state and queries stay current.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/data/')) return;

  // Network-first for HTML navigations. If the network fails (offline),
  // serve any cached copy of the same URL, then a precached shell as a
  // last resort. This is what makes deploys land immediately and prevents
  // the "old UI" lingering after logout/refresh.
  const isHtml =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Cache a copy so offline navigations have something to show.
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match('/order');
          return fallback || Response.error();
        })
    );
    return;
  }

  // Network-first for Next.js JS/CSS chunks too — these are content-hashed
  // so the URL itself changes on deploy, but we still want fresh fetches
  // to win when available so users on a stale shell upgrade quickly.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetched = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches
                .open(CACHE_NAME)
                .then((c) => c.put(req, copy))
                .catch(() => undefined);
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetched;
      })
    );
    return;
  }

  // Cache-first for the remaining truly-static assets (icons, fonts, logo).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches
            .open(CACHE_NAME)
            .then((c) => c.put(req, copy))
            .catch(() => undefined);
        }
        return res;
      });
    })
  );
});
