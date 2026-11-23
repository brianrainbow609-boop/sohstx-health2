const cacheName='sohstx-island-v1';
const files=['./','./index.html','./install.html','./game.js','./art.js','./crew.webp','./style.css','./manifest.webmanifest','./icon-192.png','./icon-512.png','/games/install.js','/games/hub.css'];
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(c=>c.addAll(files)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sohstx-island-')&&k!==cacheName).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method==='GET'&&new URL(event.request.url).origin===location.origin)event.respondWith(caches.open(cacheName).then(c=>c.match(event.request,{ignoreSearch:true})).then(hit=>hit||fetch(event.request)))});
