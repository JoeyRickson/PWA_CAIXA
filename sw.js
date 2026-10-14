const CACHE='saldoplan-v2.20.8';

const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=2.20.8",
  "./drive-config.js?v=2.20.8",
  "./app.js?v=2.20.8",
  "./auth.js?v=2.20.8",
  "./manifest.json",
  "./css/base.css?v=2.20.8",
  "./css/history.css?v=2.20.8",
  "./css/auth.css?v=2.20.8",
  "./css/cycles.css?v=2.20.8",
  "./css/about.css?v=2.20.8",
  "./css/recurrence.css?v=2.20.8",
  "./css/clock.css?v=2.20.8",
  "./css/market.css?v=2.20.8",
  "./css/portfolio.css?v=2.20.8",
  "./css/patrimony.css?v=2.20.8",
  "./css/cards.css?v=2.20.8",
  "./css/importer.css?v=2.20.8",
  "./css/calendar.css?v=2.20.8",
  "./css/desktop.css?v=2.20.8",
  "./css/mobile.css?v=2.20.8",
  "./css/themes.css?v=2.20.8",
  "./css/responsive.css?v=2.20.8",
  "./css/motion.css?v=2.20.8",
  "./js/core.js?v=2.20.8",
  "./js/recurrence.js?v=2.20.8",
  "./js/history.js?v=2.20.8",
  "./js/importer.js?v=2.20.8",
  "./js/cards.js?v=2.20.8",
  "./js/market.js?v=2.20.8",
  "./js/portfolio.js?v=2.20.8",
  "./js/dashboard.js?v=2.20.8",
  "./js/payroll.js?v=2.20.8",
  "./js/patrimony.js?v=2.20.8",
  "./js/calendar.js?v=2.20.8",
  "./js/ui.js?v=2.20.8",
  "./js/transactions.js?v=2.20.8",
  "./js/savings.js?v=2.20.8",
  "./js/overtime.js?v=2.20.8",
  "./js/backup.js?v=2.20.8",
  "./js/drive.js?v=2.20.8",
  "./js/pwa.js?v=2.20.8",
  "./js/mobile-nav.js?v=2.20.8",
  "./js/themes.js?v=2.20.8",
  "./js/motion.js?v=2.20.8",
  "./views/dashboard.html?v=2.20.8",
  "./views/transactions.html?v=2.20.8",
  "./views/importer.html?v=2.20.8",
  "./views/calendar.html?v=2.20.8",
  "./views/cycles.html?v=2.20.8",
  "./views/portfolio.html?v=2.20.8",
  "./views/patrimony.html?v=2.20.8",
  "./views/cards.html?v=2.20.8",
  "./views/savings.html?v=2.20.8",
  "./views/simulator.html?v=2.20.8",
  "./views/thirteenth.html?v=2.20.8",
  "./views/fgts.html?v=2.20.8",
  "./views/fixed.html?v=2.20.8",
  "./views/market.html?v=2.20.8",
  "./views/data.html?v=2.20.8",
  "./views/about.html?v=2.20.8",
  "./views/dialogs.html?v=2.20.8",
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
