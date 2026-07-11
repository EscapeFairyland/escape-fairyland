const CACHE_NAME = 'pocket-jokers-cache-v11';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './assets/icon-32.png',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/album-cover.png',
  './assets/Sprytne_Sniadanka_Intro.mp3',
  './assets/Dumbo.mp3',
  './assets/Harvest_Fest.mp3',
  './assets/Hill_Climb_Racing_(im_touching_this_guy).mp3',
  './assets/Jak_Sie_Slizgasz_To_Sie_Slizgasz.mp3',
  './assets/Never_Past_Bedtime.mp3',
  './assets/Pocket_Jokers.mp3'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Zmusza przeglądarkę do pominięcia czekania w kolejce na nową wersję
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache V11');
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
