const cacheName='tloves-city-v3';
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(['/sohstx-brand.css','/games/shared/legacy-storage.js','./','./index.html','./install.html','./icon192.png','./icon512.png','./manifest.webmanifest']))));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||(!event.request.url.startsWith(self.registration.scope)&&!['/games/shared/legacy-storage.js','/sohstx-brand.css'].includes(new URL(event.request.url).pathname)))return;
 event.respondWith(fetch(event.request).catch(()=>caches.open(cacheName).then(cache=>cache.match(event.request,{ignoreSearch:true}))));
});
