const CACHE="orange-growth-workspace-v6";
const scopeUrl=self.registration.scope;
const core=["","manifest.webmanifest","icon.png"].map(path=>new URL(path,scopeUrl).toString());
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(core)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
  const windows=await self.clients.matchAll({type:"window"});
  await Promise.all(windows.map(client=>client.navigate(client.url)));
})()));
self.addEventListener("message",e=>{if(e.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;const isModel=new URL(e.request.url).pathname.includes("/models/ssdlite_mobilenet_v2/");if(isModel){e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r})));return}e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match(scopeUrl))))});
