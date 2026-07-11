const CACHE_NAME = 'pocket-jokers-cache-v12';
// Pre-cache obejmuje tylko lekki "shell" strony (HTML/CSS/JS/loga/fonty).
// MP3 celowo NIE są na liście — pre-cache ~48 MB audio przy pierwszej
// wizycie zżerał transfer odwiedzających (mobile!) i limit GitHub Pages.
// Audio i tak trafia do cache przy pierwszym odtworzeniu, bo handler
// fetch poniżej dopisuje każdą pobraną odpowiedź (runtime caching).
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './manifest.json',
  './assets/icon-32.png',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/logo-pelne.png',
  './assets/logotypPion.png',
  './assets/sygnet.png',
  './assets/fonts/syne-latin.woff2',
  './assets/fonts/syne-latin-ext.woff2',
  './assets/fonts/space-grotesk-latin.woff2',
  './assets/fonts/space-grotesk-latin-ext.woff2'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Zmusza przeglądarkę do pominięcia czekania w kolejce na nową wersję
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache', CACHE_NAME);
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Strategia "Network First" z Fallbackiem do "Cache" - rozwiązuje problem Ctrl+F5!
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Zapisuj do cache świeże pobrane elementy w tle (dla trybu offline)
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Kiedy brak internetu lub server padnie -> odczytaj z Cache (Offline support)
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Nagłówek "accept" może nie istnieć — bez guardu .includes() rzuca błąd
          if ((event.request.headers.get('accept') || '').includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim()); // Nowy SW natychmiast przejmuje kontrolę nad otwartą stroną
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName); // Usuwanie starych zduplikowanych cache, np. v7
          }
        })
      );
    })
  );
});
