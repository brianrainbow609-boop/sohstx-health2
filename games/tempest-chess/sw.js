const cacheName='sohstx-tempest-chess-v2';
const files=['/sohstx-brand.css','./','./index.html','./install.html','./style.css','./game.mjs','./opponent.mjs','./chess.mjs','./manifest.webmanifest','./icon-192.png','./icon-512.png','../art/tempest-chess.webp'];
const paths=new Set(files.map(file=>new URL(file,self.location.href).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(files))));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 if(event.request.method==='GET' && paths.has(event.request.url))
   event.respondWith(caches.open(cacheName).then(async cache=>(await cache.match(event.request)) || fetch(event.request)));
});
