const CACHE='saldoplan-v2.15.0';

const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=2.15.0",
  "./drive-config.js?v=2.15.0",
  "./app.js?v=2.15.0",
  "./auth.js?v=2.15.0",
  "./manifest.json",
  "./css/base.css?v=2.15.0",
  "./css/history.css?v=2.15.0",
  "./css/auth.css?v=2.15.0",
  "./css/cycles.css?v=2.15.0",
  "./css/about.css?v=2.15.0",
  "./css/recurrence.css?v=2.15.0",
  "./css/clock.css?v=2.15.0",
  "./css/market.css?v=2.15.0",
  "./css/portfolio.css?v=2.15.0",
  "./css/desktop.css?v=2.15.0",
  "./js/core.js?v=2.15.0",
  "./js/history.js?v=2.15.0",
  "./js/market.js?v=2.15.0",
  "./js/portfolio.js?v=2.15.0",
  "./js/dashboard.js?v=2.15.0",
  "./js/payroll.js?v=2.15.0",
  "./js/ui.js?v=2.15.0",
  "./js/transactions.js?v=2.15.0",
  "./js/savings.js?v=2.15.0",
  "./js/overtime.js?v=2.15.0",
  "./js/backup.js?v=2.15.0",
  "./js/drive.js?v=2.15.0",
  "./js/pwa.js?v=2.15.0",
  "./views/dashboard.html?v=2.15.0",
  "./views/transactions.html?v=2.15.0",
  "./views/cycles.html?v=2.15.0",
  "./views/portfolio.html?v=2.15.0",
  "./views/savings.html?v=2.15.0",
  "./views/simulator.html?v=2.15.0",
  "./views/thirteenth.html?v=2.15.0",
  "./views/fgts.html?v=2.15.0",
  "./views/fixed.html?v=2.15.0",
  "./views/market.html?v=2.15.0",
  "./views/data.html?v=2.15.0",
  "./views/about.html?v=2.15.0",
  "./views/dialogs.html?v=2.15.0",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys=>Promise.all(
        keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))
      ))
    ])
  );
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;

  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(url.pathname.startsWith('/api/')){
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        }
        return response;
      })
      .catch(()=>caches.match(event.request))
  );
});
