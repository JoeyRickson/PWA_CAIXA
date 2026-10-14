// Google Drive
const DRIVE_CONFIG=window.SALDOPLAN_DRIVE_CONFIG||{};
let pickerLoadPromise=null;

function renderDriveFolderSelection(){
  const label=document.querySelector('#driveFolderLabel'),sub=document.querySelector('#driveFolderSubtext'),account=document.querySelector('#driveAccountLabel');
  if(account)account.textContent=window.saldoPlanAuthUser?.email||state.cloud.emailHint||'Use a conta conectada ao SaldoPlan';
  if(!label||!sub)return;
  if(state.cloud.folderId){
    label.textContent=`📁 ${state.cloud.folderName||'Pasta selecionada'}`;
    sub.textContent='Os backups do SaldoPlan serão gravados nesta pasta.';
  }else{
    label.textContent='Nenhuma pasta selecionada';
    sub.textContent='Conecte o Google Drive e escolha uma pasta.';
  }
}

function updateDriveStatus(message){
  const el=document.querySelector('#driveStatus'),detail=document.querySelector('#driveDetail');
  if(!el)return;
  const connected=!!(driveToken||cloudToken);
  el.textContent=connected?'Conectado':'Desconectado';
  el.classList.toggle('ok',connected);
  if(message)detail.textContent=message;
  else if(state.cloud.lastBackupAt)detail.textContent=`Último backup conhecido: ${new Date(state.cloud.lastBackupAt).toLocaleString('pt-BR')}. Retenção: ${state.cloud.retentionDays||30} dias.`;
  else if(state.cloud.folderId)detail.textContent=`Pasta selecionada: ${state.cloud.folderName||'Google Drive'}.`;
  else detail.textContent='Conecte o Google Drive e escolha uma pasta para começar.';
}

function setBackupProgress(step,title,detail){const root=document.querySelector('#backupProgress');if(!root)return;const stages={preparing:12,folder:32,uploading:72,cleaning:88,done:100,error:100};const percent=stages[step]||0;root.classList.remove('hidden','done');if(step==='done')root.classList.add('done');if(step==='error')root.classList.add('done');document.querySelector('#backupProgressTitle').textContent=title;document.querySelector('#backupProgressDetail').textContent=detail;document.querySelector('#backupProgressPercent').textContent=`${percent}%`;document.querySelector('#backupProgressBar').style.width=`${percent}%`;document.querySelector('#backupProgressIcon').textContent=step==='done'?'✓':step==='error'?'!':'↗'}
function setDriveBusy(busy,label='Enviando backup…'){const button=document.querySelector('#backupDrive');if(!button)return;button.disabled=busy;button.classList.toggle('busy',busy);button.textContent=busy?label:'Enviar backup agora';if(!busy&&label==='Enviando backup…')button.textContent='Enviar backup agora'}

document.querySelector('#cloudProvider').addEventListener('change',e=>{state.cloud.provider=e.target.value;updateCloudProviderFields();renderDriveFolderSelection()});

document.querySelector('#saveCloudConfig').onclick=()=>{
  state.cloud.provider=document.querySelector('#cloudProvider').value;
  state.cloud.emailHint=window.saldoPlanAuthUser?.email||state.cloud.emailHint||'';
  state.cloud.clientId=DRIVE_CONFIG.clientId||state.cloud.clientId||'';
  state.cloud.account=document.querySelector('#cloudAccount').value.trim();
  state.cloud.providerClientId=document.querySelector('#cloudClientId').value.trim();
  if(state.cloud.provider!=='google')state.cloud.folderName=document.querySelector('#driveFolderName').value.trim()||'SaldoPlan - Backups';
  state.cloud.autoBackup=document.querySelector('#driveAutoBackup').checked;
  state.cloud.retentionDays=Math.max(1,Number(document.querySelector('#driveRetentionDays').value||30));
  save();renderData();alert('Preferências de backup salvas.');
};

const oauthConfig={
  onedrive:{authorize:'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',token:'https://login.microsoftonline.com/common/oauth2/v2.0/token',scope:'Files.ReadWrite User.Read offline_access'},
  dropbox:{authorize:'https://www.dropbox.com/oauth2/authorize',token:'https://api.dropboxapi.com/oauth2/token',scope:''}
};

