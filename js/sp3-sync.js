/* SaldoPlan v3 — cópia Firestore AES-GCM opt-in (beta), sem senha persistida. */
(function(){
  'use strict';
  const input=document.getElementById('sp3SyncPass');
  const upload=document.getElementById('sp3SyncUpload');
  const restore=document.getElementById('sp3SyncDownload');
  const auto=document.getElementById('sp3SyncAuto');
  const out=document.getElementById('sp3SyncStatus');
  if(!input||!upload||!restore||!out)return;
  let busy=false,timer=null,sessionPassword=null,knownUpdatedAt=null,knownUid=null,knownFingerprint=null,conflict=false;
  const AUTO_PREF='saldoplan.syncAuto.v3';
  auto.checked=localStorage.getItem(AUTO_PREF)==='true';
  const info=(s,kind='')=>{out.textContent=s;out.dataset.tone=kind;};
  const encode=bytes=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
  const decode=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
  const random=n=>crypto.getRandomValues(new Uint8Array(n));
  async function hash(text){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return encode(new Uint8Array(buf));}
  async function derive(password,salt){
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:210000},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encrypt(password,plaintext){
    const salt=random(16),iv=random(12),key=await derive(password,salt);
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(plaintext));
    return {data:encode(new Uint8Array(encrypted)),salt:encode(salt),iv:encode(iv),hash:await hash(plaintext)};
  }
  async function decrypt(password,remote){
    const key=await derive(password,decode(remote.salt));
    const result=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(remote.iv)},key,decode(remote.data));
    const text=new TextDecoder('utf-8',{fatal:true}).decode(result);
    if(await hash(text)!==remote.hash)throw new Error('Integridade não corresponde ao conteúdo enviado.');
    return text;
  }
  async function credentials(){
    const user=window.saldoPlanAuthUser;
    if(!user?.uid)throw new Error('Entre com Google no SaldoPlan antes de sincronizar.');
    const [{getApps,getApp},{getAuth}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
    ]);
    const fb=getApps().length?getApp():null;
    const current=fb?getAuth(fb).currentUser:null;
    if(!current||current.uid!==user.uid)throw new Error('A sessão Google expirou. Entre novamente.');
    const uid=user.uid;
    if(!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))throw new Error('Identificador da conta inválido.');
    return {uid,token:await current.getIdToken()};
  }
  function endpoint(uid){return `https://firestore.googleapis.com/v1/projects/saldoplan/databases/(default)/documents/saldoplanSync/${encodeURIComponent(uid)}`;}
  async function request(url,token,method='GET',body){
    const r=await fetch(url,{method,headers:{'Authorization':`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    if(r.status===404&&method==='GET')return null;
    const response=await r.json().catch(()=>({}));
    if(!r.ok){
      const description=response.error?.message||`HTTP ${r.status}`;
      if(r.status===403||r.status===404)throw new Error('Ative o Cloud Firestore e publique as regras de segurança indicadas no guia. '+description);
      if(r.status===409||r.status===412)throw new Error('Conflito: outro aparelho atualizou a cópia. Faça uma verificação antes de enviar.');
      throw new Error(description);
    }
    return response;
  }
  const field=(obj,key)=>String(obj.fields?.[key]?.stringValue||'');
  const parse=doc=>doc&&({data:field(doc,'data'),salt:field(doc,'salt'),iv:field(doc,'iv'),hash:field(doc,'hash'),updatedAt:doc.updateTime||''});
  function password(){
    const value=input.value||sessionPassword;
    if(!value||value.length<12)throw new Error('Informe uma senha de criptografia com pelo menos 12 caracteres.');
    sessionPassword=value;input.value='';return value;
  }
  async function run(fn){
    if(busy)return;
    busy=true;upload.disabled=true;restore.disabled=true;
    try{if(!window.isSecureContext||!crypto.subtle)throw new Error('Use HTTPS ou localhost para criptografia.');await fn();}
    catch(e){info(String(e.message||e),'error');}
    finally{busy=false;upload.disabled=false;restore.disabled=false;}
  }
  async function uploadCopy({automatic=false}={}){
    const pass=password(),{uid,token}=await credentials();
    if(knownUid!==uid){knownUpdatedAt=null;knownFingerprint=null;knownUid=uid;}
    const remoteDoc=await request(endpoint(uid),token);
    const remote=parse(remoteDoc);
    if(conflict&&automatic)throw new Error('Envio automático pausado por conflito. Verifique a cópia remota.');
    if(remote?.updatedAt&&(remote.updatedAt!==knownUpdatedAt)){
      if(automatic){conflict=true;throw new Error('Outro aparelho alterou a cópia. Envio automático pausado.');}
      const ok=confirm('Existe uma cópia em nuvem diferente da última reconhecida nesta sessão. Sobrescrever o conteúdo remoto com os dados deste aparelho? Faça uma cópia JSON local primeiro.');
      if(!ok){conflict=true;info('Envio cancelado. Dados locais intactos.','error');return;}
    }
    const text=JSON.stringify(state);
    if(new Blob([text]).size>530000)throw new Error('O estado excede o limite seguro de um documento Firestore. Use backup Google Drive para arquivos grandes.');
    const encrypted=await encrypt(pass,text);
    const fields=Object.fromEntries(Object.entries(encrypted).map(([key,value])=>[key,{stringValue:value}]));
    const base=endpoint(uid);
    let url=base;
    if(remote?.updatedAt)url+=`?currentDocument.updateTime=${encodeURIComponent(remote.updatedAt)}`;
    else url+='?currentDocument.exists=false';
    const result=await request(url,token,'PATCH',{fields});
    knownUpdatedAt=result.updateTime||null;knownFingerprint=encrypted.hash;conflict=false;
    info('Cópia criptografada enviada. Nenhuma senha foi transmitida. Dados locais preservados.','success');
  }
  async function downloadCopy(){
    const pass=password(),{uid,token}=await credentials();
    if(knownUid!==uid){knownUpdatedAt=null;knownFingerprint=null;knownUid=uid;}
    const doc=await request(endpoint(uid),token);
    if(!doc){info('Nenhuma cópia foi encontrada nesta conta.','error');return;}
    const remote=parse(doc);
    if(!remote.data||!remote.salt||!remote.iv||!remote.hash)throw new Error('O documento remoto está incompleto.');
    const text=await decrypt(pass,remote);
    const parsed=JSON.parse(text);
    if(!Array.isArray(parsed.transactions))throw new Error('Cópia remota inválida: campo transactions ausente.');
    const count=parsed.transactions.length;
    knownUpdatedAt=remote.updatedAt;knownFingerprint=remote.hash;conflict=false;
    const currentHash=await hash(JSON.stringify(state));
    if(currentHash===remote.hash){info(`Cópias idênticas · ${count} lançamentos. Sem mudanças.`, 'success');return;}
    if(!confirm(`Cópia remota com ${count} lançamentos encontrada. RESTAURAR substituirá o estado atual deste aparelho. Um snapshot e uma cópia local anterior serão preservados. Deseja continuar?`)){
      info('Cópia verificada; restauração cancelada. Seus dados não mudaram.','success');return;
    }
    createSafetySnapshot('Antes de restaurar sincronização v3');
    localStorage.setItem(PREVIOUS_KEY,JSON.stringify(state));
    state=migrateState(parsed);
    save({backupOld:false,history:false});
    renderAll();window.saldoPlanRenderIntelligence?.();
    info(`Cópia restaurada com ${count} lançamentos. Seu estado anterior foi preservado para restauração local.`, 'success');
  }
  upload.addEventListener('click',()=>run(()=>uploadCopy()));
  restore.addEventListener('click',()=>run(downloadCopy));
  auto.addEventListener('change',()=>{
    localStorage.setItem(AUTO_PREF,String(auto.checked));
    info(auto.checked?'Envio automático será realizado após alterações, somente enquanto esta guia permanecer desbloqueada.':'Envio automático desativado.');
  });
  window.saldoPlanSyncMarkDirty=()=>{
    if(!auto.checked||!sessionPassword||busy||conflict)return;
    clearTimeout(timer);
    timer=setTimeout(()=>{run(()=>uploadCopy({automatic:true}));},20000);
  };
  window.addEventListener('pagehide',()=>{sessionPassword=null;clearTimeout(timer);});
})();
