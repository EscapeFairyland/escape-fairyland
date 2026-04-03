const CACHE_NAME = 'pocket-jokers-cache-v4';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './assets/icon.svg',
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
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Fallback if offline and not in cache
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      }
    )
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
