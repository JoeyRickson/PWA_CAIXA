/* SaldoPlan v3 — notificações durante uso e conferência local de backups */
(function(){
  'use strict';
  const get=id=>document.getElementById(id);
  const PREF='saldoplan.notificationsEnabled.v3';
  const LAST='saldoplan.lastNotificationDay.v3';
  function status(id,message,tone=''){const el=get(id);if(el){el.textContent=message;el.dataset.tone=tone;}}
  const enabled=()=>localStorage.getItem(PREF)==='true';
  const available=()=>('Notification' in window)&&window.isSecureContext;
  function notify(title,body){
    if(!available()||Notification.permission!=='granted')return;
    try{new Notification(title,{body,icon:'icons/icon-192.png',tag:'saldoplan-financial-alert'});}catch(error){console.warn('Notificação indisponível:',error);}
  }
  function dailyCheck(){
    if(!enabled()||!available()||Notification.permission!=='granted'||typeof calendarAlerts!=='function')return;
    const day=new Date().toLocaleDateString('en-CA');
    if(localStorage.getItem(LAST)===day)return;
    const alerts=calendarAlerts().filter(x=>x.severity==='warning'||x.severity==='danger');
    if(alerts.length){notify('SaldoPlan · Avisos financeiros',`${alerts.length} alerta(s) importante(s). Primeiro: ${alerts[0].title}`);}
    localStorage.setItem(LAST,day);
  }
  get('sp3NotifyEnabled')?.addEventListener('change',e=>{
    localStorage.setItem(PREF,String(e.target.checked));status('sp3NotifyStatus',e.target.checked?'Ativado. Permita notificações para receber avisos enquanto o app estiver aberto.':'Avisos desativados.');
    if(e.target.checked)dailyCheck();
  });
  get('sp3NotifyPermission')?.addEventListener('click',async()=>{
    if(!available()){status('sp3NotifyStatus','Este navegador/contexto não suporta notificações.','error');return;}
    const permission=await Notification.requestPermission();
    status('sp3NotifyStatus',`Permissão: ${permission}. ${permission==='granted'?'Avisos permitidos.':'O navegador não permitiu notificações.'}`,permission==='granted'?'success':'error');
  });
  get('sp3NotifyTest')?.addEventListener('click',()=>{
    if(!available()||Notification.permission!=='granted'){status('sp3NotifyStatus','Primeiro autorize notificações no navegador.','error');return;}
    notify('SaldoPlan · Teste','Se você está vendo esta mensagem, a notificação durante o uso funciona.');
    status('sp3NotifyStatus','Notificação de teste solicitada.','success');
  });
  if(get('sp3NotifyEnabled'))get('sp3NotifyEnabled').checked=enabled();
  if(get('sp3NotifyStatus'))status('sp3NotifyStatus',available()?`Permissão do navegador: ${Notification.permission}.`:'Notificações indisponíveis neste contexto.');
  window.addEventListener('focus',dailyCheck);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)dailyCheck();});
  setTimeout(dailyCheck,1000);
  async function sha(value){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');}
  get('sp3IntegrityCheck')?.addEventListener('click',async()=>{
    try{const text=JSON.stringify(state);const sum=await sha(text);status('sp3IntegrityStatus',`Estado legível · ${state.transactions.length} lançamentos · ${(new Blob([text]).size/1024).toFixed(1)} KiB · SHA-256 ${sum}`,'success');}
    catch(error){status('sp3IntegrityStatus',`Não foi possível verificar: ${error.message}`,'error');}
  });
  get('sp3IntegrityFile')?.addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>10*1024*1024)throw new Error('O arquivo excede 10 MiB.');
      const text=await file.text(),raw=JSON.parse(text);
      if(!raw||typeof raw!=='object'||!Array.isArray(raw.transactions))throw new Error('Estrutura de backup incompatível.');
      const digest=await sha(text);
      status('sp3IntegrityStatus',`Backup examinado, sem restaurar: ${raw.transactions.length} lançamentos · ${(file.size/1024).toFixed(1)} KiB · SHA-256 ${digest}. Para restaurar, use Importar backup na seção acima.`,'success');
    }catch(error){status('sp3IntegrityStatus',`Backup inválido: ${error.message}`,'error');}
    event.target.value='';
  });
})();
