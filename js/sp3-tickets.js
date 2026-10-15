/* SaldoPlan v3 — protocolos locais de suporte, por conta autenticada */
(function(){
  'use strict';
  const section=document.getElementById('sp3TicketList');if(!section)return;
  const storageKey=uid=>`saldoplan.supportTickets.v3.${uid}`;
  const read=uid=>{try{const rows=JSON.parse(localStorage.getItem(storageKey(uid))||'[]');return Array.isArray(rows)?rows:[];}catch{return [];}};
  function show(){
    const uid=window.saldoPlanAuthUser?.uid;
    section.innerHTML=!uid?'<p class="helper">Entre com Google para visualizar seus protocolos neste aparelho.</p>':read(uid).length?read(uid).slice(0,30).map(t=>`<article class="sp3-entry"><div class="sp3-line"><strong>${escapeHtml(t.protocol)}</strong><span class="status-pill">Enviado</span></div><small>${escapeHtml(t.subject)} · ${new Date(t.sentAt).toLocaleString('pt-BR')}</small></article>`).join(''):'<p class="helper">Você ainda não enviou solicitações neste aparelho.</p>';
  }
  window.saldoPlanSupportTicketSent=({protocol,subject})=>{
    const uid=window.saldoPlanAuthUser?.uid;
    if(!uid||!/^[A-Z0-9-]{8,40}$/.test(protocol||''))return;
    const items=read(uid);items.unshift({protocol,subject:String(subject).slice(0,110),sentAt:new Date().toISOString()});
    localStorage.setItem(storageKey(uid),JSON.stringify(items.slice(0,60)));show();
  };
  window.saldoPlanShowSupportTickets=show;
  document.addEventListener('click',e=>{if(e.target.closest('[data-nav="support"]'))queueMicrotask(show);});
  show();
})();
