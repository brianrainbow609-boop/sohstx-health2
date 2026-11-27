const cacheName='tempest-delver-v4';
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(['/sohstx-brand.css','/games/shared/legacy-storage.js','./','./index.html','./install.html','./game.js','./style.css','./dungeon.js','./hector.webp','./erasmo.webp','./crew.webp','./monsters.webp','./icon192.png','./icon512.png','./manifest.webmanifest']))));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||(!event.request.url.startsWith(self.registration.scope)&&!['/games/shared/legacy-storage.js','/sohstx-brand.css'].includes(new URL(event.request.url).pathname)))return;
 event.respondWith(fetch(event.request).catch(()=>caches.open(cacheName).then(cache=>cache.match(event.request,{ignoreSearch:true}))));
});
