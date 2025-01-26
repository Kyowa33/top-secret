self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open('kyowa-cache').then((cache) => {
        return cache.addAll([
          '/',
          '/index.html',
          '/manifest.json',
          '/static/js/bundle.js',
          // Add other assets and routes to cache
        ]);
      })
    );
  });

  self.addEventListener('fetch', (event) => {
    event.respondWith(
      caches.match(event.request).then((response) => {
        console.log("ask fetch " + event.request.url + " ; response " + (response !== undefined ? "exists" : "does not exist : fetch from network"));
        return response || fetch(event.request);
      })
    );
  });