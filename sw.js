/* ══════════════════════════════════════════════════════════════════
   SERVICE WORKER — Poissonerie PWA
   Gère le cache offline + mise à jour automatique
   ══════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════
   SERVICE WORKER — Poissonerie PWA
   ══════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'poissonerie-v2032';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800&family=JetBrains+Mono:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

// INSTALLATION
self.addEventListener('install', event => {
  console.log('[SW] Installation...');

  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// ACTIVATION
self.addEventListener('activate', event => {
  console.log('[SW] Activation...');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH
// FETCH
self.addEventListener('fetch', event => {

  if (event.request.method !== 'GET') return;

  // Ne jamais mettre index.html en cache
  if (
    event.request.url.includes('index.html') ||
    event.request.url.endsWith('/') ||
    event.request.mode === 'navigate'
  ) {

    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
    );

    return;
  }

  // Cache normal pour les autres fichiers
  event.respondWith(
    caches.match(event.request).then(cached => {

      if (cached) {
        return cached;
      }

      return fetch(event.request).then(response => {

        const responseClone = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });

        return response;
      });

    })
  );
});

// MESSAGE
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
