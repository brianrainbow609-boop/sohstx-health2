const CACHE='sohstx-hectors-pool-hall-v5';
const FILES=['/sohstx-brand.css','./','./index.html','./install.html','./style.css','./game.mjs','./pool.mjs','./opponent.mjs','./rules.mjs','./arcade-rules.mjs','/games/install.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./assets/hector-idle.png','./assets/erasmo-idle.png','/games/shared/controls.css'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sohstx-hectors-pool-hall-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;})));});
