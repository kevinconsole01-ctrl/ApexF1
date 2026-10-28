/* APEX · service worker
 * Shell statica in cache + dati OpenF1 in cache runtime.
 * Al termine di un aggiornamento cambiare VERSION per invalidare le cache.
 */
const VERSION = 'v1.2.0';
const SHELL_CACHE = `apex-shell-${VERSION}`;
const RUNTIME_CACHE = `apex-runtime-${VERSION}`;
const API_ORIGIN = 'https://api.openf1.org';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/pages.css',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './js/main.js',
  './js/config.js',
  './js/core/api.js',
  './js/core/dom.js',
  './js/core/format.js',
  './js/core/install.js',
  './js/core/overlay.js',
  './js/core/page.js',
  './js/core/pwa.js',
  './js/core/router.js',
  './js/core/store.js',
  './js/components/base.js',
  './js/components/chart.js',
  './js/components/driver.js',
  './js/components/race.js',
  './js/components/stats.js',
  './js/components/table.js',
  './js/components/ui.js',
  './js/data/drivers.js',
  './js/data/laps.js',
  './js/data/live.js',
  './js/data/results.js',
  './js/data/season.js',
  './js/data/standings.js',
  './js/layout/shell.js',
  './js/pages/dashboard.js',
  './js/pages/standings.js',
  './js/pages/results.js',
  './js/pages/laps.js',
  './js/pages/drivers.js',
  './js/pages/driver.js',
  './js/pages/schedule.js',
  './js/pages/live.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('apex-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || network || new Response('', { status: 504, statusText: 'Offline' });
}

async function navigationResponse(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    return (
      (await cache.match('./index.html')) ||
      (await cache.match('./')) ||
      new Response('', { status: 503, statusText: 'Offline' })
    );
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin === API_ORIGIN) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});
