/* SaldoPlan v5: aprimoramentos locais com retenção do formato de dados v4. */
(function(){
  'use strict';
  const byId=id=>document.getElementById(id);
  const engine=window.saldoPlanV5Engine;
  const currentMonth=()=>`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`;
  const assistantForm=byId('sp5AskForm');
  function ask(value){
    if(!engine)return;
    const output=byId('sp5AskResult');if(!output)return;
    output.textContent=engine.analyze(state,currentMonth(),value);
  }
  assistantForm?.addEventListener('submit',ev=>{ev.preventDefault();ask(byId('sp5AskInput').value)});
  document.querySelectorAll('[data-sp5-question]').forEach(btn=>btn.addEventListener('click',()=>{
    byId('sp5AskInput').value=btn.dataset.sp5Question;ask(btn.dataset.sp5Question);
  }));
  // Aportes somente sobre progresso manual: não altera lançamentos nem carteiras.
  const goalForm=byId('sp5GoalDeposit');
  function refreshGoals(){
    const select=byId('sp5GoalId');if(!select)return;
    const existing=select.value;
    select.replaceChildren();
    const rows=(state.financialGoals||[]).filter(x=>x.source==='manual');
    if(!rows.length){const op=new Option('Crie uma meta manual primeiro','');select.add(op);return;}
    for(const goal of rows)select.add(new Option(goal.name,goal.id));
    if(rows.some(x=>x.id===existing))select.value=existing;
  }
  goalForm?.addEventListener('submit',ev=>{
    ev.preventDefault();
    const output=byId('sp5GoalStatus');
    const goal=(state.financialGoals||[]).find(g=>g.id===byId('sp5GoalId').value&&g.source==='manual');
    const amount=money(byId('sp5GoalAmount').value);
    if(!goal||!Number.isFinite(amount)||amount<=0||amount>1e9){output.textContent='Escolha uma meta manual e um valor válido.';return;}
    goal.currentAmount=round2(Math.max(0,Number(goal.currentAmount||0))+amount);
    goal.contributions=Array.isArray(goal.contributions)?goal.contributions.slice(-99):[];
    goal.contributions.push({date:new Date().toISOString(),amount:round2(amount)});
    save({undoLabel:`Progresso de meta: ${goal.name}`});
    byId('sp5GoalAmount').value='';output.textContent=`Progresso registrado: ${fmt.format(goal.currentAmount)}. Nenhuma transação financeira foi criada.`;
    renderAll();refreshGoals();
  });
  document.addEventListener('click',ev=>{
    const nav=ev.target.closest('[data-nav="patrimony"]');
    if(nav)setTimeout(refreshGoals,0);
  });
  const view=byId('view-patrimony');
  if(view)new MutationObserver(()=>{if(view.classList.contains('active'))refreshGoals();}).observe(view,{attributes:true,attributeFilter:['class']});
  refreshGoals();
  // PDF via impressão isolada, evitando biblioteca externa e popups automáticos.
  byId('sp5ClosingPdf')?.addEventListener('click',()=>{
    const summary=typeof monthRealizedSummary==='function'?monthRealizedSummary(currentMonth()):engine?.totals(state,currentMonth());
    if(!summary)return;
    const safe=s=>String(s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const month=currentMonth();const cats=summary.categories;
    const rows=Array.isArray(cats)?cats:Object.entries(cats||{}).map(([name,value])=>({name,value}));
    const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>SaldoPlan · Fechamento ${safe(month)}</title><style>body{font:16px Arial;color:#172033;margin:34px}h1{color:#136f6a}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}.note{color:#555;font-size:12px}</style><h1>SaldoPlan · Fechamento ${safe(month)}</h1><p>Entradas realizadas: <strong>${fmt.format(summary.realizedIncome??summary.income??0)}</strong></p><p>Despesas realizadas: <strong>${fmt.format(summary.realizedExpenses??summary.expense??0)}</strong></p><p>Resultado: <strong>${fmt.format(summary.result??summary.balance??0)}</strong></p><h2>Principais categorias</h2><table><tr><th>Categoria</th><th>Valor</th></tr>${rows.map(c=>`<tr><td>${safe(c.name)}</td><td>${fmt.format(c.value)}</td></tr>`).join('')}</table><p class="note">Relatório gerado localmente; não equivale a extrato bancário reconciliado. Pagamentos de cartões podem duplicar despesas.</p><script>window.onload=()=>window.print();<\/script></html>`;
    const popup=window.open('','_blank');
    if(!popup){alert('Permita a abertura de uma nova aba para salvar o PDF.');return;}
    popup.document.open();popup.document.write(html);popup.document.close();
  });
  // A preferência do cron é salva por UID no servidor e pode ser atualizada pelo botão de ativação.
  const pref=byId('sp5PushDays');
  if(pref){
    pref.value=localStorage.getItem(`saldoplan.push.advance.v5.${PROFILE_ACTIVE_SCOPE}`)||'0';
    pref.addEventListener('change',()=>localStorage.setItem(`saldoplan.push.advance.v5.${PROFILE_ACTIVE_SCOPE}`,pref.value));
  }
  // Sem armazenar secrets / dados financeiros em serviços de analytics.
})();
