const CACHE='saldoplan-v2.20.5';

const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=2.20.5",
  "./drive-config.js?v=2.20.5",
  "./app.js?v=2.20.5",
  "./auth.js?v=2.20.5",
  "./manifest.json",
  "./css/base.css?v=2.20.5",
  "./css/history.css?v=2.20.5",
  "./css/auth.css?v=2.20.5",
  "./css/cycles.css?v=2.20.5",
  "./css/about.css?v=2.20.5",
  "./css/recurrence.css?v=2.20.5",
  "./css/clock.css?v=2.20.5",
  "./css/market.css?v=2.20.5",
  "./css/portfolio.css?v=2.20.5",
  "./css/patrimony.css?v=2.20.5",
  "./css/cards.css?v=2.20.5",
  "./css/importer.css?v=2.20.5",
  "./css/calendar.css?v=2.20.5",
  "./css/desktop.css?v=2.20.5",
  "./css/mobile.css?v=2.20.5",
  "./css/themes.css?v=2.20.5",
  "./js/core.js?v=2.20.5",
  "./js/recurrence.js?v=2.20.5",
  "./js/history.js?v=2.20.5",
  "./js/importer.js?v=2.20.5",
  "./js/cards.js?v=2.20.5",
  "./js/market.js?v=2.20.5",
  "./js/portfolio.js?v=2.20.5",
  "./js/dashboard.js?v=2.20.5",
  "./js/payroll.js?v=2.20.5",
  "./js/patrimony.js?v=2.20.5",
  "./js/calendar.js?v=2.20.5",
  "./js/ui.js?v=2.20.5",
  "./js/transactions.js?v=2.20.5",
  "./js/savings.js?v=2.20.5",
  "./js/overtime.js?v=2.20.5",
  "./js/backup.js?v=2.20.5",
  "./js/drive.js?v=2.20.5",
  "./js/pwa.js?v=2.20.5",
  "./js/mobile-nav.js?v=2.20.5",
  "./js/themes.js?v=2.20.5",
  "./views/dashboard.html?v=2.20.5",
  "./views/transactions.html?v=2.20.5",
  "./views/importer.html?v=2.20.5",
  "./views/calendar.html?v=2.20.5",
  "./views/cycles.html?v=2.20.5",
  "./views/portfolio.html?v=2.20.5",
  "./views/patrimony.html?v=2.20.5",
  "./views/cards.html?v=2.20.5",
  "./views/savings.html?v=2.20.5",
  "./views/simulator.html?v=2.20.5",
  "./views/thirteenth.html?v=2.20.5",
  "./views/fgts.html?v=2.20.5",
  "./views/fixed.html?v=2.20.5",
  "./views/market.html?v=2.20.5",
  "./views/data.html?v=2.20.5",
  "./views/about.html?v=2.20.5",
  "./views/dialogs.html?v=2.20.5",
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
