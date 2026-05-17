const CACHE_NAME = 'poissonerie-v2032';

const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// INSTALL
self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// ACTIVATE
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH
self.addEventListener('fetch', event => {

  // Ignorer les requêtes non GET
  if (event.request.method !== 'GET') return;

  // IMPORTANT :
  // Ne jamais intercepter Firebase / extensions / chrome
  const url = event.request.url;

  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('googleapis.com') ||
    url.startsWith('chrome-extension://')
  ) {
    return;
  }

  // HTML = toujours réseau
  if (
    event.request.mode === 'navigate' ||
    url.endsWith('.html') ||
    url.includes('?v=')
  ) {

    event.respondWith(
      fetch(event.request, {
        cache: 'no-store'
      }).catch(() => caches.match('./index.html'))
    );

    return;
  }

  // Cache-first pour les assets
  event.respondWith(
    caches.match(event.request).then(cached => {

      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then(response => {

          // Ne pas cacher si erreur
          if (!response || response.status !== 200) {
            return response;
          }

          const clone = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, clone);
          });

          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        });

    })
  );
});
