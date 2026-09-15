/* ==========================================================================
   BILLNAW SERVICE WORKER
   Bump CACHE_NAME on every deploy — this is what triggers the update flow.
   ========================================================================== */
const CACHE_NAME = 'billnaw-v31.0-pos-cart-module-extraction';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './vendor/qrcode.js',
  './vendor/qrcode_UTF8.js',
  './gstConfig.js',
  './exportEngine.js',
  './alertEngine.js',
  './printerEngine.js',
  './settings.js',
  './customers.js',
  './purchases.js',
  './inventory.js',
  './reports.js',
  './auth.js',
  './pos.js',
  './supabaseClient.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // NOTE: no self.skipWaiting() here on purpose.
  // We want the new SW to sit in "waiting" state until the user
  // confirms the update (see app.js showUpdateBanner()), so an
  // open tab never silently swaps to a mismatched cache mid-session.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Lets the page tell a waiting worker "go live now" after the user
// taps the Update button, instead of taking over automatically.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
