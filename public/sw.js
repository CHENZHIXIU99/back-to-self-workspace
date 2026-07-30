const CACHE="orange-growth-workspace-v3";
const scopeUrl=self.registration.scope;
const core=["","manifest.webmanifest","icon.png"].map(path=>new URL(path,scopeUrl).toString());
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(core))));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match(scopeUrl))))});
