/* Push opt-in via Firebase Messaging, configurado no backend. */
(function(){
  'use strict';
  const enable=document.getElementById('sp4PushEnable');
  const disable=document.getElementById('sp4PushDisable');
  const status=document.getElementById('sp4PushStatus');
  if(!enable||!disable||!status)return;
  const PREFIX='saldoplan.push.optin.v4.';
  let pendingTimer;
  const say=message=>{status.textContent=message;};
  async function current(){
    const [{getApps,getApp},{getAuth}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')]);
    const app=getApps().length?getApp():null;
    const user=app?getAuth(app).currentUser:null;
    if(!user)throw new Error('Faça login com Google para habilitar notificações.');
    return {user,token:await user.getIdToken()};
  }
  function dates(){
    const start=new Date();start.setHours(0,0,0,0);const finish=new Date(start);finish.setDate(finish.getDate()+45);
    const valid=str=>typeof str==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(str)&&new Date(str+'T12:00:00')>=start&&new Date(str+'T12:00:00')<=finish;
    const a=[];
    (state.transactions||[]).filter(x=>x.status!=='realized'&&valid(x.date)).forEach(x=>a.push(x.date));
    (state.liabilities||[]).filter(x=>x.status!=='paid'&&valid(x.dueDate)).forEach(x=>a.push(x.dueDate));
    (state.investments||[]).filter(x=>x.status!=='redeemed'&&valid(x.maturityDate)).forEach(x=>a.push(x.maturityDate));
    return [...new Set(a)].sort().slice(0,45);
  }
  let tokenCache=null;
  async function messagingToken(){
    const vapid=window.SALDOPLAN_PUSH_CONFIG?.vapidPublicKey;
    if(!vapid)throw new Error('Push ainda não foi ativado pelo desenvolvedor (chave VAPID pública ausente).');
    const module=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js');
    if(!(await module.isSupported()))throw new Error('Este dispositivo não suporta Firebase Push.');
    const {getApps,getApp}=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
    const registration=await navigator.serviceWorker.ready;
    const token=await module.getToken(module.getMessaging(getApp()),{vapidKey:vapid,serviceWorkerRegistration:registration});
    if(!token)throw new Error('O Google não concedeu um token push neste navegador.');
    return {token,module};
  }
  async function send(method,token,account){
    const response=await fetch('/api/push-subscription',{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${account.token}`},body:JSON.stringify({token,dates:dates(),advanceDays:Number(document.getElementById('sp5PushDays')?.value||0),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.message||`Falha no serviço (${response.status})`);
    return data;
  }
  async function configure(){
    if(!window.isSecureContext||!('serviceWorker' in navigator)||!('Notification' in window))throw new Error('Notificações exigem HTTPS e navegador compatível.');
    const account=await current();
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('O navegador não autorizou notificações.');
    const {token}=await messagingToken();
    await send('POST',token,account);
    tokenCache=token;localStorage.setItem(PREFIX+account.user.uid,'true');
    say('Lembretes com o aplicativo fechado ativados neste navegador. Os dados financeiros completos não são enviados ao servidor de notificações.');
  }
  window.saldoPlanV4PushAuthChanged=async()=>{
    try{
      const account=await current();
      if(localStorage.getItem(PREFIX+account.user.uid)!=='true'||Notification.permission!=='granted')return;
      const {token}=await messagingToken();tokenCache=token;
      await send('POST',token,account);
      say('Lembretes push ativados neste aparelho. Datas previstas conferidas.');
    }catch(e){say('Não foi possível revalidar os lembretes push: '+e.message);}
  };
  enable.addEventListener('click',async()=>{
    enable.disabled=true;
    try{await configure();}catch(e){say(e.message);}
    finally{enable.disabled=false;}
  });
  disable.addEventListener('click',async()=>{
    disable.disabled=true;
    try{
      const account=await current();
      const {token,module}=await messagingToken();
      await send('DELETE',token,account);
      await module.deleteToken(module.getMessaging());
      tokenCache=null;localStorage.removeItem(PREFIX+account.user.uid);
      say('Notificações em segundo plano desativadas neste aparelho.');
    }catch(e){say('Não foi possível desativar no servidor: '+e.message);}
    finally{disable.disabled=false;}
  });
  window.saldoPlanPushScheduleDirty=()=>{
    if(!tokenCache)return;
    clearTimeout(pendingTimer);
    pendingTimer=setTimeout(async()=>{
      try{const account=await current();if(localStorage.getItem(PREFIX+account.user.uid)==='true')await send('POST',tokenCache,account);}
      catch(e){console.warn('Reagendamento push pendente:',e.message);}
    },30000);
  };
  say('Opcional: lembretes em segundo plano exigem ativação do serviço push na Vercel. Você pode continuar usando os avisos com o app aberto.');
})();
