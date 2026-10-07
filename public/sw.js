/* Docked web app v1. Only the public offline shell is cached. Never cache pages,
   API responses, authenticated RSC payloads, odds or member media. */
const fantasy=new URL(self.location.href).searchParams.get("fantasy")==="1";
const CACHE=fantasy?"docked-public-offline-fantasy-v1":"docked-public-offline-master-d-v3";
const OFFLINE=fantasy?"/brand/docked/offline.html":"/offline.html";
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.add(OFFLINE))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("docked-public-offline-")&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("message",event=>{if(event.data?.type==="ACTIVATE_UPDATE")void self.skipWaiting();});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET"||event.request.mode!=="navigate"||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).catch(async()=>await caches.match(OFFLINE)||Response.error()));
});
