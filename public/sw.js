/* NexusMaster PWA: never persist credentials, private screens, API responses or access commands. */
const CACHE='nexus-public-v1';
const OFFLINE='/offline.html';
const ASSETS=[OFFLINE,'/icons/nexusmaster.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('nexus-public-')&&key!==CACHE).map(key=>caches.delete(key)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 const path=new URL(req.url).pathname;
 if(path.startsWith('/api/')||path.startsWith('/convite')||path.startsWith('/interfone.html'))return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(OFFLINE)));
 }
 /* Static assets use normal browser HTTP caching; service worker never caches user data. */
});
