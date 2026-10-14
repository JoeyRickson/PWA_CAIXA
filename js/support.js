/* SaldoPlan v2.21.0 — interface pública sem segredos */
(function(){
  'use strict';
  const view=document.getElementById('view-support');
  const form=document.getElementById('supportForm');
  if(!view||!form)return;
  const loginNotice=document.getElementById('supportLoginNotice');
  const identity=document.getElementById('supportIdentity');
  const status=document.getElementById('supportStatus');
  const button=document.getElementById('supportSubmit');
  const message=document.getElementById('supportMessage');
  const count=document.getElementById('supportCharacterCount');
  let busy=false;

  function setStatus(text,tone=''){
    status.textContent=text;
    status.dataset.tone=tone;
  }
  function refresh(){
    const user=window.saldoPlanAuthUser;
    const signedIn=Boolean(user&&user.uid&&user.email);
    loginNotice.hidden=signedIn;
    form.hidden=!signedIn;
    if(signedIn){identity.textContent=user.displayName?`${user.displayName} (${user.email})`:user.email;}
    return signedIn;
  }
  window.saldoPlanRefreshSupport=refresh;
  message.addEventListener('input',()=>{count.textContent=`${message.value.length.toLocaleString('pt-BR')} / 4.000 caracteres`;});
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-nav="support"]'))queueMicrotask(refresh);
  });

  async function idToken(){
    const [{getApp,getApps},{getAuth}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
    ]);
    if(!getApps().length)throw new Error('Faça login com Google antes de enviar.');
    const user=getAuth(getApp()).currentUser;
    if(!user)throw new Error('Sua sessão não está autenticada. Entre com Google novamente.');
    return user.getIdToken();
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy||!refresh())return;
    const category=document.getElementById('supportCategory').value;
    const subject=document.getElementById('supportSubject').value.trim();
    const content=message.value.trim();
    if(subject.length<6||subject.length>110||content.length<15||content.length>4000){
      setStatus('Confira o assunto (6 a 110 caracteres) e a mensagem (15 a 4.000 caracteres).','error');return;
    }
    busy=true;
    button.disabled=true;
    button.textContent='Enviando...';
    setStatus('Autenticando e enviando sua solicitação...');
    try{
      const token=await idToken();
      const response=await fetch('/api/support',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
        body:JSON.stringify({category,subject,message:content,website:document.getElementById('supportWebsite').value})
      });
      let json={};
      try{json=await response.json();}catch{}
      if(!response.ok)throw new Error(json.message||`Não foi possível enviar (${response.status}).`);
      setStatus('Solicitação enviada! Ela foi encaminhada ao e-mail do desenvolvedor.','success');
      form.reset();
      count.textContent='0 / 4.000 caracteres';
    }catch(error){
      setStatus(error?.message||'Não foi possível enviar. Tente novamente.','error');
    }finally{
      busy=false;
      button.disabled=false;
      button.textContent='Enviar solicitação ↗';
    }
  });
  refresh();
})();
