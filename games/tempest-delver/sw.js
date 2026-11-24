const cacheName='tempest-delver-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(['./','./index.html','./install.html','./game.js','./style.css','./zone0.webp','./zone1.webp','./zone2.webp','./icon192.png','./icon512.png','./manifest.webmanifest']))));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;
 event.respondWith(fetch(event.request).catch(()=>caches.open(cacheName).then(cache=>cache.match(event.request,{ignoreSearch:true}))));
});