function base64Url(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}

async function connectCloudProvider(){
  const provider=state.cloud.provider;
  if(provider==='google'){
    await requestDriveToken(true);
    updateDriveStatus('Google Drive conectado. Escolha a pasta de backup.');
    if(!state.cloud.folderId)await chooseDriveFolder();
    else await getSelectedDriveFolder();
    renderData();
    schedulePendingCloudBackup(5000);
    return;
  }
  const config=oauthConfig[provider],clientId=state.cloud.providerClientId;if(!clientId)throw new Error(`Informe o Client ID do ${cloudProviderNames[provider]} antes de conectar.`);
  const verifier=base64Url(crypto.getRandomValues(new Uint8Array(32))),challenge=base64Url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),oauthState=uid(),redirectUri=`${location.origin}${location.pathname}`;
  sessionStorage.setItem('saldoPlan.oauth',JSON.stringify({provider,verifier,state:oauthState,redirectUri}));
  const params=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:redirectUri,state:oauthState,code_challenge:challenge,code_challenge_method:'S256'});if(config.scope)params.set('scope',config.scope);if(provider==='dropbox')params.set('token_access_type','offline');
  const popup=window.open(`${config.authorize}?${params}`,'saldoPlanOAuth','width=520,height=700');if(!popup)throw new Error('Permita pop-ups para concluir a conexão.');
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{window.removeEventListener('message',receive);reject(new Error('A autorização expirou ou foi cancelada.'))},180000);function receive(event){if(event.origin!==location.origin||event.data?.type!=='saldoPlanOAuth')return;clearTimeout(timer);window.removeEventListener('message',receive);if(event.data.error){reject(new Error(event.data.error));return}fetch(config.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code:event.data.code,redirect_uri:redirectUri,code_verifier:verifier}).toString()}).then(r=>r.json()).then(data=>{if(!data.access_token)throw new Error(data.error_description||'Não foi possível obter o token.');cloudToken=data.access_token;resolve()}).catch(reject)}window.addEventListener('message',receive)});
  updateDriveStatus(`${cloudProviderNames[provider]} conectado. Backup pronto para uso.`);
  schedulePendingCloudBackup(5000);
}

function handleCloudOAuthCallback(){const params=new URLSearchParams(location.search),oauth=sessionStorage.getItem('saldoPlan.oauth');if(!oauth||(!params.get('code')&&!params.get('error'))||!window.opener)return false;window.opener.postMessage({type:'saldoPlanOAuth',code:params.get('code'),error:params.get('error_description')||params.get('error')},location.origin);window.close();return true}

function requestDriveToken(forceConsent=false){
  return new Promise((resolve,reject)=>{
    const clientId=DRIVE_CONFIG.clientId||'';
    if(!clientId){reject(new Error('Configuração do Google Drive indisponível.'));return}
    if(!window.google?.accounts?.oauth2){reject(new Error('O serviço do Google ainda não carregou. Tente novamente em alguns segundos.'));return}
    state.cloud.clientId=clientId;
    state.cloud.emailHint=window.saldoPlanAuthUser?.email||state.cloud.emailHint||'';
    state.cloud.autoBackup=document.querySelector('#driveAutoBackup').checked;
    save({backupOld:false,cloud:false,history:false});
    const tokenClient=google.accounts.oauth2.initTokenClient({
      client_id:clientId,
      scope:'https://www.googleapis.com/auth/drive.file',
      login_hint:state.cloud.emailHint||undefined,
      callback:resp=>{
        if(resp.error){reject(new Error(resp.error));return}
        driveToken=resp.access_token;
        updateDriveStatus('Google Drive conectado nesta sessão.');
        resolve(driveToken);
      },
      error_callback:err=>{
        if(err?.type==='popup_failed_to_open'){
          reject(new Error('O navegador bloqueou a autorização do Google Drive. Permita pop-ups para saldoplan.vercel.app e tente novamente.'));
          return;
        }

        if(err?.type==='popup_closed'){
          reject(new Error('A janela de autorização do Google Drive foi fechada antes de concluir.'));
          return;
        }

        reject(new Error('Não foi possível abrir a autorização do Google Drive.'));
      }
    });
    tokenClient.requestAccessToken({prompt:forceConsent?'consent':''});
  });
}

