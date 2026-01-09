// service-worker.js

// Nombre del cache
const CACHE_NAME = 'turnero-cache-v1';

// Archivos que queremos cachear
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/css/main.css',
  // Agregá acá otros archivos que quieras cachear
];

// Instalación del service worker y cacheo inicial
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activación y limpieza de caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

// Interceptar requests y servir desde cache cuando sea posible
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});
