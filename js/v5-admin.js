/* Painel administrativo: acesso e conteúdo verificados pela API; interface não concede permissões. */
(function(){
  'use strict';
  const panel=document.getElementById('sp5AdminPanel');
  const status=document.getElementById('sp5AdminStatus');
  const list=document.getElementById('sp5AdminTickets');
  const form=document.getElementById('sp5AdminForm');
  if(!panel)return;
  const el=id=>document.getElementById(id);
  let tickets=[],selected='',busy=false;
  const say=s=>{status.textContent=s};
  const token=async()=>{
    const [{getApps,getApp},{getAuth}]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')]);
    if(!getApps().length)throw new Error('Faça login com Google');
    const user=getAuth(getApp()).currentUser;
    if(!user)throw new Error('Faça login com Google');
    return user.getIdToken();
  };
  async function request(method,body){
    const bearer=await token();
    const response=await fetch('/api/support-admin',{method,
      headers:{Authorization:`Bearer ${bearer}`,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Object.assign(new Error(data.message||'Não foi possível acessar a central'),{status:response.status});
    return data;
  }
  function render(){
    list.replaceChildren();
    for(const ticket of tickets){
      const item=document.createElement('div');item.className='sp5-admin-item';
      const desc=document.createElement('div');
      const title=document.createElement('strong');title.textContent=`${ticket.protocol} · ${ticket.subject}`;
      const label=document.createElement('p');label.textContent=`${ticket.senderName||'Usuário'} · ${ticket.senderEmail||''} · ${ticket.status||'recebido'}`;
      desc.append(title,label);
      const btn=document.createElement('button');btn.type='button';btn.className='btn ghost small';btn.textContent='Abrir';
      btn.addEventListener('click',()=>{
        selected=ticket.protocol;form.hidden=false;
        el('sp5AdminProtocol').value=selected;el('sp5AdminSelected').textContent=`${ticket.protocol} · ${ticket.subject}\n${ticket.message}`;
        el('sp5AdminTicketStatus').value=ticket.status||'recebido';el('sp5AdminReply').value='';
        form.scrollIntoView({block:'nearest',behavior:'smooth'});
      });
      item.append(desc,btn);list.append(item);
    }
    if(!tickets.length)say('Nenhuma solicitação foi registrada no histórico remoto.');
  }
  async function load(){
    if(!window.saldoPlanAuthUser?.uid){panel.hidden=true;return;}
    try{
      const data=await request('GET');
      panel.hidden=false;tickets=data.tickets||[];
      say(`${tickets.length} solicitação(ões) carregada(s) — somente sua conta administrativa.`);render();
    }catch(error){
      panel.hidden=true;
      if(error.status!==403&&error.status!==503)console.warn('Central administrativa indisponível');
    }
  }
  el('sp5AdminReload')?.addEventListener('click',()=>{void load()});
  document.addEventListener('click',event=>{if(event.target.closest('[data-nav="support"]'))void load()});
  async function action(method,body){
    if(busy||!selected)return;
    busy=true;
    try{await request(method,{protocol:selected,...body});say(method==='POST'?'Resposta enviada ao e-mail do usuário.':'Status atualizado.');await load();}
    catch(error){say(error.message)}finally{busy=false;}
  }
  el('sp5AdminSave')?.addEventListener('click',()=>void action('PATCH',{status:el('sp5AdminTicketStatus').value}));
  el('sp5AdminSend')?.addEventListener('click',()=>{
    const msg=el('sp5AdminReply').value.trim();
    if(msg.length<10){say('Escreva uma resposta com pelo menos 10 caracteres.');return;}
    if(confirm('Enviar esta resposta para o e-mail cadastrado pelo usuário?'))void action('POST',{message:msg});
  });
  const original=window.saldoPlanRefreshSupport;
  window.saldoPlanRefreshSupport=(...args)=>{const result=original?.(...args);setTimeout(load,0);return result;};
  setTimeout(load,1400);
})();
