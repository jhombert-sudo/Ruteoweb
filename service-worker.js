// service-worker.js

// Nombre del cache (subí la versión para forzar actualización)
const CACHE_NAME = 'turnero-cache-v2';

// Detecta el "base path" donde está instalada la app (en tu caso: /Ruteoweb/)
const BASE_PATH = self.location.pathname.replace(/\/service-worker\.js$/, '');

// Helper para armar URLs dentro de /Ruteoweb/ sin hardcodear
function withBase(path) {
  // path viene tipo "index.html" o "assets/css/main.css"
  return `${BASE_PATH}/${path}`.replace(/\/{2,}/g, '/');
}

// Archivos que queremos cachear (dentro de /Ruteoweb/)
const urlsToCache = [
  withBase(''), // /Ruteoweb/ (ruta base)
  withBase('index.html'),
  withBase('assets/css/main.css'),
  // Si querés, después agregamos:
  // withBase('assets/js/driver.js'),
  // withBase('assets/js/panel.js'),
  // withBase('img/logo.jpeg'),
  // withBase('manifest.json')
];

// Instalación del service worker y cacheo inicial
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activación y limpieza de caches antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Interceptar requests y servir desde cache cuando sea posible (cache-first)
self.addEventListener('fetch', (event) => {
  // Solo GET
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        // Guardamos en cache solo respuestas OK y del mismo origen
        try {
          const url = new URL(event.request.url);
          if (url.origin === self.location.origin && resp && resp.status === 200) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
        } catch (_) {}
        return resp;
      });
    })
  );
});