document.querySelector('#connectDrive').onclick=async()=>{try{await connectCloudProvider();renderData()}catch(e){alert(e.message)}};

async function driveFetch(url,options={}){
  if(!driveToken)throw new Error('Conecte o Google Drive primeiro.');
  const headers=new Headers(options.headers||{});
  headers.set('Authorization',`Bearer ${driveToken}`);
  const r=await fetch(url,{...options,headers});
  if(r.status===401){driveToken=null;updateDriveStatus('A autorização expirou. Conecte novamente.');throw new Error('Autorização do Google expirada.')}
  if(!r.ok){let msg='Erro no Google Drive.';try{const j=await r.json();msg=j.error?.message||msg}catch{}throw new Error(msg)}
  return r;
}

function loadPickerApi(){
  if(window.google?.picker)return Promise.resolve();
  if(pickerLoadPromise)return pickerLoadPromise;
  pickerLoadPromise=new Promise((resolve,reject)=>{
    const load=()=>{
      if(!window.gapi){reject(new Error('Não foi possível carregar o seletor do Google Drive.'));return}
      gapi.load('picker',{callback:resolve,onerror:()=>reject(new Error('Não foi possível carregar o seletor do Google Drive.'))});
    };
    if(window.gapi){load();return}
    const existing=document.querySelector('script[data-saldoplan-picker]');
    if(existing){existing.addEventListener('load',load,{once:true});existing.addEventListener('error',()=>reject(new Error('Não foi possível carregar o Google Picker.')),{once:true});return}
    const script=document.createElement('script');
    script.src='https://apis.google.com/js/api.js';
    script.async=true;
    script.defer=true;
    script.dataset.saldoplanPicker='1';
    script.onload=load;
    script.onerror=()=>reject(new Error('Não foi possível carregar o Google Picker.'));
    document.head.appendChild(script);
  });
  return pickerLoadPromise;
}

async function chooseDriveFolder(){
  if(!driveToken)await requestDriveToken(false);
  if(!DRIVE_CONFIG.apiKey||!DRIVE_CONFIG.appId)throw new Error('O seletor do Google Drive ainda não foi configurado.');
  await loadPickerApi();
  return new Promise((resolve,reject)=>{
    try{
      const view=new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMimeTypes('application/vnd.google-apps.folder');
      const picker=new google.picker.PickerBuilder()
        .setDeveloperKey(DRIVE_CONFIG.apiKey)
        .setAppId(String(DRIVE_CONFIG.appId))
        .setOAuthToken(driveToken)
        .setOrigin(location.origin)
        .addView(view)
        .setCallback(data=>{
          if(data.action===google.picker.Action.PICKED){
            const doc=data[google.picker.Response.DOCUMENTS]?.[0];
            const folderId=doc?.[google.picker.Document.ID]||doc?.id;
            const folderName=doc?.[google.picker.Document.NAME]||doc?.name||'Pasta selecionada';
            if(!folderId){reject(new Error('Não foi possível identificar a pasta escolhida.'));return}
            state.cloud.folderId=folderId;
            state.cloud.folderName=folderName;
            save({backupOld:false,cloud:false});
            renderDriveFolderSelection();
            updateDriveStatus(`Pasta selecionada: ${folderName}.`);
            resolve({id:folderId,name:folderName});
          }else if(data.action===google.picker.Action.CANCEL){
            resolve(null);
          }
        })
        .build();
      picker.setVisible(true);
    }catch(e){reject(e)}
  });
}

async function createDriveFolder(){
  try{
    if(!driveToken)await requestDriveToken(false);
    const name=(prompt('Nome da nova pasta de backup:','SaldoPlan - Backups')||'').trim();
    if(!name)return;
    const r=await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder'})
    });
    const folder=await r.json();
    state.cloud.folderId=folder.id;
    state.cloud.folderName=folder.name||name;
    save({backupOld:false,cloud:false});
    renderData();
    updateDriveStatus(`Pasta criada e selecionada: ${state.cloud.folderName}.`);
  }catch(e){alert(e.message)}
}

document.querySelector('#chooseDriveFolder').onclick=()=>chooseDriveFolder().catch(e=>alert(e.message));
document.querySelector('#createDriveFolder').onclick=createDriveFolder;

