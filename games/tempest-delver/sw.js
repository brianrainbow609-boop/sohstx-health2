const cacheName='tempest-delver-v3';
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(['/games/shared/legacy-storage.js','./','./index.html','./install.html','./game.js','./style.css','./dungeon.js','./hector.webp','./erasmo.webp','./crew.webp','./monsters.webp','./icon192.png','./icon512.png','./manifest.webmanifest']))));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||(!event.request.url.startsWith(self.registration.scope)&&new URL(event.request.url).pathname!=='/games/shared/legacy-storage.js'))return;
 event.respondWith(fetch(event.request).catch(()=>caches.open(cacheName).then(cache=>cache.match(event.request,{ignoreSearch:true}))));
});
