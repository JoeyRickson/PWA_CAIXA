/* SaldoPlan v3.1 — sincronização com desbloqueio opcional por dispositivo e proteção contra conflito. */
(function(){
  'use strict';
  const input=document.getElementById('sp3SyncPass');
  const upload=document.getElementById('sp3SyncUpload');
  const restore=document.getElementById('sp3SyncDownload');
  const auto=document.getElementById('sp3SyncAuto');
  const remember=document.getElementById('sp31SyncRemember');
  const forget=document.getElementById('sp31SyncForget');
  const lockStatus=document.getElementById('sp31SyncLockStatus');
  const out=document.getElementById('sp3SyncStatus');
  if(!input||!upload||!restore||!auto||!remember||!forget||!out)return;
  const AUTO_PREF='saldoplan.syncAuto.v3';
  const DB_NAME='SaldoPlanSyncDeviceV31';
  const DB_STORE='deviceKeys';
  const decoder=new TextDecoder('utf-8',{fatal:true});
  const encoder=new TextEncoder();
  let busy=false,timer=null,sessionPassword=null,knownUpdatedAt=null,knownUid=null,conflict=false,authEpoch=0;
  let unlockPending=false;
  auto.checked=localStorage.getItem(AUTO_PREF)==='true';
  const info=(s,kind='')=>{out.textContent=s;out.dataset.tone=kind;};
  const lockInfo=s=>{if(lockStatus)lockStatus.textContent=s;};
  const encode=bytes=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
  const decode=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
  const random=n=>crypto.getRandomValues(new Uint8Array(n));
  async function hash(text){return encode(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text))));}
  async function derive(password,salt){
    const base=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:210000},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encrypt(password,plaintext){
    const salt=random(16),iv=random(12),key=await derive(password,salt);
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(plaintext));
    return {data:encode(new Uint8Array(ciphertext)),salt:encode(salt),iv:encode(iv),hash:await hash(plaintext)};
  }
  async function decrypt(password,remote){
    const key=await derive(password,decode(remote.salt));
    let plaintext;
    try{plaintext=decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(remote.iv)},key,decode(remote.data)));}
    catch{throw new Error('Não foi possível abrir a cópia. Confira a senha deste aparelho. Nenhum dado foi alterado.');}
    if(await hash(plaintext)!==remote.hash)throw new Error('A integridade da cópia remota não corresponde ao conteúdo.');
    return plaintext;
  }
  function openDeviceDB(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('Este navegador não oferece armazenamento protegido de chave local.'));return;}
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(DB_STORE))req.result.createObjectStore(DB_STORE,{keyPath:'uid'});};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Não foi possível acessar as chaves locais.'));
      req.onblocked=()=>reject(new Error('Feche outras abas do SaldoPlan e tente novamente.'));
    });
  }
  async function deviceTransaction(uid,writeValue,remove=false){
    const db=await openDeviceDB();
    try{
      return await new Promise((resolve,reject)=>{
        const tx=db.transaction(DB_STORE,writeValue||remove?'readwrite':'readonly');
        const store=tx.objectStore(DB_STORE);
        const req=remove?store.delete(uid):writeValue?store.put(writeValue):store.get(uid);
        let result;
        req.onsuccess=()=>{result=req.result;if(!writeValue&&!remove)resolve(result);};
        req.onerror=()=>reject(req.error||new Error('Erro ao acessar a chave local.'));
        tx.oncomplete=()=>{if(writeValue||remove)resolve(result);};
        tx.onabort=()=>reject(tx.error||new Error('Não foi possível armazenar a chave local.'));
      });
    } finally{db.close();}
  }
  const aad=uid=>encoder.encode('SaldoPlan/v3.1/saldoplan/'+uid);
  async function rememberPassword(uid,pass){
    if(!remember.checked)return;
    let prior=await deviceTransaction(uid);
    const key=prior?.key||await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    const iv=random(12);
    const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(uid)},key,encoder.encode(pass));
    await deviceTransaction(uid,{uid,key,iv:encode(iv),wrapped:encode(new Uint8Array(ciphertext)),version:1,updatedAt:new Date().toISOString()});
    lockInfo('Desbloqueio lembrado neste aparelho para esta conta Google.');
  }
  async function localPassword(uid){
    const record=await deviceTransaction(uid);
    if(!record)return null;
    if(!record.key||!record.iv||!record.wrapped)throw new Error('O desbloqueio salvo está incompleto. Remova e configure novamente.');
    const result=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(record.iv),additionalData:aad(uid)},record.key,decode(record.wrapped));
    const pass=decoder.decode(result);
    if(pass.length<8)throw new Error('A senha de proteção salva é inválida.');
    return pass;
  }
  function clearSession(){
    sessionPassword=null; input.value=''; knownUid=null;knownUpdatedAt=null;conflict=false;
    clearTimeout(timer);timer=null;unlockPending=false;
  }
  function loggedUid(){
    const uid=window.saldoPlanAuthUser?.uid;
    return typeof uid==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(uid)?uid:null;
  }
  async function credentials(){
    const uid=loggedUid();
    if(!uid)throw new Error('Entre com sua conta Google antes de usar o backup entre aparelhos.');
    const [{getApps,getApp},{getAuth}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
    ]);
    const fb=getApps().length?getApp():null;
    const current=fb?getAuth(fb).currentUser:null;
    if(!current||current.uid!==uid)throw new Error('A sessão Google expirou. Entre novamente.');
    return {uid,token:await current.getIdToken()};
  }
  function endpoint(uid){return `https://firestore.googleapis.com/v1/projects/saldoplan/databases/(default)/documents/saldoplanSync/${encodeURIComponent(uid)}`;}
  async function request(url,token,method='GET',body){
    const r=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    if(r.status===404&&method==='GET')return null;
    const response=await r.json().catch(()=>({}));
    if(!r.ok){
      const reason=response.error?.message||`HTTP ${r.status}`;
      if(r.status===401)throw new Error('Sessão expirada. Entre novamente com Google.');
      if(r.status===403||r.status===404)throw new Error('Confira o Firestore e as regras de acesso da coleção saldoplanSync. '+reason);
      if(r.status===409||r.status===412){conflict=true;throw new Error('Conflito: a cópia foi atualizada em outro aparelho. Verifique a cópia remota antes de enviar.');}
      throw new Error(reason);
    }
    return response;
  }
  const field=(doc,key)=>String(doc.fields?.[key]?.stringValue||'');
  const parse=doc=>doc&&({data:field(doc,'data'),salt:field(doc,'salt'),iv:field(doc,'iv'),hash:field(doc,'hash'),updatedAt:doc.updateTime||''});
  function isValidRemote(remote){return !!(remote?.data&&remote.salt&&remote.iv&&remote.hash);}
  function typedOrUnlocked(){
    const pass=input.value||sessionPassword;
    if(!pass||pass.length<8)throw new Error('Crie ou informe a senha de proteção (mínimo 8 caracteres). Neste aparelho pessoal, você pode escolher Lembrar a senha.');
    return pass;
  }
  async function preserveUnlocked(uid,pass){
    sessionPassword=pass;input.value='';
    if(remember.checked){
      try{await rememberPassword(uid,pass);}catch(e){lockInfo('Não foi possível lembrar o desbloqueio neste navegador. A sessão atual continua desbloqueada.');}
    } else lockInfo('Desbloqueado somente até fechar a guia.');
  }
  function adoptRemote(uid,remote){
    knownUid=uid;knownUpdatedAt=remote?.updatedAt||null;conflict=false;
  }
  async function inspectBaseline(uid,token){
    const remote=parse(await request(endpoint(uid),token));
    const localHash=await hash(JSON.stringify(state));
    if(remote&&!isValidRemote(remote))throw new Error('Cópia remota incompleta. Envio automático bloqueado.');
    if(remote&&remote.hash!==localHash){
      conflict=true;
      info('Há alterações diferentes neste aparelho e na nuvem. Backup automático pausado. Use Conferir ou recuperar backup para decidir qual cópia manter.','error');
      return false;
    }
    adoptRemote(uid,remote);
    info(remote?'Cópias conferidas. Backup automático pronto para futuras alterações.':'Não há cópia na nuvem. O primeiro envio automático ocorrerá após uma alteração.','success');
    return true;
  }
  async function uploadCopy({automatic=false}={}){
    const pass=typedOrUnlocked();
    const {uid,token}=await credentials();
    if(knownUid!==uid){knownUid=uid;knownUpdatedAt=null;conflict=false;}
    if(automatic&&conflict)throw new Error('Envio automático pausado por conflito. Verifique a cópia antes de continuar.');
    const remote=parse(await request(endpoint(uid),token));
    if(remote&&!isValidRemote(remote))throw new Error('A cópia remota está incompleta. Envio interrompido.');
    const plaintext=JSON.stringify(state);
    if(new Blob([plaintext]).size>530000)throw new Error('O estado excede o limite de segurança do Firestore. Utilize o backup Google Drive.');
    const localHash=await hash(plaintext);
    if(remote?.hash===localHash){
      adoptRemote(uid,remote);
      await preserveUnlocked(uid,pass);
      info('Seu backup entre aparelhos já está atualizado. Nenhum novo envio foi necessário.','success');
      return;
    }
    if(remote){
      // Nunca muda a senha acidentalmente ao substituir uma cópia que já existia.
      await decrypt(pass,remote);
      if(automatic&&(!knownUpdatedAt||remote.updatedAt!==knownUpdatedAt)){
        conflict=true;
        throw new Error('Outro aparelho pode ter alterado a cópia. Backup automático pausado. Confira a cópia antes de substituir.');
      }
      if(!automatic&&(!knownUpdatedAt||remote.updatedAt!==knownUpdatedAt)){
        if(!confirm('A cópia em nuvem está diferente desta sessão. Enviar os dados deste aparelho substituirá o snapshot remoto, sem mesclar lançamentos. Faça um backup JSON antes. Deseja continuar?')){
          conflict=true;info('Envio cancelado. Dados deste aparelho e da nuvem preservados.','error');return;
        }
      }
    }
    const encrypted=await encrypt(pass,plaintext);
    const fields=Object.fromEntries(Object.entries(encrypted).map(([key,value])=>[key,{stringValue:value}]));
    const suffix=remote?.updatedAt?`?currentDocument.updateTime=${encodeURIComponent(remote.updatedAt)}`:'?currentDocument.exists=false';
    const result=await request(endpoint(uid)+suffix,token,'PATCH',{fields});
    adoptRemote(uid,{updatedAt:result.updateTime||null});
    await preserveUnlocked(uid,pass);
    info(automatic?'Backup entre aparelhos atualizado automaticamente.':'Backup entre aparelhos salvo. Seus dados neste aparelho foram preservados.','success');
  }
  async function downloadCopy(){
    const pass=typedOrUnlocked(),{uid,token}=await credentials();
    const remote=parse(await request(endpoint(uid),token));
    if(!remote){info('Nenhuma cópia foi encontrada nesta conta.','error');return;}
    if(!isValidRemote(remote))throw new Error('O documento remoto está incompleto.');
    const text=await decrypt(pass,remote);
    const parsed=JSON.parse(text);
    if(!Array.isArray(parsed.transactions))throw new Error('Cópia remota inválida: campo transactions ausente.');
    await preserveUnlocked(uid,pass);
    const count=parsed.transactions.length;
    const same=(await hash(JSON.stringify(state)))===remote.hash;
    if(same){adoptRemote(uid,remote);info(`Cópias idênticas · ${count} lançamentos. Sem mudanças.`,'success');return;}
    if(!confirm(`A cópia remota possui ${count} lançamentos. Restaurar substituirá os dados deste aparelho (sem mesclar alterações). Criaremos um snapshot local antes. Deseja continuar?`)){
      conflict=true;
      info('Cópia conferida, mas não restaurada. Envio automático pausado para evitar perdas.','error');return;
    }
    createSafetySnapshot('Antes de restaurar sincronização v3.1');
    localStorage.setItem(PREVIOUS_KEY,JSON.stringify(state));
    state=migrateState(parsed);
    save({backupOld:false,history:false});
    renderAll();window.saldoPlanRenderIntelligence?.();
    adoptRemote(uid,remote);
    info(`Cópia restaurada com ${count} lançamentos. Estado local anterior preservado.`, 'success');
  }
  async function run(fn){
    if(busy)return;
    busy=true;upload.disabled=true;restore.disabled=true;forget.disabled=true;
    try{if(!window.isSecureContext||!crypto.subtle)throw new Error('Use HTTPS ou localhost para criptografia.');await fn();}
    catch(e){info(String(e.message||e),'error');}
    finally{busy=false;upload.disabled=false;restore.disabled=false;forget.disabled=false;}
  }
  async function accountChanged(uid){
    const epoch=++authEpoch;
    clearSession();
    remember.checked=false;
    forget.disabled=true;
    if(!uid){lockInfo('Entre com Google para desbloquear o backup entre aparelhos.');info('Conecte sua conta Google para usar o backup entre aparelhos.');return;}
    lockInfo('Verificando se este aparelho já foi autorizado…');
    try{
      const pass=await localPassword(uid);
      if(epoch!==authEpoch||loggedUid()!==uid)return;
      if(pass){
        sessionPassword=pass;knownUid=uid;remember.checked=true;forget.disabled=false;
        lockInfo('Backup desbloqueado neste aparelho para esta conta Google.');
        info('Conta reconhecida. Não é preciso digitar a senha novamente neste aparelho.','success');
        if(auto.checked)run(async()=>{const {uid:verified,token}=await credentials();if(verified===uid)await inspectBaseline(uid,token);});
      }else{
        lockInfo('Primeiro uso neste aparelho: informe a senha e marque Lembrar a senha se for seu aparelho pessoal.');
        info('Aguardando a senha de proteção para esta conta.');
      }
    }catch(e){
      if(epoch!==authEpoch)return;
      lockInfo('Não foi possível recuperar a chave salva. Digite a senha novamente ou use Esquecer neste aparelho.');
      forget.disabled=false;
      info(String(e.message||e),'error');
    }
  }
  window.saldoPlanSyncAuthChanged=uid=>{void accountChanged(uid);};
  upload.addEventListener('click',()=>run(()=>uploadCopy()));
  restore.addEventListener('click',()=>run(downloadCopy));
  auto.addEventListener('change',()=>{
    localStorage.setItem(AUTO_PREF,String(auto.checked));
    clearTimeout(timer);
    if(!auto.checked){info('Backup automático desativado.');return;}
    if(!sessionPassword){info('Informe a senha de proteção para ativar os backups automáticos.','error');return;}
    run(async()=>{const {uid,token}=await credentials();await inspectBaseline(uid,token);});
  });
  remember.addEventListener('change',()=>{
    const uid=loggedUid();
    if(!uid){remember.checked=false;info('Entre com Google antes de habilitar o desbloqueio salvo.','error');return;}
    if(!remember.checked){
      void deviceTransaction(uid,null,true).then(()=>{forget.disabled=true;lockInfo('Desbloqueio lembrado removido deste aparelho.');}).catch(e=>info(String(e.message||e),'error'));
      return;
    }
    if(sessionPassword){
      void rememberPassword(uid,sessionPassword).then(()=>{forget.disabled=false;}).catch(e=>{remember.checked=false;info(String(e.message||e),'error');});
    }else lockInfo('Após o próximo envio ou verificação com senha, este aparelho será lembrado.');
  });
  forget.addEventListener('click',()=>{
    void run(async()=>{
      const uid=loggedUid();
      if(!uid)throw new Error('Entre com Google antes de remover a chave.');
      if(!confirm('Esquecer a senha de sincronização deste aparelho? Você precisará digitá-la novamente. Seus dados e a cópia na nuvem NÃO serão apagados.'))return;
      await deviceTransaction(uid,null,true);
      clearSession();auto.checked=false;remember.checked=false;forget.disabled=true;
      localStorage.setItem(AUTO_PREF,'false');
      lockInfo('Senha esquecida neste aparelho. Dados locais e nuvem preservados.');
      info('Desbloqueio local removido. Para usar o backup entre aparelhos novamente, informe a senha de proteção.','success');
    });
  });
  window.saldoPlanSyncMarkDirty=()=>{
    if(!auto.checked||!sessionPassword||busy||conflict||!loggedUid())return;
    clearTimeout(timer);
    timer=setTimeout(()=>{run(()=>uploadCopy({automatic:true}));},20000);
  };
  window.addEventListener('pagehide',()=>{clearSession();});
})();