async function getSelectedDriveFolder(){
  if(!state.cloud.folderId)throw new Error('Escolha uma pasta do Google Drive para o backup.');
  try{
    const r=await driveFetch(`https://www.googleapis.com/drive/v3/files/${state.cloud.folderId}?fields=id,name,mimeType,trashed`);
    const data=await r.json();
    if(data.id&&data.mimeType==='application/vnd.google-apps.folder'&&!data.trashed){
      state.cloud.folderName=data.name||state.cloud.folderName;
      save({backupOld:false,cloud:false});
      renderDriveFolderSelection();
      return data.id;
    }
  }catch(e){
    state.cloud.folderId='';
    save({backupOld:false,cloud:false});
    renderDriveFolderSelection();
    throw new Error('A pasta selecionada não está mais disponível. Escolha outra pasta.');
  }
  state.cloud.folderId='';
  save({backupOld:false,cloud:false});
  renderDriveFolderSelection();
  throw new Error('Escolha novamente a pasta de backup.');
}

async function findBackupFile(folderId){
  const names=['saldoplan-backup.json','meu-caixa-backup.json'];
  for(const backupName of names){
    const q=`'${folderId}' in parents and name='${backupName}' and trashed=false`;
    const r=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&spaces=drive`);
    const j=await r.json();
    if(j.files?.[0])return j.files[0];
  }
  return null;
}

async function listBackupFiles(folderId){
  const q=`'${folderId}' in parents and (name contains 'saldoplan-backup' or name contains 'meu-caixa-backup') and trashed=false`;
  const r=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&spaces=drive`);
  const j=await r.json();
  return j.files||[];
}

