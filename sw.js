const CACHE='saldoplan-v3.1.4';

const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=3.1.4",
  "./drive-config.js?v=3.1.4",
  "./app.js?v=3.1.4",
  "./auth.js?v=3.1.4",
  "./manifest.json",
  "./css/base.css?v=3.1.4",
  "./css/history.css?v=3.1.4",
  "./css/auth.css?v=3.1.4",
  "./css/cycles.css?v=3.1.4",
  "./css/about.css?v=3.1.4",
  "./css/support.css?v=3.1.4",
  "./css/recurrence.css?v=3.1.4",
  "./css/clock.css?v=3.1.4",
  "./css/market.css?v=3.1.4",
  "./css/portfolio.css?v=3.1.4",
  "./css/patrimony.css?v=3.1.4",
  "./css/cards.css?v=3.1.4",
  "./css/importer.css?v=3.1.4",
  "./css/calendar.css?v=3.1.4",
  "./css/desktop.css?v=3.1.4",
  "./css/mobile.css?v=3.1.4",
  "./css/themes.css?v=3.1.4",
  "./css/responsive.css?v=3.1.4",
  "./css/motion.css?v=3.1.4",
  "./js/core.js?v=3.1.4",
  "./js/recurrence.js?v=3.1.4",
  "./js/history.js?v=3.1.4",
  "./js/importer.js?v=3.1.4",
  "./js/cards.js?v=3.1.4",
  "./js/market.js?v=3.1.4",
  "./js/portfolio.js?v=3.1.4",
  "./js/dashboard.js?v=3.1.4",
  "./js/payroll.js?v=3.1.4",
  "./js/patrimony.js?v=3.1.4",
  "./js/calendar.js?v=3.1.4",
  "./js/ui.js?v=3.1.4",
  "./js/transactions.js?v=3.1.4",
  "./js/savings.js?v=3.1.4",
  "./js/overtime.js?v=3.1.4",
  "./js/backup.js?v=3.1.4",
  "./js/drive.js?v=3.1.4",
  "./js/pwa.js?v=3.1.4",
  "./js/mobile-nav.js?v=3.1.4",
  "./js/themes.js?v=3.1.4",
  "./js/motion.js?v=3.1.4",
  "./js/support.js?v=3.1.4",
  "./views/dashboard.html?v=3.1.4",
  "./views/transactions.html?v=3.1.4",
  "./views/importer.html?v=3.1.4",
  "./views/calendar.html?v=3.1.4",
  "./views/cycles.html?v=3.1.4",
  "./views/portfolio.html?v=3.1.4",
  "./views/patrimony.html?v=3.1.4",
  "./views/cards.html?v=3.1.4",
  "./views/savings.html?v=3.1.4",
  "./views/simulator.html?v=3.1.4",
  "./views/thirteenth.html?v=3.1.4",
  "./views/fgts.html?v=3.1.4",
  "./views/fixed.html?v=3.1.4",
  "./views/market.html?v=3.1.4",
  "./views/data.html?v=3.1.4",
  "./views/about.html?v=3.1.4",
  "./views/support.html?v=3.1.4",
  "./views/dialogs.html?v=3.1.4",
  "./css/intelligence.css?v=3.1.4",
  "./js/intelligence.js?v=3.1.4",
  "./js/sp3-tools.js?v=3.1.4",
  "./js/sp3-sync.js?v=3.1.4",
  "./js/sp3-tickets.js?v=3.1.4",
  "./views/intelligence.html?v=3.1.4",
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

  // Nunca armazenar respostas do proxy OAuth em cache offline.
  if(url.pathname.startsWith('/api/') ||
     url.pathname.startsWith('/__/auth/') ||
     url.pathname.startsWith('/__/firebase/')){
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
