function renderDashboard(){
  const m=metrics(),s=savingsMetrics();
  document.querySelector('#monthLabel').textContent=`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  setMoney('cashNow',m.cashNow);setMoney('cashProjected',m.cashProjected);setMoney('flashNow',m.flashNow);
  document.querySelector('#flashProjected').textContent=`Projetado: ${fmt.format(m.flashProjected)}`;document.querySelectorAll('[data-bonus-label]').forEach(el=>el.textContent=bonusLabel());document.querySelectorAll('[data-bonus-visibility]').forEach(el=>el.classList.toggle('hidden',state.settings.bonusEnabled===false));
  setMoney('savedTotal',s.balance);document.querySelector('#savedMonthText').textContent=`No mês: ${fmt.format(s.monthNet)}`;
  const potential=Math.max(0,m.cashProjected);setMoney('savePotential',potential);document.querySelector('#goalText').textContent=`Meta mensal: ${fmt.format(state.savingGoal||0)}`;
  document.querySelector('#goalProgress').style.width=`${state.savingGoal?Math.min(100,potential/state.savingGoal*100):0}%`;
  setMoney('incomeFirst',sum(m.inc.filter(x=>x.incomeType==='first')));setMoney('incomeSecond',sum(m.inc.filter(x=>x.incomeType==='second')));setMoney('incomeExtra',sum(m.inc.filter(x=>x.incomeType==='extra')));setMoney('incomeFlash',sum(m.inc.filter(x=>x.incomeType==='flash')));
  setMoney('fixedTotal',sum(m.exp.filter(x=>x.expenseType==='fixed')));setMoney('variableTotal',sum(m.exp.filter(x=>x.expenseType==='variable')));setMoney('unplannedTotal',sum(m.exp.filter(x=>x.expenseType==='unplanned')));
  renderBars(m.exp);renderPending(m.exp);document.querySelector('#importNote').classList.toggle('hidden',!state.importNote);
}
function renderBars(exp){
  const by={};exp.forEach(x=>by[x.category||'Sem categoria']=(by[x.category||'Sem categoria']||0)+Number(x.amount||0));
  const rows=Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,5),max=Math.max(1,...rows.map(r=>r[1]));
  document.querySelector('#categoryBars').innerHTML=rows.length?rows.map(([name,val])=>`<div class="bar-row"><span>${escapeHtml(name)}</span><div class="bar-track"><i style="width:${val/max*100}%"></i></div><strong>${fmt.format(val)}</strong></div>`).join(''):'<div class="empty">Nenhum gasto no mês.</div>';
}
function renderPending(exp){const p=exp.filter(x=>x.status==='planned').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);document.querySelector('#pendingList').innerHTML=p.length?p.map(itemHtml).join(''):'<div class="empty">Nenhuma conta pendente.</div>'}
function bonusLabel(){return String(state.settings?.bonusName||'Bônus').trim()||'Bônus'}
function incomeLabel(t){return ({first:'Quinzena',second:'Final do mês',extra:'Extra',flash:bonusLabel()})[t]||'Entrada'}
function expenseLabel(t){return ({fixed:'Fixo',variable:'Variável',unplanned:'Imprevisto'})[t]||'Gasto'}
function defaultIncomeDescription(t){return ({first:'Salário - quinzena',second:'Salário - final do mês',extra:'Entrada extra',flash:bonusLabel()})[t]||'Entrada'}
function defaultExpenseDescription(t,category){const c=String(category||'').trim();return c||({fixed:'Gasto fixo',variable:'Gasto variável',unplanned:'Gasto imprevisto'})[t]||'Gasto'}
function itemHtml(x){
  const isInc=x.kind==='income',flash=isInc?x.incomeType==='flash':x.paySource==='flash',label=isInc?incomeLabel(x.incomeType):`${expenseLabel(x.expenseType)} · ${x.category||'Sem categoria'}`;
  return `<button class="item" data-edit="${x.id}" style="width:100%;text-align:left;cursor:pointer"><span class="item-icon ${flash?'flash':''}">${isInc?'+':'−'}</span><span class="item-main"><strong>${escapeHtml(x.description)}</strong><span>${formatDate(x.date)} · ${escapeHtml(label)}</span></span><span class="item-side"><strong class="${isInc?'positive':'negative'}">${isInc?'+ ':'− '}${fmt.format(x.amount)}</strong><span class="${x.status==='planned'?'pending':''}">${x.status==='planned'?'Previsto':'Realizado'}</span></span></button>`;
}
function renderTransactions(){const transactionMonthLabel=document.querySelector('#transactionMonthLabel');if(transactionMonthLabel)transactionMonthLabel.textContent=`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;let tx=transactions();if(filter==='income')tx=tx.filter(x=>x.kind==='income');if(filter==='expense')tx=tx.filter(x=>x.kind==='expense');if(filter==='pending')tx=tx.filter(x=>x.status==='planned');document.querySelector('#transactionList').innerHTML=tx.length?tx.map(itemHtml).join(''):'<div class="empty">Nada por aqui.</div>'}
function renderFixed(){
  const fixeds=state.fixedTemplates.filter(t=>(t.kind||'expense')==='expense');

  document.querySelector('#fixedList').innerHTML=fixeds.length
    ?fixeds.map(t=>{
      const start=formatMonthValue(t.startMonth);
      const end=t.endMonth?formatMonthValue(t.endMonth):'sem fim';

      return `<button class="item" data-template="${t.id}" style="width:100%;text-align:left;cursor:pointer">
        <span class="item-icon">↻</span>
        <span class="item-main">
          <strong>${escapeHtml(t.description)}</strong>
          <span>Dia ${t.dueDay} · ${escapeHtml(t.category||'Sem categoria')} · ${t.paySource==='flash'?bonusLabel():'Salário / conta'}</span>
        </span>
        <span class="item-side">
          <strong>${fmt.format(t.amount)}</strong>
          <span>${start} → ${end}</span>
        </span>
      </button>`;
    }).join('')
    :'<div class="empty">Nenhum gasto fixo automático.</div>';
}
function renderSavings(){
  const s=savingsMetrics();

  setMoney('savingBalance',s.balance);
  setMoney('savingDepositsMonth',s.monthDeposits);
  setMoney('savingWithdrawalsMonth',s.monthWithdrawals);
  setMoney('savingNetMonth',s.monthNet);

  const list=[...s.allItems].sort((a,b)=>b.date.localeCompare(a.date));

  document.querySelector('#savingList').innerHTML=list.length
    ?list.map(x=>{
      const planned=x.status==='planned';
      const movement=x.type==='deposit'?'Aporte':'Retirada';

      return `<button class="item" data-saving-edit="${x.id}" style="width:100%;text-align:left;cursor:pointer">
        <span class="item-icon saving">${x.type==='deposit'?'+':'−'}</span>
        <span class="item-main">
          <strong>${escapeHtml(x.description)}</strong>
          <span>${formatDate(x.date)} · ${escapeHtml(x.account||'Sem conta')}</span>
        </span>
        <span class="item-side">
          <strong class="${x.type==='deposit'?'positive':'negative'}">${x.type==='deposit'?'+ ':'− '}${fmt.format(x.amount)}</strong>
          <span class="saving-status ${planned?'pending':''}">${movement} · ${planned?'Previsto':'Realizado'}</span>
        </span>
      </button>`;
    }).join('')
    :'<div class="empty">Você ainda não registrou valores guardados.</div>';

  renderSavingChart(s.all);
}
function renderSavingChart(items){
  const root=document.querySelector('#savingChart');if(!items.length){root.innerHTML='<div class="empty" style="width:100%">Registre seu primeiro aporte para começar o histórico.</div>';return}
  let balance=0;const pts=items.map((x,i)=>{balance+=x.type==='deposit'?Number(x.amount): -Number(x.amount);return {i,balance,date:x.date}});
  const vals=pts.map(p=>p.balance),min=Math.min(0,...vals),max=Math.max(1,...vals),range=Math.max(1,max-min);const w=620,h=170,pad=22;
  const coords=pts.map((p,i)=>{const x=pts.length===1?w/2:pad+i*(w-2*pad)/(pts.length-1);const y=h-pad-(p.balance-min)/range*(h-2*pad);return [x,y]});
  const line=coords.map(c=>c.join(',')).join(' ');const area=`${pad},${h-pad} ${line} ${coords[coords.length-1][0]},${h-pad}`;
  const first=items[0]?.date?.slice(0,7)||'',last=items[items.length-1]?.date?.slice(0,7)||'';
  root.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolução do saldo guardado"><line class="chart-axis" x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}"/><polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${line}"/><text class="chart-label" x="${pad}" y="${h-5}">${escapeHtml(first)}</text><text class="chart-label" text-anchor="end" x="${w-pad}" y="${h-5}">${escapeHtml(last)}</text><text class="chart-label" x="${pad}" y="14">${escapeHtml(fmt.format(max))}</text></svg>`;
}
