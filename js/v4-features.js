/* SaldoPlan v4.0.0 — perfis por conta, atalhos e diagnostico (sem framework). */
(function(){
  'use strict';
  const ACTIVE='saldoplan.profile.active.v4';
  const CLAIMED='saldoplan.profile.claimedLegacy.v4';
  const profileId=uid=>'user_'+String(uid||'');
  const valid=id=>/^user_[a-zA-Z0-9_-]{1,128}$/.test(id);
  const profileKey=id=>`meuCaixa.profile.${id}.v4`;
  const current=()=>localStorage.getItem(ACTIVE)||'legacy';
  const emptyState=()=>{
    const raw=deepClone(seed);
    raw.transactions=[]; // Nunca iniciar perfil novo com os demonstrativos da seed.
    raw.savings=[];raw.fixedTemplates=[];raw.savingTemplates=[];
    raw.overtimeLogs=[];raw.investments=[];raw.financialGoals=[];
    raw.fgtsByYear={};raw.fgtsAccounts=[];raw.creditCards=[];raw.cardPurchases=[];
    return JSON.stringify(raw);
  };
  function switchProfile(next){
    if((localStorage.getItem(ACTIVE)||'legacy')===next)return true;
    // Não copiar por padrão dados de uma conta para outra, nem excluir o legado.
    localStorage.setItem(ACTIVE,next);
    window.location.reload();
    return false;
  }
  window.saldoPlanV4ProfileAuth=user=>{
    if(!user?.uid || !/^[A-Za-z0-9_-]{1,128}$/.test(user.uid))return false;
    const id=profileId(user.uid);
    if(!valid(id))return false;
    if(current()===id){
      document.documentElement.classList.remove('sp4-profile-locked');
      return true;
    }
    const key=profileKey(id);
    if(!localStorage.getItem(key)){
      let cloneLegacy=false;
      const first=current()==='legacy'&&!localStorage.getItem(CLAIMED);
      if(first){
        cloneLegacy=confirm('SaldoPlan v4: deseja COPIAR os dados financeiros que já existem neste navegador para sua conta Google atual?\n\nOK = copiar sem apagar o original.\nCancelar = começar um perfil vazio.\n\nFaça antes um backup JSON em Dados e backup, se ainda não tiver um.');
      }
      try{
        const oldText=localStorage.getItem('meuCaixa.v1');
        localStorage.setItem(key,cloneLegacy&&oldText?oldText:emptyState());
        if(first)localStorage.setItem(CLAIMED,'true');
      }catch(e){
        alert('Não foi possível criar o perfil sem arriscar os dados existentes. Libere espaço de armazenamento e tente novamente. Nenhum dado foi apagado.');
        console.error(e);return false;
      }
    }
    return switchProfile(id);
  };
  window.saldoPlanV4ProfileGuest=()=>{
    if(current()==='legacy'||current()==='guest'){
      document.documentElement.classList.remove('sp4-profile-locked');return true;
    }
    if(!localStorage.getItem('meuCaixa.guest.v4')){
      try{localStorage.setItem('meuCaixa.guest.v4',emptyState());}
      catch(e){console.error(e);return false;}
    }
    return switchProfile('guest');
  };
  window.saldoPlanV4ProfileSignedOut=()=>{
    if(!valid(current())){document.documentElement.classList.remove('sp4-profile-locked');return;}
    window.saldoPlanV4ProfileGuest();
  };
  // Se outra aba mudou o perfil, não deixar continuar editando o estado antigo.
  window.addEventListener('storage',event=>{
    if(event.key===ACTIVE && (event.newValue||'legacy')!==PROFILE_ACTIVE_SCOPE){
      document.documentElement.classList.add('sp4-profile-locked');
      location.reload();
    }
  });
  // Atalho mobile, reutilizando a caixa original de lançamentos.
  const fab=document.createElement('button');
  fab.className='sp4-shortcut';fab.type='button';fab.textContent='+';
  fab.setAttribute('aria-label','Criar lançamento rápido');fab.setAttribute('aria-expanded','false');
  const menu=document.createElement('div');menu.className='sp4-fast-menu';menu.hidden=true;
  menu.innerHTML='<button type="button" data-kind="expense">− Nova despesa</button><button type="button" data-kind="income">+ Nova receita</button><button type="button" data-kind="planned">◷ Despesa prevista</button>';
  document.body.append(fab,menu);
  function close(){menu.hidden=true;fab.setAttribute('aria-expanded','false');}
  fab.addEventListener('click',()=>{if(document.documentElement.classList.contains('sp4-profile-locked'))return;menu.hidden=!menu.hidden;fab.setAttribute('aria-expanded',String(!menu.hidden));});
  menu.addEventListener('click',event=>{
    const kind=event.target.closest('[data-kind]')?.dataset.kind;
    if(!kind)return;close();
    if(typeof openEntry!=='function')return;
    openEntry(kind==='income'?'income':'expense');
    if(kind==='planned')document.getElementById('entryStatus').value='planned';
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
  document.addEventListener('click',event=>{if(!event.target.closest('.sp4-shortcut,.sp4-fast-menu'))close();});

  // Dados do diagnostico: locais, sem dados pessoais enviados ao servidor.
  const target=document.getElementById('sp4Diagnostics');
  const account=document.getElementById('sp4ProfileInfo');
  function renderAccount(){
    if(!account)return;
    const user=window.saldoPlanAuthUser;
    account.textContent=user?`Perfil Google separado: ${user.email||'conta conectada'}. Os dados antigos foram preservados no navegador.`:
      'Modo local: os dados deste perfil permanecem somente neste navegador, salvo backup externo.';
  }
  async function inspect(){
    const text=localStorage.getItem(STORAGE_KEY)||'';
    const size=new Blob([text]).size;
    const usage=await navigator.storage?.estimate?.().catch(()=>null);
    const fields=[
      ['Perfil',window.saldoPlanAuthUser?.email||'Offline'],
      ['Lançamentos',String(state.transactions?.length||0)],
      ['Estado financeiro local',`${(size/1024).toFixed(1)} KiB`],
      ['Armazenamento do site',usage?`${((usage.usage||0)/1048576).toFixed(1)} MiB usados`:'Indisponível'],
      ['Backup Drive',state.cloud?.lastBackupAt?new Date(state.cloud.lastBackupAt).toLocaleString('pt-BR'):'Sem confirmação recente'],
      ['Modo',navigator.onLine?'Online':'Offline'],
      ['Notificações',typeof Notification==='undefined'?'Indisponíveis':Notification.permission]
    ];
    if(!target)return;
    const dl=target.querySelector('dl');
    dl.replaceChildren();
    fields.forEach(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;dl.append(dt,dd);});
    renderAccount();
  }
  document.getElementById('sp4Inspect')?.addEventListener('click',()=>void inspect());
  document.getElementById('sp4ExportDiagnostics')?.addEventListener('click',async()=>{
    await inspect();
    const lines=Array.from(target.querySelectorAll('dt')).map(dt=>`${dt.textContent}: ${dt.nextElementSibling?.textContent||''}`);
    const blob=new Blob([`SaldoPlan v4 — Diagnóstico local\n${lines.join('\n')}\n`],{type:'text/plain'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='SaldoPlan-diagnostico.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  setTimeout(()=>{renderAccount();void inspect();},700);
  window.saldoPlanV4RefreshDiagnostic=inspect;
})();
