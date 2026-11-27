const CACHE='sohstx-tire-shop-rivals-v2';
const CORE=['/sohstx-brand.css',
 './','./index.html','./install.html','./rivals.css?v=20261127a',
 './rivals.mjs?v=20261127a','./combat.mjs?v=20261127a','./motion.mjs?v=20261127a',
 './manifest.webmanifest','./icon-192.png','./icon-512.png',
 '/games/install.js','/games/shared/controls.css','/games/shared/legacy-storage.js',
 './roster/index.json'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(CORE);
 const roster=await (await cache.match('./roster/index.json')).json();
 const motions=roster.fighters.map(f=>'./roster/motion/'+encodeURIComponent(f.id)+'.png');
 const atlases=Array.from({length:7},(_,i)=>'./roster/fighters-'+i+'.webp');
 await cache.addAll([...motions,...atlases]);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(key=>key.startsWith('sohstx-tire-shop-rivals-')&&key!==CACHE).map(key=>caches.delete(key)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{
  const hit=await caches.match(event.request,{ignoreSearch:true});
  if(hit)return hit;
  const response=await fetch(event.request);
  if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
  return response;
 })());
});
