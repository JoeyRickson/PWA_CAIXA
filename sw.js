const CACHE='saldoplan-v2.20.7';

const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=2.20.7",
  "./drive-config.js?v=2.20.7",
  "./app.js?v=2.20.7",
  "./auth.js?v=2.20.7",
  "./manifest.json",
  "./css/base.css?v=2.20.7",
  "./css/history.css?v=2.20.7",
  "./css/auth.css?v=2.20.7",
  "./css/cycles.css?v=2.20.7",
  "./css/about.css?v=2.20.7",
  "./css/recurrence.css?v=2.20.7",
  "./css/clock.css?v=2.20.7",
  "./css/market.css?v=2.20.7",
  "./css/portfolio.css?v=2.20.7",
  "./css/patrimony.css?v=2.20.7",
  "./css/cards.css?v=2.20.7",
  "./css/importer.css?v=2.20.7",
  "./css/calendar.css?v=2.20.7",
  "./css/desktop.css?v=2.20.7",
  "./css/mobile.css?v=2.20.7",
  "./css/themes.css?v=2.20.7",
  "./css/responsive.css?v=2.20.7",
  "./js/core.js?v=2.20.7",
  "./js/recurrence.js?v=2.20.7",
  "./js/history.js?v=2.20.7",
  "./js/importer.js?v=2.20.7",
  "./js/cards.js?v=2.20.7",
  "./js/market.js?v=2.20.7",
  "./js/portfolio.js?v=2.20.7",
  "./js/dashboard.js?v=2.20.7",
  "./js/payroll.js?v=2.20.7",
  "./js/patrimony.js?v=2.20.7",
  "./js/calendar.js?v=2.20.7",
  "./js/ui.js?v=2.20.7",
  "./js/transactions.js?v=2.20.7",
  "./js/savings.js?v=2.20.7",
  "./js/overtime.js?v=2.20.7",
  "./js/backup.js?v=2.20.7",
  "./js/drive.js?v=2.20.7",
  "./js/pwa.js?v=2.20.7",
  "./js/mobile-nav.js?v=2.20.7",
  "./js/themes.js?v=2.20.7",
  "./views/dashboard.html?v=2.20.7",
  "./views/transactions.html?v=2.20.7",
  "./views/importer.html?v=2.20.7",
  "./views/calendar.html?v=2.20.7",
  "./views/cycles.html?v=2.20.7",
  "./views/portfolio.html?v=2.20.7",
  "./views/patrimony.html?v=2.20.7",
  "./views/cards.html?v=2.20.7",
  "./views/savings.html?v=2.20.7",
  "./views/simulator.html?v=2.20.7",
  "./views/thirteenth.html?v=2.20.7",
  "./views/fgts.html?v=2.20.7",
  "./views/fixed.html?v=2.20.7",
  "./views/market.html?v=2.20.7",
  "./views/data.html?v=2.20.7",
  "./views/about.html?v=2.20.7",
  "./views/dialogs.html?v=2.20.7",
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
