const CACHE='saldoplan-v5.1.4-backup-simples';

const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=5.1.4",
  "./drive-config.js?v=4.0.0",
  "./app.js?v=5.1.4",
  "./auth.js?v=5.1.4",
  "./manifest.json",
  "./css/base.css?v=4.0.0",
  "./css/history.css?v=4.0.0",
  "./css/auth.css?v=4.0.0",
  "./css/cycles.css?v=4.0.0",
  "./css/about.css?v=4.0.0",
  "./css/support.css?v=4.0.0",
  "./css/recurrence.css?v=4.0.0",
  "./css/clock.css?v=4.0.0",
  "./css/market.css?v=4.0.0",
  "./css/portfolio.css?v=4.0.0",
  "./css/patrimony.css?v=4.0.0",
  "./css/cards.css?v=4.0.0",
  "./css/importer.css?v=4.0.0",
  "./css/calendar.css?v=4.0.0",
  "./css/desktop.css?v=4.0.0",
  "./css/mobile.css?v=4.0.0",
  "./css/themes.css?v=4.0.0",
  "./css/responsive.css?v=4.0.0",
  "./css/motion.css?v=4.0.0",
  "./js/core.js?v=4.0.0",
  "./js/recurrence.js?v=4.0.0",
  "./js/history.js?v=4.0.0",
  "./js/importer.js?v=4.0.0",
  "./js/cards.js?v=4.0.0",
  "./js/market.js?v=4.0.0",
  "./js/portfolio.js?v=4.0.0",
  "./js/dashboard.js?v=4.0.0",
  "./js/payroll.js?v=4.0.0",
  "./js/patrimony.js?v=4.0.0",
  "./js/calendar.js?v=4.0.0",
  "./js/ui.js?v=4.0.0",
  "./js/transactions.js?v=4.0.0",
  "./js/savings.js?v=4.0.0",
  "./js/overtime.js?v=4.0.0",
  "./js/backup.js?v=4.0.0",
  "./js/drive.js?v=4.0.0",
  "./js/pwa.js?v=4.0.0",
  "./js/mobile-nav.js?v=4.0.0",
  "./js/themes.js?v=4.0.0",
  "./js/motion.js?v=4.0.0",
  "./js/support.js?v=4.0.0",
  "./views/dashboard.html?v=4.0.0",
  "./views/transactions.html?v=4.0.0",
  "./views/importer.html?v=4.0.0",
  "./views/calendar.html?v=4.0.0",
  "./views/cycles.html?v=4.0.0",
  "./views/portfolio.html?v=4.0.0",
  "./views/patrimony.html?v=4.0.0",
  "./views/cards.html?v=4.0.0",
  "./views/savings.html?v=4.0.0",
  "./views/simulator.html?v=4.0.0",
  "./views/thirteenth.html?v=4.0.0",
  "./views/fgts.html?v=4.0.0",
  "./views/fixed.html?v=4.0.0",
  "./views/market.html?v=4.0.0",
  "./views/data.html?v=5.1.4",
  "./views/about.html?v=4.0.0",
  "./views/support.html?v=4.0.0",
  "./views/dialogs.html?v=4.0.0",
  "./css/intelligence.css?v=4.0.0",
  "./js/intelligence.js?v=4.0.0",
  "./js/sp3-tools.js?v=4.0.0",
  "./js/sp3-sync.js?v=4.0.0",
  "./js/sp3-tickets.js?v=4.0.0",
  "./views/intelligence.html?v=4.0.0",
  "./push-config.js?v=4.0.0",
  "./css/v4.css?v=4.0.0-backup-workspace",
  "./js/v4-features.js?v=4.0.0",
  "./js/v4-push.js?v=4.0.0",
  "./js/v4-settings-tabs.js?v=4.0.0-backup-workspace",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-192.png",
  "./icons/maskable-512.png",
  "./css/v5.css?v=5.0.0",
  "./js/v5-engine.js?v=5.0.0",
  "./js/v5-features.js?v=5.0.0",
  "./js/v5-admin.js?v=5.0.0",
  "./js/v51-live-engine.js?v=5.1.4",
  "./js/v51-live-sync.js?v=5.1.4",
  "./css/v51-live.css?v=5.1.4",
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

// Push em segundo plano: conteúdo genérico, sem saldos nem descrições.
self.addEventListener('push',event=>{
  if(!event.data)return;
  let payload={};try{payload=event.data.json();}catch{return;}
  const data=payload.data||payload.notification||payload;
  const title=typeof data.title==='string'?data.title:'SaldoPlan';
  const body=typeof data.body==='string'?data.body:'Verifique seus compromissos financeiros.';
  event.waitUntil(self.registration.showNotification(title,{body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:'saldoplan-reminder',data:{url:self.registration.scope}}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    const client=clients.find(c=>c.url.startsWith(self.registration.scope));
    if(client)return client.focus();
    return self.clients.openWindow(self.registration.scope);
  }));
});
