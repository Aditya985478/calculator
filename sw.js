// sw.js
const CACHE_NAME = 'ai-calculator-cache-v1';

// On install, pre-cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // These are the core files for the app to work offline.
      return cache.addAll([
        '/',
        '/index.html',
        '/manifest.json',
        '/vite.svg',
      ]);
    })
  );
});

// On activate, clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
});

// On fetch, use a network-first (network falling back to cache) strategy
self.addEventListener('fetch', event => {
    // We only want to cache GET requests.
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Don't cache Gemini API calls
    if (event.request.url.includes('googleapis.com')) {
        return; // Let the network handle it without caching
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // If we get a valid response, cache it and return it
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // If the network request fails, try to serve from cache
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // If not in cache and network fails, it will result in a browser error.
                    // This is expected for uncached resources when offline.
                });
            })
    );
});
