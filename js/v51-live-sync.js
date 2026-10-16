/* SaldoPlan v5.1 — Live Sync. Firestore por registro com revisões, fila offline e conflitos explícitos. */
(function(){
  'use strict';
  const E=window.SaldoPlanLiveEngine;
  const panel=document.getElementById('sp51LivePanel');
  if(!E||!panel)return;
  const $=id=>document.getElementById(id);
  const status=$('sp51LiveStatus'),summary=$('sp51LiveSummary'),setup=$('sp51LiveSetup');
  const start=$('sp51LiveStart'),fromCloud=$('sp51LiveUseCloud'),merge=$('sp51LiveMerge');
  const reconnect=$('sp51LiveRetry'),conflictBox=$('sp51LiveConflicts'),conflictList=$('sp51LiveConflictList');
  const extraChoice=$('sp514ExtraChoice');
  const authProject='saldoplan';
  const key=part=>`saldoplan.live.v51.${part}.${PROFILE_ACTIVE_SCOPE}`;
  const installationKey='saldoplan.live.v51.deviceId';
  let deviceId=localStorage.getItem(installationKey);
  if(!deviceId){deviceId=crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;localStorage.setItem(installationKey,deviceId);}
  let authUid=null,unsub=null,sdk=null,db=null,scopeRef=null,epoch=0;
  let remote=new Map(),baseRevisions={},pending={},conflicts={};
  let linked=false,ready=false,firstSnapshot=false,flushing=false,saveTimer=null,renderTimer=null,autoActivating=false;
  let initialDocCount=0,lastError='',inflightKey=null,remoteMeta=null;
  const parse=(str,fallback)=>{try{return JSON.parse(str)||fallback}catch{return fallback}};
  // Mesmo após várias recargas, um perfil v4 recém-criado continua reconhecível.
  // Não classificar como novo se houve edições, restaurações ou importações locais.
  const freshTemplate=E.blankProfileTemplate(seed,migrateState);
  // A primeira conexão é silenciosa somente quando não há nada local a perder:
  // (a) perfil padrão; (b) todos os registros locais já existem idênticos na nuvem.
  // Dados locais diferentes/exclusivos exigem uma escolha consciente.
  // Excecao: efeitos padrao de renderizacao, estritamente validados pelo engine.
  function candidateAutoMode(){
    if(linked||!ready||countPending()||Object.keys(conflicts).length
       ||remoteMeta?.phase==='initializing')return null;
    const hasCloud=remoteMeta?.phase==='ready'||initialDocCount>0;
    if((E.isPristineProfile(state,freshTemplate)||E.isGeneratedFreshProfile(state,freshTemplate)))return hasCloud?'replace':'upload';
    if(hasCloud&&E.isEntireLocalProfileOnCloud(state,remote))return 'replace';
    return null;
  }
  const safeAutoStart=()=>!autoActivating&&candidateAutoMode()!==null;

  const linkedFor=uid=>localStorage.getItem(key('linked'))===uid;
  const statusText=(message,tone='')=>{
    status.textContent=message;status.dataset.tone=tone;
  };
  const snapshotText=value=>JSON.stringify(value);
  const ownUid=()=>window.saldoPlanAuthUser?.uid||null;
  const correctlyScoped=uid=>uid&&PROFILE_ACTIVE_SCOPE===`user_${uid}`
    &&(localStorage.getItem(PROFILE_ACTIVE_KEY)||'legacy')===PROFILE_ACTIVE_SCOPE;
  function writeLocalWithoutSync(){
    // Não chama save(): trata-se de dados recebidos, não de uma nova edição local.
    try{
      localStorage.setItem(STORAGE_KEY,snapshotText(state));
      localStorage.setItem(`${STORAGE_KEY}.savedAt`,new Date().toISOString());
    }catch(e){showError(new Error('Sem espaço para salvar dados sincronizados neste aparelho. Exporte seus dados e libere armazenamento.'));throw e;}
    clearTimeout(renderTimer);
    renderTimer=setTimeout(()=>{try{renderAll();window.saldoPlanRenderIntelligence?.();}catch(e){console.error(e)}},120);
  }
  function safety(label){
    // Sempre usa o estado ainda gravado em disco ANTES da substituição remota.
    const before=localStorage.getItem(STORAGE_KEY)||snapshotText(state);
    try{if(typeof pushUndoSnapshot==='function')pushUndoSnapshot(label,before);}catch{}
    try{localStorage.setItem(PREVIOUS_KEY,before);}catch{}
    // Captura da primeira importação mantida até o usuário apagá-la conscientemente.
    try{if(!localStorage.getItem(key('preMigration')))localStorage.setItem(key('preMigration'),before);}catch{}
  }
  function persist(){
    localStorage.setItem(key('queue'),JSON.stringify(pending));
    localStorage.setItem(key('knownRevs'),JSON.stringify(baseRevisions));
  }
  function countPending(){return Object.keys(pending).length;}
  function updateUi(){
    const count=countPending(),blocked=Object.keys(conflicts).length;
    const online=navigator.onLine;
    if(linked){
      const notice=[];
      if(count)notice.push(`${count} alteração(ões) aguardando envio`);
      if(blocked)notice.push(`${blocked} item(ns) precisam da sua escolha`);
      if(!online)notice.push('sem conexão com a internet');
      summary.textContent=notice.join(' · ');
      summary.hidden=notice.length===0;
    }else{
      summary.textContent='';summary.hidden=true;
    }
    setup.hidden=linked||autoActivating||!authUid||!ready;
    const hasCloud=remoteMeta?.phase==='ready'||initialDocCount>0;
    fromCloud.hidden=!hasCloud;
    start.hidden=hasCloud;
    if(extraChoice)extraChoice.hidden=!hasCloud;
    const setupTitle=$('sp514SetupTitle'),setupHelp=$('sp514SetupHelp');
    if(setupTitle)setupTitle.textContent=hasCloud?'Encontramos informações diferentes':'Guardar seus dados nesta conta';
    if(setupHelp)setupHelp.textContent=hasCloud
      ?'Este aparelho e sua conta possuem informações diferentes. Escolha o que manter. Se os dois tiverem dados importantes, faça antes uma cópia em Arquivo e versões.'
      :'Ainda não há dados salvos nesta conta. Você pode enviar os dados deste aparelho para encontrá-los depois nos outros.';
    reconnect.hidden=!linked;
    conflictBox.hidden=!blocked;
    if(blocked)renderConflicts();
  }
  function showError(e){
    const code=e?.code||'';
    const message=String(e?.message||e);
    lastError=message;
    console.warn('[SaldoPlan Sync]',code||'erro',message);
    if(code==='permission-denied'||message.includes('Missing or insufficient permissions')){
      statusText('Não conseguimos acessar seus dados salvos. Tente novamente. Se continuar, entre em contato com o suporte. Seus dados deste aparelho foram preservados.','error');
    }else if(!navigator.onLine||code==='unavailable'){
      statusText('Sem internet. Suas alterações estão guardadas e serão enviadas quando a conexão voltar.','warning');
    }else statusText('Não conseguimos atualizar agora. Seus dados deste aparelho estão preservados. Tente novamente.','error');
    updateUi();
  }
  function remoteRecord(doc){
    const raw=doc.data();
    if(!raw||typeof raw.section!=='string'||typeof raw.itemId!=='string'||typeof raw.deleted!=='boolean')return null;
    const k=E.recordKey(raw.section,raw.itemId);
    return {key:k,section:raw.section,itemId:raw.itemId,deleted:raw.deleted,payload:String(raw.payload||''),revision:Number(raw.revision||0),updatedAt:raw.updatedAt?.toDate?.()?.toISOString?.()||'',actor:raw.actor||''};
  }
  function rememberRev(k,rec){
    baseRevisions[k]=rec?.revision??0;
  }
  function stage(beforeText,afterText){
    if(!linked||!correctlyScoped(authUid))return;
    let changes;
    try{changes=E.difference(JSON.parse(beforeText||'{}'),JSON.parse(afterText||'{}'));}
    catch(e){showError(e);return;}
    if(!changes.length)return;
    for(const rec of changes){
      const k=E.recordKey(rec.section,rec.itemId);
      if(!pending[k])pending[k]={...rec,baseRevision:baseRevisions[k]??0};
      else pending[k]={...rec,baseRevision:pending[k].baseRevision};
      // Cancelar uma edição revertida exatamente ao conteúdo remoto.
      const server=remote.get(k);
      if(server&&(server.deleted===rec.deleted)&&((server.deleted)||server.payload===rec.payload)){
        delete pending[k];delete conflicts[k];
      }
    }
    try{persist();}catch(e){showError(new Error('Sem espaço para guardar a fila offline. Exporte um JSON e libere armazenamento.'));return;}
    updateUi();scheduleFlush();
  }
  window.sp51LiveOnSave=stage;
  const wait=(ms)=>new Promise(r=>setTimeout(r,ms));
  function scheduleFlush(delay=750){
    clearTimeout(saveTimer);
    if(!linked||!ready||!navigator.onLine||!authUid)return;
    saveTimer=setTimeout(()=>{void flush();},delay);
  }
  async function openFirebase(){
    if(sdk)return sdk;
    sdk=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
    const app=await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
    const application=app.getApps().length?app.getApp():null;
    if(!application)throw new Error('Faça login com Google antes de sincronizar.');
    db=sdk.getFirestore(application);
    return sdk;
  }
  async function completeBootstrap(){
    if(localStorage.getItem(key('bootstrap'))!=='true'||countPending()||Object.keys(conflicts).length)return;
    const ref=sdk.doc(scopeRef,E.idFor('__meta','init'));
    await sdk.runTransaction(db,async tx=>{
      const snap=await tx.get(ref);if(!snap.exists())throw new Error('Inicialização incompleta: marcador ausente.');
      const data=snap.data(),current=JSON.parse(data.payload||'{}');
      if(current.phase==='ready')return;
      if(current.actor!==deviceId)throw new Error('Inicialização vinculada a outro aparelho.');
      tx.update(ref,{payload:JSON.stringify({...current,phase:'ready'}),revision:Number(data.revision||1)+1,updatedAt:sdk.serverTimestamp()});
    });
    localStorage.removeItem(key('bootstrap'));
  }
  async function flush(){
    if(flushing||!linked||!ready||!correctlyScoped(authUid)||!navigator.onLine)return;
    flushing=true;const startedEpoch=epoch;
    try{
      const keys=Object.keys(pending);
      for(const k of keys){
        if(startedEpoch!==epoch||!correctlyScoped(authUid))return;
        if(conflicts[k]||!pending[k])continue;
        const entry={...pending[k]},ref=sdk.doc(scopeRef,E.idFor(entry.section,entry.itemId));
        try{
          let assignedRevision=0;
          inflightKey=k;
          await sdk.runTransaction(db,async tx=>{
            const snap=await tx.get(ref),current=snap.exists()?snap.data():null;
            const revision=Number(current?.revision||0);
            if(revision!==entry.baseRevision){const error=new Error('alterado em outro aparelho');error.isConflict=true;throw error;}
            assignedRevision=revision+1;
            tx.set(ref,{section:entry.section,itemId:entry.itemId,payload:entry.payload,
              deleted:entry.deleted,revision:assignedRevision,actor:deviceId,updatedAt:sdk.serverTimestamp()});
          });
          if(startedEpoch!==epoch)return;
          // Outra edição local enquanto a gravação estava em voo fica na fila, com a nova base.
          if(pending[k]&&pending[k].payload===entry.payload&&pending[k].deleted===entry.deleted){delete pending[k];}
          else if(pending[k])pending[k].baseRevision=assignedRevision;
          baseRevisions[k]=assignedRevision;
          persist();
        }catch(e){
          if(e.isConflict){conflicts[k]={reason:'Este item foi alterado no outro aparelho.'};statusText('Um item foi alterado nos dois aparelhos. Escolha qual versão manter.','warning');}
          else{showError(e);break;}
        }finally{inflightKey=null;}
      }
      if(startedEpoch===epoch){
        if(!countPending()&&!Object.keys(conflicts).length){try{await completeBootstrap();}catch(e){showError(e);}}
        updateUi();if(!Object.keys(conflicts).length&&!countPending())statusText('Tudo certo! Seus dados estão atualizados.','success');
      }
    }finally{flushing=false;}
  }
  function applyChanges(){
    if(!linked||!correctlyScoped(authUid))return;
    let changed=false;
    // Snapshot de segurança ANTES de aplicar mudanças remotas.
    const before=snapshotText(state);
    for(const [k,r] of remote){
      if(pending[k]){
        if(inflightKey===k&&r.actor===deviceId&&r.revision===(pending[k].baseRevision||0)+1){
          pending[k].baseRevision=r.revision;
          continue;
        }
        if(r.revision!==(pending[k]?.baseRevision??0) && !conflicts[k])conflicts[k]={reason:'Mudança simultânea no mesmo registro.'};
        continue;
      }
      try{changed=E.applyRecord(state,r)||changed;}catch(e){console.warn('Registro remoto inválido:',k,e);}
    }
    if(changed){
      try{if(typeof pushUndoSnapshot==='function')pushUndoSnapshot('Antes de atualizar dados pela sincronização',before);}catch{}
      try{localStorage.setItem(PREVIOUS_KEY,before);}catch{}
      writeLocalWithoutSync();
    }
    persist();updateUi();
  }
  function receive(snap,expectedEpoch){
    if(expectedEpoch!==epoch||!correctlyScoped(authUid))return;
    if(snap.metadata.fromCache){statusText('Conferindo suas informações salvas…','warning');return;}
    const fresh=new Map();remoteMeta=null;
    for(const doc of snap.docs){
      const r=remoteRecord(doc);if(!r)continue;
      if(r.section==='__meta'){try{remoteMeta=JSON.parse(r.payload);}catch{}continue;}
      fresh.set(r.key,r);
    }
    remote=fresh;initialDocCount=fresh.size;ready=true;
    if(!linked&&remoteMeta?.phase==='initializing'){
      setup.hidden=true;statusText('Outro aparelho ainda está salvando seus dados. Aguarde um momento.','warning');return;
    }
    if(linked){
      for(const [k,r] of fresh)if(!pending[k])rememberRev(k,r);
      applyChanges();scheduleFlush();
      if(!countPending()&&!Object.keys(conflicts).length)statusText('Tudo certo! Seus dados estão atualizados.','success');
    }else if(autoActivating){
      setup.hidden=true;
    }else if(safeAutoStart()){
      // Snapshots do cache são bloqueados acima. Só um snapshot confirmado pelo
      // servidor pode autorizar a vinculação silenciosa desta conta.
      setup.hidden=true;
      const isCloudInitialized=remoteMeta?.phase==='ready'||initialDocCount>0;
      statusText(isCloudInitialized
        ?'Buscando seus dados salvos…'
        :'Preparando seus dados…');
      void autoConnect(expectedEpoch);
    }else{
      setup.hidden=false;
      statusText(snap.empty?'Ainda não encontramos dados salvos na sua conta. Você pode começar usando os dados deste aparelho.':'Há informações diferentes neste aparelho e na sua conta. Escolha o que deseja manter.','warning');
      updateUi();
    }
    firstSnapshot=true;
  }
  async function autoConnect(expectedEpoch){
    const mode=candidateAutoMode();
    if(expectedEpoch!==epoch||autoActivating||!mode)return;
    autoActivating=true;updateUi();
    try{
      await activate(mode,{automatic:true,expectedEpoch});
    }finally{
      autoActivating=false;updateUi();
    }
  }
  async function activate(mode,{automatic=false,expectedEpoch=epoch}={}){
    if(!ready||!authUid||!correctlyScoped(authUid))return;
    start.disabled=true;fromCloud.disabled=true;merge.disabled=true;
    try{
      if(expectedEpoch!==epoch||!correctlyScoped(authUid))return;
      const docs=[...remote.values()].filter(r=>!r.deleted);
      if(automatic){
        // Nunca substituir dados de um aparelho usado, mesmo que o login seja válido.
        // Revalidar imediatamente antes da recuperação, pois os dados locais
        // podem ter mudado enquanto o Firestore conectava.
        if(candidateAutoMode()!==mode){
          throw new Error('Dados locais ou remotos mudaram durante a conexão. Confira a primeira sincronização para protegê-los.');
        }
      }else if(!confirm(mode==='replace'
        ?'Carregar os dados da nuvem neste aparelho? Antes da substituição será criada uma cópia de segurança local. Recomenda-se baixar também um backup JSON.'
        :'Ativar sincronização automática para esta conta? O aplicativo guardará suas alterações na nuvem para os demais aparelhos. Faça antes um backup JSON independente.'))return;
      if(remoteMeta?.phase==='initializing')throw new Error('Ainda existe uma primeira sincronização em andamento. Aguarde.');
      safety(`Antes da primeira sincronização (${mode})`);
      if(mode==='replace'){
        if(!initialDocCount && remoteMeta?.phase!=='ready')throw new Error('Não há dados na nuvem para recuperar.');
        const next=E.emptySynced(state);
        for(const r of docs)E.applyRecord(next,r);
        state=migrateState(next);writeLocalWithoutSync();
      }else if(mode==='merge'){
        if(!initialDocCount)throw new Error('Nuvem ainda sem dados; use Ativar e enviar.');
        const localMap=E.flatten(state),overlaps=docs.filter(r=>localMap.has(r.key)&&localMap.get(r.key).payload!==r.payload);
        if(overlaps.length){throw new Error(`Mesclagem pausada: ${overlaps.length} registros diferentes entre nuvem e aparelho. Para não perder dados, escolha Carregar da nuvem (com backup JSON local) ou reconcilie os arquivos manualmente.`);}
        let changed=false;
        // Aplicar somente registros exclusivos da nuvem; nenhuma sobrescrita implícita.
        for(const r of docs){if(!localMap.has(r.key))changed=E.applyRecord(state,r)||changed;}
        if(changed)writeLocalWithoutSync();
      }else if(mode==='upload'&&initialDocCount){
        throw new Error('A nuvem já tem informações. Escolha Carregar da nuvem ou Mesclar sem sobrescrever.');
      }
      if(mode==='upload'){
        const marker=sdk.doc(scopeRef,E.idFor('__meta','init'));
        await sdk.runTransaction(db,async tx=>{
          const snap=await tx.get(marker);
          if(snap.exists())throw new Error('Outra sincronização inicial já foi criada. Reconecte e confira os dados.');
          tx.set(marker,{section:'__meta',itemId:'init',payload:JSON.stringify({phase:'initializing',actor:deviceId}),
            deleted:false,revision:1,actor:deviceId,updatedAt:sdk.serverTimestamp()});
        });
        localStorage.setItem(key('bootstrap'),'true');
      }
      // Alinhamento inicial: não sobrescrever documentos existentes.
      const localRecords=E.flatten(state);
      const initialQueue={};
      if(mode!=='replace'){
        for(const [k,r] of localRecords){
          const present=remote.get(k);
          if(!present||present.deleted)initialQueue[k]={...r,baseRevision:present?.revision||0};
        }
      }
      if(expectedEpoch!==epoch||!correctlyScoped(authUid))throw new Error('Conta alterada durante a sincronização inicial.');
      pending=initialQueue;conflicts={};
      for(const [k,r] of remote)rememberRev(k,r);
      persist();
      linked=true;localStorage.setItem(key('linked'),authUid);updateUi();scheduleFlush(50);
      statusText('Pronto! Seus aparelhos ficarão atualizados automaticamente.','success');
    }catch(e){showError(e);}
    finally{start.disabled=false;fromCloud.disabled=false;merge.disabled=false;}
  }
  function renderConflicts(){
    const active=Object.keys(conflicts);
    conflictList.replaceChildren();
    for(const k of active.slice(0,30)){
      const row=document.createElement('div');row.className='sp51-conflict-row';
      const text=document.createElement('span');text.textContent=k.replace('|',' · ');
      const cloud=document.createElement('button');cloud.type='button';cloud.className='btn secondary small';cloud.textContent='Usar dados da conta';
      const mine=document.createElement('button');mine.type='button';mine.className='btn ghost small';mine.textContent='Manter deste aparelho';
      cloud.addEventListener('click',()=>resolveConflict(k,'cloud'));
      mine.addEventListener('click',()=>resolveConflict(k,'local'));
      row.append(text,cloud,mine);conflictList.append(row);
    }
  }
  function resolveConflict(k,choice){
    const current=remote.get(k);
    if(!current){statusText('Aguarde a conexão voltar para escolher qual informação manter.','warning');return;}
    const message=choice==='cloud'?'Usar a versão da nuvem neste registro? A versão local anterior terá cópia de segurança.':'Manter a sua alteração local para este registro e enviá-la à nuvem? O outro valor será substituído. Faça backup antes.';
    if(!confirm(message))return;
    safety(`Antes de resolver conflito ${k}`);
    if(choice==='cloud'){
      delete pending[k];
      E.applyRecord(state,current);writeLocalWithoutSync();
    }else if(pending[k])pending[k].baseRevision=current.revision;
    delete conflicts[k];rememberRev(k,current);persist();updateUi();scheduleFlush(100);
    statusText('Escolha salva. Atualizando os aparelhos.','success');
  }
  async function authChanged(uid){
    epoch++;const mark=epoch;autoActivating=false;
    clearTimeout(saveTimer);if(unsub){unsub();unsub=null;}
    authUid=null;scopeRef=null;ready=false;firstSnapshot=false;remote=new Map();remoteMeta=null;pending={};conflicts={};baseRevisions={};linked=false;
    if(!uid){statusText('Entre com Google para acessar seus dados nos outros aparelhos.');updateUi();return;}
    if(!correctlyScoped(uid)){statusText('Conferindo a conta selecionada…','warning');return;}
    authUid=uid;linked=linkedFor(uid);
    pending=parse(localStorage.getItem(key('queue')),{})||{};
    baseRevisions=parse(localStorage.getItem(key('knownRevs')),{})||{};
    statusText('Procurando seus dados salvos…');updateUi();
    try{
      await openFirebase();if(mark!==epoch)return;
      scopeRef=sdk.collection(db,'saldoplanLive',uid,'records');
      unsub=sdk.onSnapshot(scopeRef,{includeMetadataChanges:true},snap=>receive(snap,mark),e=>{if(mark===epoch)showError(e)});
    }catch(e){if(mark===epoch)showError(e);}
  }
  window.saldoPlanLiveAuthChanged=uid=>{void authChanged(uid);};
  start.addEventListener('click',()=>{void activate('upload');});
  fromCloud.addEventListener('click',()=>{void activate('replace');});
  merge.addEventListener('click',()=>{void activate('merge');});
  reconnect.addEventListener('click',()=>{if(authUid)void authChanged(authUid);});
  window.addEventListener('online',()=>{if(authUid){statusText('Conexão restaurada. Conferindo alterações…');scheduleFlush(250);}});
  window.addEventListener('offline',()=>{statusText('Sem internet. Seus lançamentos continuam salvos neste aparelho.','warning');updateUi();});
  window.addEventListener('storage',e=>{
    if(e.key===PROFILE_ACTIVE_KEY&&authUid&&!correctlyScoped(authUid)){
      void authChanged(null);statusText('Perfil alterado em outra guia. Recarregue antes de editar.','warning');
    }
  });
  // O estado do login é entregue por auth.js após autenticação e troca de perfil.
  if(window.saldoPlanAuthUser?.uid)void authChanged(window.saldoPlanAuthUser.uid);
})();
