/* SaldoPlan v3.0.0 — orçamento, insights, busca e relatório anual. Dados locais. */
(function(){
  'use strict';
  const root=document.querySelector('#view-intelligence');
  if(!root)return;
  const $=id=>document.getElementById(id);
  const brl=v=>fmt.format(Number(v)||0);
  const safe=v=>escapeHtml(String(v??''));
  const items=()=>Array.isArray(state.transactions)?state.transactions:[];
  const expenses=(month,real=true)=>items().filter(t=>t.kind==='expense'&&t.date?.slice(0,7)===month&&(!real||t.status==='realized'));
  const income=(month,real=true)=>items().filter(t=>t.kind==='income'&&t.date?.slice(0,7)===month&&(!real||t.status==='realized'));
  function monthForOffset(month,delta){const [y,m]=month.split('-').map(Number);return monthKey(new Date(y,m-1+delta,1));}
  function category(t){return String(t.category||t.expenseType||'Outros').trim()||'Outros';}
  function amount(t){return Math.max(0,Number(t.amount)||0);}
  function renderBudget(){
    const k=key();$('sp3BudgetMonth').textContent=MONTHS[cursor.getMonth()]+' '+cursor.getFullYear();
    const categoryList=[...new Set(items().filter(t=>t.kind==='expense').map(category))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    $('sp3CategoryList').innerHTML=categoryList.map(c=>`<option value="${safe(c)}"></option>`).join('');
    const budgets=(state.budgets||[]).filter(b=>b.month===k).sort((a,b)=>a.category.localeCompare(b.category,'pt-BR'));
    const node=$('sp3BudgetList');
    if(!budgets.length){node.innerHTML='<div class="sp3-entry">Nenhum limite definido neste mês. Comece adicionando uma categoria.</div>';return;}
    node.innerHTML=budgets.map(b=>{
      const spent=expenses(k).filter(t=>category(t).toLocaleLowerCase('pt-BR')===b.category.toLocaleLowerCase('pt-BR')).reduce((s,t)=>s+amount(t),0);
      const pct=b.limit>0?Math.round(spent/b.limit*100):0;
      return `<div class="sp3-entry"><div class="sp3-line"><strong>${safe(b.category)}</strong><strong>${brl(spent)} / ${brl(b.limit)}</strong></div><div class="sp3-meter ${spent>b.limit?'over':''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,pct)}" aria-label="Orçamento ${safe(b.category)}"><i style="width:${Math.min(100,pct)}%"></i></div><div class="sp3-line"><small>${pct}% utilizado · ${spent>b.limit?'Acima do limite em '+brl(spent-b.limit):'Disponível: '+brl(b.limit-spent)}</small><button type="button" class="btn ghost small" data-sp3-delete="${safe(b.id)}">Excluir</button></div></div>`;
    }).join('');
  }
  function renderInsights(){
    const month=key(),previous=monthForOffset(month,-1);
    const cur=expenses(month).reduce((s,t)=>s+amount(t),0),old=expenses(previous).reduce((s,t)=>s+amount(t),0);
    const curIncome=income(month).reduce((s,t)=>s+amount(t),0);
    const byCategory=new Map();
    expenses(month).forEach(t=>byCategory.set(category(t),(byCategory.get(category(t))||0)+amount(t)));
    const ranked=[...byCategory].sort((a,b)=>b[1]-a[1]);
    const diff=cur-old;
    const budgets=(state.budgets||[]).filter(b=>b.month===month);
    const over=budgets.filter(b=>(byCategory.get(b.category)||0)>b.limit);
    const change=old>0?`${diff>=0?'+':''}${Math.round(diff/old*100)}%`:'Sem base anterior';
    $('sp3Insights').innerHTML=`
      <div class="sp3-stat-grid"><div class="sp3-entry"><small>Entradas realizadas</small><strong>${brl(curIncome)}</strong></div><div class="sp3-entry"><small>Despesas realizadas</small><strong>${brl(cur)}</strong></div><div class="sp3-entry"><small>Sobra registrada</small><strong>${brl(curIncome-cur)}</strong></div></div>
      <div class="sp3-entry"><strong>Comparação com ${safe(MONTHS[Number(previous.slice(5))-1])}</strong><small>Diferença nas despesas: ${brl(diff)} · ${safe(change)}. ${old===0?'Não há despesas anteriores suficientes para uma taxa confiável.':''}</small></div>
      <div class="sp3-entry"><strong>Maior categoria no mês</strong><small>${ranked.length?safe(ranked[0][0])+' — '+brl(ranked[0][1]):'Ainda sem gastos realizados.'}</small></div>
      <div class="sp3-entry"><strong>Orçamentos acima do limite</strong><small>${over.length?over.map(b=>safe(b.category)).join(', '):'Nenhum limite ultrapassado nas categorias cadastradas.'}</small></div>
      <div class="sp3-entry"><strong>Concentração de gastos</strong><small>${ranked.length?ranked.slice(0,5).map(([c,n])=>`${safe(c)}: ${brl(n)}`).join(' · '):'Cadastre lançamentos para gerar análises.'}</small></div>
      <p class="helper small-text">Insights descritivos baseados em movimentações realizadas; não constituem aconselhamento de investimentos.</p>`;
  }
  function searchRows(){
    const rows=[];
    (state.transactions||[]).forEach(x=>rows.push({type:'transaction',title:x.description||'Lançamento',detail:`${x.date||''} · ${x.category||x.incomeType||x.expenseType||''} · ${x.status||''}`,value:brl(x.amount)}));
    (state.savings||[]).forEach(x=>rows.push({type:'saving',title:x.description||'Movimento guardado',detail:`${x.date||''} · ${x.type||''}`,value:brl(x.amount)}));
    (state.investments||[]).forEach(x=>rows.push({type:'investment',title:x.product||x.produto||x.name||'Investimento',detail:x.institution||x.instituicao||'',value:brl(x.currentValue??x.value??x.amount)}));
    (state.creditCards||[]).forEach(x=>rows.push({type:'card',title:x.name||'Cartão',detail:x.institution||'',value:brl(x.limit)}));
    (state.liabilities||[]).forEach(x=>rows.push({type:'debt',title:x.name||'Dívida',detail:x.institution||'',value:brl(x.currentBalance)}));
    (state.financialGoals||[]).forEach(x=>rows.push({type:'goal',title:x.name||'Meta',detail:x.deadline||'',value:brl(x.targetAmount)}));
    return rows;
  }
  function renderSearch(){
    const q=$('sp3SearchQuery').value.trim().toLocaleLowerCase('pt-BR');
    const type=$('sp3SearchType').value;
    if(!q){$('sp3SearchCount').textContent='Digite uma palavra ou valor para pesquisar.';$('sp3SearchResults').innerHTML='';return;}
    const matches=searchRows().filter(x=>(type==='all'||type===x.type)&&[x.title,x.detail,x.value].join(' ').toLocaleLowerCase('pt-BR').includes(q));
    $('sp3SearchCount').textContent=`${matches.length} resultado(s) · exibindo até 80.`;
    $('sp3SearchResults').innerHTML=matches.length?matches.slice(0,80).map(x=>`<article class="sp3-entry"><div class="sp3-line"><strong>${safe(x.title)}</strong><strong>${safe(x.value)}</strong></div><small>${safe(x.detail)} · ${safe(x.type)}</small></article>`).join(''):'<p class="helper">Nenhum resultado encontrado.</p>';
  }
  function yearData(){
    const y=Number($('sp3ReportYear').value)||new Date().getFullYear();
    return Array.from({length:12},(_,i)=>{
      const month=`${y}-${String(i+1).padStart(2,'0')}`;
      const entered=income(month).reduce((s,x)=>s+amount(x),0);
      const out=expenses(month).reduce((s,x)=>s+amount(x),0);
      return {month,name:MONTHS[i],entered,out,balance:entered-out};
    });
  }
  function renderAnnual(){
    const select=$('sp3ReportYear'),selected=select.value||String(new Date().getFullYear());
    const years=new Set([new Date().getFullYear(),...items().map(x=>Number(x.date?.slice(0,4))).filter(y=>y>=2000&&y<=2100)]);
    select.innerHTML=[...years].sort((a,b)=>b-a).map(y=>`<option value="${y}">${y}</option>`).join('');
    select.value=[...years].map(String).includes(selected)?selected:String(new Date().getFullYear());
    const data=yearData();
    const ins=data.reduce((s,x)=>s+x.entered,0),outs=data.reduce((s,x)=>s+x.out,0),max=Math.max(1,...data.map(x=>x.out));
    $('sp3AnnualSummary').innerHTML=`<div class="sp3-entry"><small>Entradas</small><strong>${brl(ins)}</strong></div><div class="sp3-entry"><small>Saídas</small><strong>${brl(outs)}</strong></div><div class="sp3-entry"><small>Resultado</small><strong>${brl(ins-outs)}</strong></div>`;
    $('sp3AnnualChart').innerHTML=data.map(x=>`<div class="sp3-bar-col"><div class="sp3-bar" title="${safe(x.name)}: ${brl(x.out)}"><i style="height:${Math.min(100,100*x.out/max)}%"></i></div><span>${safe(x.name.slice(0,3))}</span></div>`).join('');
    $('sp3AnnualRows').innerHTML=data.map(x=>`<tr><td>${safe(x.name)}</td><td>${brl(x.entered)}</td><td>${brl(x.out)}</td><td>${brl(x.balance)}</td></tr>`).join('');
  }
  function renderIntelligence(){renderBudget();renderInsights();renderSearch();renderAnnual();}
  window.saldoPlanRenderIntelligence=renderIntelligence;
  root.querySelectorAll('[data-sp3-tab]').forEach(btn=>btn.addEventListener('click',()=>{
    root.querySelectorAll('[data-sp3-tab]').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-selected',String(b===btn));});
    root.querySelectorAll('[data-sp3-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.sp3Panel!==btn.dataset.sp3Tab));
    renderIntelligence();
  }));
  $('sp3BudgetForm').addEventListener('submit',e=>{
    e.preventDefault();const category=$('sp3BudgetCategory').value.trim(),limit=money($('sp3BudgetAmount').value);
    if(!category||category.length>60||limit<=0||limit>100000000){alert('Informe uma categoria e limite válido.');return;}
    state.budgets=Array.isArray(state.budgets)?state.budgets:[];
    const existing=state.budgets.find(b=>b.month===key()&&b.category.toLocaleLowerCase('pt-BR')===category.toLocaleLowerCase('pt-BR'));
    if(existing){existing.limit=round2(limit);}else state.budgets.push({id:uid(),month:key(),category,limit:round2(limit)});
    save({undoLabel:'Orçamento alterado'});$('sp3BudgetAmount').value='';renderIntelligence();
  });
  $('sp3BudgetList').addEventListener('click',e=>{
    const id=e.target.closest('[data-sp3-delete]')?.dataset.sp3Delete;
    if(!id||!confirm('Excluir este orçamento do mês?'))return;
    state.budgets=state.budgets.filter(b=>b.id!==id);save({undoLabel:'Orçamento removido'});renderIntelligence();
  });
  $('sp3SearchQuery').addEventListener('input',renderSearch);
  $('sp3SearchType').addEventListener('change',renderSearch);
  $('sp3ReportYear').addEventListener('change',()=>{const desired=$('sp3ReportYear').value;renderAnnual();$('sp3ReportYear').value=desired;});
  $('sp3ExportCsv').addEventListener('click',()=>{
    const rows=[['Mês','Entradas','Saídas','Saldo'],...yearData().map(x=>[x.month,x.entered.toFixed(2),x.out.toFixed(2),x.balance.toFixed(2)])];
    download(`saldoplan-relatorio-${$('sp3ReportYear').value}.csv`,'\uFEFF'+rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n'),'text/csv;charset=utf-8');
  });
  $('sp3ExportPdf').addEventListener('click',()=>{
    const rows=yearData();const tab=window.open('','_blank');if(!tab){alert('Permita pop-ups para salvar o relatório em PDF.');return;}
    const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>SaldoPlan · Relatório anual</title><style>body{font-family:Arial,sans-serif;color:#152033;margin:35px}h1{color:#192d47}table{border-collapse:collapse;width:100%}td,th{padding:12px;border-bottom:1px solid #ddd;text-align:left}th{background:#edf2f8}@media print{body{margin:14mm}}</style></head><body><h1>SaldoPlan · Relatório anual ${safe($('sp3ReportYear').value)}</h1><p>Valores de lançamentos realizados, por data; revise possíveis pagamentos de fatura duplicados.</p><table><tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Resultado</th></tr>${rows.map(x=>`<tr><td>${safe(x.name)}</td><td>${brl(x.entered)}</td><td>${brl(x.out)}</td><td>${brl(x.balance)}</td></tr>`).join('')}</table><script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`;
    tab.document.open();tab.document.write(html);tab.document.close();
  });
  renderIntelligence();
})();
