const cacheName = 'sohstx-night-shift-v4';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(['/sohstx-brand.css','/night-shift/install.html','/games/hub.css','/games/install.js','./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'])));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || (!event.request.url.startsWith(self.registration.scope) && !(new URL(event.request.url).origin===self.location.origin && ['/sohstx-brand.css','/games/hub.css','/games/install.js'].includes(new URL(event.request.url).pathname)))) return;
  event.respondWith(fetch(event.request).catch(() => caches.open(cacheName).then(cache => cache.match(event.request))));
});