async function cleanOldBackups(folderId){const retention=Math.max(1,Number(state.cloud.retentionDays||30)),cutoff=Date.now()-retention*86400000,files=await listBackupFiles(folderId);await Promise.all(files.filter(file=>file.name!=='saldoplan-backup.json'&&file.name!=='meu-caixa-backup.json'&&file.modifiedTime&&new Date(file.modifiedTime).getTime()<cutoff).map(file=>driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}`,{method:'DELETE'})))}

async function backupToOtherCloud(){
  if(!cloudToken)throw new Error(`Conecte ao ${cloudProviderNames[state.cloud.provider]} primeiro.`);
  const body=JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),folder=state.cloud.folderName||'SaldoPlan - Backups',name=`saldoplan-backup-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  if(state.cloud.provider==='onedrive'){
    const root=`https://graph.microsoft.com/v1.0/me/drive/root:/`;
    await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children',{method:'POST',headers:{Authorization:`Bearer ${cloudToken}`,'Content-Type':'application/json'},body:JSON.stringify({name:folder,folder:{},'@microsoft.graph.conflictBehavior':'fail'})}).catch(()=>{});
    const r=await fetch(`${root}${encodeURIComponent(folder)}/${encodeURIComponent(name)}:/content`,{method:'PUT',headers:{Authorization:`Bearer ${cloudToken}`,'Content-Type':'application/json'},body});if(!r.ok)throw new Error('Não foi possível enviar o backup ao OneDrive.');
  }else if(state.cloud.provider==='dropbox'){
    const headers={Authorization:`Bearer ${cloudToken}`,'Content-Type':'application/json'};
    await fetch('https://api.dropboxapi.com/2/files/create_folder_v2',{method:'POST',headers,body:JSON.stringify({path:`/${folder}`,autorename:false})}).catch(()=>{});
    const r=await fetch('https://content.dropboxapi.com/2/files/upload',{method:'POST',headers:{Authorization:`Bearer ${cloudToken}`,'Content-Type':'application/octet-stream','Dropbox-API-Arg':JSON.stringify({path:`/${folder}/${name}`,mode:'add',autorename:true,mute:false})},body});if(!r.ok)throw new Error('Não foi possível enviar o backup ao Dropbox.');
  }
  state.cloud.lastBackupAt=new Date().toISOString();clearCloudBackupDirty();save({backupOld:false,cloud:false,history:false});updateDriveStatus(`Backup enviado ao ${cloudProviderNames[state.cloud.provider]}.`);alert('Backup enviado com sucesso.');
}

async function backupToDrive(silent=false){
  if(state.cloud.provider!=='google'){if(silent)return;if(!silent)operationStart('Enviando backup','Conectando ao armazenamento escolhido…');setDriveBusy(true,'Enviando backup…');try{await backupToOtherCloud();if(!silent)operationFinish('Backup concluído','Suas informações foram salvas com sucesso.')}catch(e){if(!silent)operationFinish('Backup não concluído',e.message,true);throw e}finally{setDriveBusy(false)}return}
  if(!driveToken){if(silent)return;await requestDriveToken(false)}
  if(!state.cloud.folderId){if(silent)return;const chosen=await chooseDriveFolder();if(!chosen)return}
  if(!silent){operationStart('Backup em andamento','Organizando os dados deste aparelho…');setDriveBusy(true,'Enviando backup…');setBackupProgress('preparing','Preparando backup','Organizando os dados deste aparelho…')}
  try{
    const folderId=await getSelectedDriveFolder();
    if(!silent){setBackupProgress('folder','Pasta validada',`Destino: ${state.cloud.folderName}.`);document.querySelector('#operationDetail').textContent=`Pasta de destino: ${state.cloud.folderName}.`}
    const now=new Date(),stamp=now.toISOString().replace(/[:.]/g,'-'),body=JSON.stringify({...state,exportedAt:now.toISOString()},null,2);
    let file=await findBackupFile(folderId),name='saldoplan-backup.json';
    if(silent){name=`saldoplan-backup-${stamp}.json`;file=null}
    if(!file){
      let r=await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name,modifiedTime',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/json',parents:[folderId]})});
      file=await r.json();
    }
    if(!silent)setBackupProgress('uploading','Enviando backup','Transferindo suas informações para o Google Drive…');
    await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,{method:'PATCH',headers:{'Content-Type':'application/json'},body});
    if(silent)await cleanOldBackups(folderId);else setBackupProgress('cleaning','Finalizando backup','Conferindo a retenção dos backups antigos…');
    state.cloud.lastBackupAt=now.toISOString();state.cloud.lastFileId=file.id;
    clearCloudBackupDirty();
    save({backupOld:false,cloud:false,history:false});
    updateDriveStatus(`Backup enviado ao Drive em ${now.toLocaleString('pt-BR')}.`);
    if(!silent){setBackupProgress('done','Backup concluído','Suas informações foram salvas com sucesso.');operationFinish('Backup concluído','Suas informações foram salvas com sucesso.')}
  }catch(e){
    if(!silent){setBackupProgress('error','Não foi possível concluir','Verifique a conexão e tente novamente.');operationFinish('Backup não concluído',e.message,true)}
    throw e
  }finally{
    if(!silent)setDriveBusy(false)
  }
}

document.querySelector('#backupDrive').onclick=()=>backupToDrive(false).catch(()=>{});

document.querySelector('#restoreDrive').onclick=async()=>{
  if(state.cloud.provider!=='google'){alert(`A restauração automática do ${cloudProviderNames[state.cloud.provider]} ainda será adicionada. Use Importar backup JSON por enquanto.`);return}
  try{
    if(!driveToken)await requestDriveToken(false);
    if(!state.cloud.folderId){const chosen=await chooseDriveFolder();if(!chosen)return}
    const folderId=await getSelectedDriveFolder(),files=await listBackupFiles(folderId),file=files[0]||null;
    if(!file){alert('Nenhum backup do SaldoPlan foi encontrado nessa pasta.');return}
    if(!confirm(`Restaurar o backup do Drive${file.modifiedTime?` de ${new Date(file.modifiedTime).toLocaleString('pt-BR')}`:''}? O estado atual será mantido como cópia local anterior.`))return;
    const r=await driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`),data=migrateState(await r.json());
    createSafetySnapshot('Antes de restaurar backup do Drive');
    localStorage.setItem(PREVIOUS_KEY,JSON.stringify(state));
    state=data;
    state.cloud={...seed.cloud,...state.cloud,clientId:DRIVE_CONFIG.clientId||state.cloud.clientId,emailHint:window.saldoPlanAuthUser?.email||state.cloud.emailHint};
    save({backupOld:false,cloud:false,history:false});
    renderAll();
    alert('Backup do Drive restaurado.');
  }catch(e){alert(e.message)}
};
