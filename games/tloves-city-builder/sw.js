const cacheName='tloves-city-v2';
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(['/games/shared/legacy-storage.js','./','./index.html','./install.html','./icon192.png','./icon512.png','./manifest.webmanifest']))));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||(!event.request.url.startsWith(self.registration.scope)&&new URL(event.request.url).pathname!=='/games/shared/legacy-storage.js'))return;
 event.respondWith(fetch(event.request).catch(()=>caches.open(cacheName).then(cache=>cache.match(event.request,{ignoreSearch:true}))));
});
