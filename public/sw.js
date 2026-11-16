/* NexusMaster PWA: never persist credentials, private screens, API responses or access commands. */
const CACHE='nexus-public-v2';
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

/* Web Push arrives even when the installed PWA is closed, where supported. */
self.addEventListener('push',event=>{
 let message={};
 try{message=event.data?.json()||{}}catch{return}
 if(message.kind!=='intercom'||!/^[a-f0-9-]{36}$/i.test(message.callId||''))return;
 if(Number(message.expires||0)<=Date.now()/1000)return; // Do not alert for expired 30s calls.
 const reasons={entrega:'Entrega ou encomenda',visita:'Visita',servico:'Prestação de serviço',outro:'Outro assunto'};
 const body='Motivo: '+(reasons[message.reason]||'Chamada na portaria')+'. Toque para abrir o interfone.';
 const path='/interfone-morador.html?call='+encodeURIComponent(message.callId);
 event.waitUntil(self.registration.showNotification('NexusMaster • Interfone chamando',{
  body,tag:'nexus-intercom-'+message.callId,
  icon:'/icons/nexusmaster-192.png',badge:'/icons/nexusmaster-192.png',
  vibrate:[400,160,400],requireInteraction:true,
  data:{path,expires:message.expires},
  actions:[{action:'open',title:'Ver chamada'}]
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 if(event.action&&event.action!=='open')return;
 const path=event.notification.data?.path||'/interfone-morador.html';
 if(Number(event.notification.data?.expires||0)<=Date.now()/1000)return;
 const url=new URL(path,self.location.origin).href;
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   if(new URL(client.url).origin===self.location.origin){
    await client.navigate(url);
    return client.focus();
   }
  }
  return self.clients.openWindow(url);
 })());
});
