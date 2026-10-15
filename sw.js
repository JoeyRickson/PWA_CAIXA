const CACHE='saldoplan-v3.1.2';

const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=3.1.2",
  "./drive-config.js?v=3.1.2",
  "./app.js?v=3.1.2",
  "./auth.js?v=3.1.2",
  "./manifest.json",
  "./css/base.css?v=3.1.2",
  "./css/history.css?v=3.1.2",
  "./css/auth.css?v=3.1.2",
  "./css/cycles.css?v=3.1.2",
  "./css/about.css?v=3.1.2",
  "./css/support.css?v=3.1.2",
  "./css/recurrence.css?v=3.1.2",
  "./css/clock.css?v=3.1.2",
  "./css/market.css?v=3.1.2",
  "./css/portfolio.css?v=3.1.2",
  "./css/patrimony.css?v=3.1.2",
  "./css/cards.css?v=3.1.2",
  "./css/importer.css?v=3.1.2",
  "./css/calendar.css?v=3.1.2",
  "./css/desktop.css?v=3.1.2",
  "./css/mobile.css?v=3.1.2",
  "./css/themes.css?v=3.1.2",
  "./css/responsive.css?v=3.1.2",
  "./css/motion.css?v=3.1.2",
  "./js/core.js?v=3.1.2",
  "./js/recurrence.js?v=3.1.2",
  "./js/history.js?v=3.1.2",
  "./js/importer.js?v=3.1.2",
  "./js/cards.js?v=3.1.2",
  "./js/market.js?v=3.1.2",
  "./js/portfolio.js?v=3.1.2",
  "./js/dashboard.js?v=3.1.2",
  "./js/payroll.js?v=3.1.2",
  "./js/patrimony.js?v=3.1.2",
  "./js/calendar.js?v=3.1.2",
  "./js/ui.js?v=3.1.2",
  "./js/transactions.js?v=3.1.2",
  "./js/savings.js?v=3.1.2",
  "./js/overtime.js?v=3.1.2",
  "./js/backup.js?v=3.1.2",
  "./js/drive.js?v=3.1.2",
  "./js/pwa.js?v=3.1.2",
  "./js/mobile-nav.js?v=3.1.2",
  "./js/themes.js?v=3.1.2",
  "./js/motion.js?v=3.1.2",
  "./js/support.js?v=3.1.2",
  "./views/dashboard.html?v=3.1.2",
  "./views/transactions.html?v=3.1.2",
  "./views/importer.html?v=3.1.2",
  "./views/calendar.html?v=3.1.2",
  "./views/cycles.html?v=3.1.2",
  "./views/portfolio.html?v=3.1.2",
  "./views/patrimony.html?v=3.1.2",
  "./views/cards.html?v=3.1.2",
  "./views/savings.html?v=3.1.2",
  "./views/simulator.html?v=3.1.2",
  "./views/thirteenth.html?v=3.1.2",
  "./views/fgts.html?v=3.1.2",
  "./views/fixed.html?v=3.1.2",
  "./views/market.html?v=3.1.2",
  "./views/data.html?v=3.1.2",
  "./views/about.html?v=3.1.2",
  "./views/support.html?v=3.1.2",
  "./views/dialogs.html?v=3.1.2",
  "./css/intelligence.css?v=3.1.2",
  "./js/intelligence.js?v=3.1.2",
  "./js/sp3-tools.js?v=3.1.2",
  "./js/sp3-sync.js?v=3.1.2",
  "./js/sp3-tickets.js?v=3.1.2",
  "./views/intelligence.html?v=3.1.2",
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
