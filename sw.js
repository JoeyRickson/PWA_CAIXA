const CACHE='saldoplan-v4.0.0-backup-workspace-fixdatas';

const ASSETS=[
  "./",
  "./index.html",
  "./styles.css?v=4.0.0-backup-workspace",
  "./drive-config.js?v=4.0.0-fixdatas",
  "./app.js?v=4.0.0-fixdatas",
  "./auth.js?v=4.0.0-fixdatas",
  "./manifest.json",
  "./css/base.css?v=4.0.0-fixdatas",
  "./css/history.css?v=4.0.0-fixdatas",
  "./css/auth.css?v=4.0.0-fixdatas",
  "./css/cycles.css?v=4.0.0-fixdatas",
  "./css/about.css?v=4.0.0-fixdatas",
  "./css/support.css?v=4.0.0-fixdatas",
  "./css/recurrence.css?v=4.0.0-fixdatas",
  "./css/clock.css?v=4.0.0-fixdatas",
  "./css/market.css?v=4.0.0-fixdatas",
  "./css/portfolio.css?v=4.0.0-fixdatas",
  "./css/patrimony.css?v=4.0.0-fixdatas",
  "./css/cards.css?v=4.0.0-fixdatas",
  "./css/importer.css?v=4.0.0-fixdatas",
  "./css/calendar.css?v=4.0.0-fixdatas",
  "./css/desktop.css?v=4.0.0-fixdatas",
  "./css/mobile.css?v=4.0.0-fixdatas",
  "./css/themes.css?v=4.0.0-fixdatas",
  "./css/responsive.css?v=4.0.0-fixdatas",
  "./css/motion.css?v=4.0.0-fixdatas",
  "./js/core.js?v=4.0.0-fixdatas",
  "./js/recurrence.js?v=4.0.0-fixdatas",
  "./js/history.js?v=4.0.0-fixdatas",
  "./js/importer.js?v=4.0.0-fixdatas",
  "./js/cards.js?v=4.0.0-fixdatas",
  "./js/market.js?v=4.0.0-fixdatas",
  "./js/portfolio.js?v=4.0.0-fixdatas",
  "./js/dashboard.js?v=4.0.0-fixdatas",
  "./js/payroll.js?v=4.0.0-fixdatas",
  "./js/patrimony.js?v=4.0.0-fixdatas",
  "./js/calendar.js?v=4.0.0-fixdatas",
  "./js/ui.js?v=4.0.0-fixdatas",
  "./js/transactions.js?v=4.0.0-fixdatas",
  "./js/savings.js?v=4.0.0-fixdatas",
  "./js/overtime.js?v=4.0.0-fixdatas",
  "./js/backup.js?v=4.0.0-fixdatas",
  "./js/drive.js?v=4.0.0-fixdatas",
  "./js/pwa.js?v=4.0.0-fixdatas",
  "./js/mobile-nav.js?v=4.0.0-fixdatas",
  "./js/themes.js?v=4.0.0-fixdatas",
  "./js/motion.js?v=4.0.0-fixdatas",
  "./js/support.js?v=4.0.0-fixdatas",
  "./views/dashboard.html?v=4.0.0-fixdatas",
  "./views/transactions.html?v=4.0.0-fixdatas",
  "./views/importer.html?v=4.0.0-fixdatas",
  "./views/calendar.html?v=4.0.0-fixdatas",
  "./views/cycles.html?v=4.0.0-fixdatas",
  "./views/portfolio.html?v=4.0.0-fixdatas",
  "./views/patrimony.html?v=4.0.0-fixdatas",
  "./views/cards.html?v=4.0.0-fixdatas",
  "./views/savings.html?v=4.0.0-fixdatas",
  "./views/simulator.html?v=4.0.0-fixdatas",
  "./views/thirteenth.html?v=4.0.0-fixdatas",
  "./views/fgts.html?v=4.0.0-fixdatas",
  "./views/fixed.html?v=4.0.0-fixdatas",
  "./views/market.html?v=4.0.0-fixdatas",
  "./views/data.html?v=4.0.0-fixdatas",
  "./views/about.html?v=4.0.0-fixdatas",
  "./views/support.html?v=4.0.0-fixdatas",
  "./views/dialogs.html?v=4.0.0-fixdatas",
  "./css/intelligence.css?v=4.0.0-fixdatas",
  "./js/intelligence.js?v=4.0.0-fixdatas",
  "./js/sp3-tools.js?v=4.0.0-fixdatas",
  "./js/sp3-sync.js?v=4.0.0-fixdatas",
  "./js/sp3-tickets.js?v=4.0.0-fixdatas",
  "./views/intelligence.html?v=4.0.0-fixdatas",
  "./push-config.js?v=4.0.0-fixdatas",
  "./css/v4.css?v=4.0.0-backup-workspace",
  "./js/v4-features.js?v=4.0.0-fixdatas",
  "./js/v4-push.js?v=4.0.0-fixdatas",
  "./js/v4-settings-tabs.js?v=4.0.0-backup-workspace",
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
