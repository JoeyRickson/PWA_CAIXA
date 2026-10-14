// Calendário financeiro, alertas e fechamento mensal — SaldoPlan v2.20.0
function ensureCalendarState(){
  if(!Array.isArray(state.monthlyClosings))state.monthlyClosings=[];
  state.monthlyClosings=state.monthlyClosings.filter(item=>item&&/^\d{4}-\d{2}$/.test(String(item.month||''))).slice(-60);
  return state.monthlyClosings;
}

function localIsoDate(date=new Date()){
  const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function parseIsoLocal(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return null;
  const [year,month,day]=value.split('-').map(Number);
  const date=new Date(year,month-1,day);
  return Number.isNaN(date.getTime())?null:date;
}

function dayDiff(from,to){
  const a=parseIsoLocal(from),b=parseIsoLocal(to);
  if(!a||!b)return null;
  return Math.round((b-a)/86400000);
}

function calendarMonthBounds(month=key()){
  const [year,monthNumber]=month.split('-').map(Number);
  const lastDay=new Date(year,monthNumber,0).getDate();
  return {year,monthNumber,lastDay,start:`${month}-01`,end:`${month}-${String(lastDay).padStart(2,'0')}`};
}

function calendarEvents(month=key()){
  ensureRecurring();
  ensureSavingRecurring(month);
  const events=[];

  state.transactions.filter(item=>String(item.date||'').slice(0,7)===month).forEach(item=>{
    const card=item.cardPurchaseId&&typeof creditCardById==='function'?creditCardById(item.cardId):null;
    events.push({
      id:`tx:${item.id}`,
      date:item.date,
      type:item.kind==='income'?'income':'expense',
      title:item.description||'Lançamento',
      amount:Number(item.amount||0),
      status:item.status||'planned',
      meta:item.cardPurchaseId?`Cartão · ${card?.name||'Cartão'}`:(item.kind==='income'?'Entrada':item.category||'Gasto')
    });
  });

  (state.savings||[]).filter(item=>String(item.date||'').slice(0,7)===month).forEach(item=>events.push({
    id:`saving:${item.id}`,
    date:item.date,
    type:'saving',
    title:item.description||'Guardado',
    amount:Number(item.amount||0),
    status:item.status||'realized',
    meta:item.type==='withdrawal'?'Retirada':'Aporte'
  }));

  (state.investments||[]).filter(item=>item.status!=='redeemed'&&String(item.maturityDate||'').slice(0,7)===month).forEach(item=>events.push({
    id:`investment:${item.id}`,
    date:item.maturityDate,
    type:'investment',
    title:`Vencimento · ${item.product||item.name||portfolioTypeLabel?.(item.type)||'Investimento'}`,
    amount:Number(item.current||0),
    status:'planned',
    meta:item.institution||'Carteira'
  }));

  (state.liabilities||[]).filter(item=>item.status!=='paid'&&String(item.dueDate||'').slice(0,7)===month).forEach(item=>events.push({
    id:`liability:${item.id}`,
    date:item.dueDate,
    type:'liability',
    title:`Vencimento · ${item.name||'Dívida'}`,
    amount:Number(item.currentBalance||0),
    status:'planned',
    meta:item.institution||'Dívida'
  }));

  (state.financialGoals||[]).filter(goal=>String(goal.deadline||'').slice(0,7)===month).forEach(goal=>events.push({
    id:`goal:${goal.id}`,
    date:goal.deadline,
    type:'goal',
    title:`Prazo da meta · ${goal.name||'Meta'}`,
    amount:Number(goal.targetAmount||0),
    status:'planned',
    meta:'Meta financeira'
  }));

  return events.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.title).localeCompare(String(b.title)));
}

function calendarEventHtml(event){
  const amount=Number(event.amount||0);
  const prefix=event.type==='income'?'+ ':event.type==='expense'||event.type==='liability'?'− ':'';
  const amountText=amount>0?` · ${prefix}${fmt.format(amount)}`:'';
  return `<span class="calendar-event ${event.type}" title="${escapeHtml(event.title)}${escapeHtml(amountText)}">${escapeHtml(event.title)}${escapeHtml(amountText)}</span>`;
}

function renderFinancialCalendar(events){
  const host=document.querySelector('#financialCalendar');
  const mobile=document.querySelector('#calendarMobileAgenda');
  if(!host||!mobile)return;

  const {year,monthNumber,lastDay}=calendarMonthBounds();
  const firstWeekday=new Date(year,monthNumber-1,1).getDay();
  const weekdays=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const todayKey=localIsoDate();
  const byDate=new Map();
  events.forEach(event=>{
    if(!byDate.has(event.date))byDate.set(event.date,[]);
    byDate.get(event.date).push(event);
  });

  let html=weekdays.map(day=>`<div class="calendar-weekday">${day}</div>`).join('');
  const previousLast=new Date(year,monthNumber-1,0).getDate();
  for(let slot=0;slot<42;slot++){
    const relative=slot-firstWeekday+1;
    let day,monthOffset=0;
    if(relative<1){day=previousLast+relative;monthOffset=-1}
    else if(relative>lastDay){day=relative-lastDay;monthOffset=1}
    else day=relative;
    const dateObj=new Date(year,monthNumber-1+monthOffset,day);
    const iso=localIsoDate(dateObj);
    const rows=byDate.get(iso)||[];
    const visible=rows.slice(0,3);
    html+=`<div class="calendar-day ${monthOffset!==0?'is-outside':''} ${iso===todayKey?'is-today':''} ${rows.length?'has-events':''}">
      <div class="calendar-day-number"><span>${day}</span>${iso===todayKey?'<small>Hoje</small>':''}</div>
      <div class="calendar-event-stack">${visible.map(calendarEventHtml).join('')}${rows.length>3?`<span class="calendar-more">+ ${rows.length-3} evento${rows.length-3===1?'':'s'}</span>`:''}</div>
    </div>`;
  }
  host.innerHTML=html;

  const days=[...byDate.entries()].filter(([date])=>date.slice(0,7)===key()).sort((a,b)=>a[0].localeCompare(b[0]));
  mobile.innerHTML=days.length?days.map(([date,rows])=>{
    const parsed=parseIsoLocal(date);
    const label=new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(parsed).replace('.','');
    return `<article class="calendar-mobile-day"><div class="calendar-mobile-date"><strong>${String(parsed.getDate()).padStart(2,'0')}</strong><span>${escapeHtml(label)}</span></div><div class="calendar-mobile-events">${rows.map(calendarEventHtml).join('')}</div></article>`;
  }).join(''):'<div class="empty">Nenhum evento financeiro neste mês.</div>';
}

function calendarAlerts(){
  const alerts=[];
  const todayKey=localIsoDate();
  const push=(severity,title,detail,date='',sortDays=999)=>alerts.push({severity,title,detail,date,sortDays});

  const plannedExpenses=(state.transactions||[]).filter(item=>item.kind==='expense'&&item.status==='planned'&&!item.cardPurchaseId&&item.date);
  plannedExpenses.forEach(item=>{
    const diff=dayDiff(todayKey,item.date);
    if(diff===null)return;
    if(diff<0)push('danger',`Conta vencida · ${item.description}`,fmt.format(item.amount),item.date,diff);
    else if(diff<=3)push('warning',`Conta vence ${diff===0?'hoje':diff===1?'amanhã':`em ${diff} dias`} · ${item.description}`,fmt.format(item.amount),item.date,diff);
  });

  if(typeof creditCardById==='function'){
    const cardGroups=new Map();
    (state.transactions||[]).filter(item=>item.cardPurchaseId&&item.status==='planned'&&item.date).forEach(item=>{
      const groupKey=`${item.cardId}:${item.date}`;
      const current=cardGroups.get(groupKey)||{cardId:item.cardId,date:item.date,total:0,count:0};
      current.total+=Number(item.amount||0);current.count++;
      cardGroups.set(groupKey,current);
    });
    cardGroups.forEach(group=>{
      const diff=dayDiff(todayKey,group.date);
      if(diff===null||diff>7)return;
      const card=creditCardById(group.cardId);
      if(diff<0)push('danger',`Fatura vencida · ${cardDisplayName(card)}`,`${fmt.format(group.total)} · ${group.count} parcela${group.count===1?'':'s'}`,group.date,diff);
      else if(diff<=3)push('warning',`Fatura vence ${diff===0?'hoje':diff===1?'amanhã':`em ${diff} dias`} · ${cardDisplayName(card)}`,fmt.format(group.total),group.date,diff);
      else push('info',`Fatura próxima · ${cardDisplayName(card)}`,fmt.format(group.total),group.date,diff);
    });
  }

  (state.investments||[]).filter(item=>item.status!=='redeemed'&&item.maturityDate).forEach(item=>{
    const diff=dayDiff(todayKey,item.maturityDate);if(diff===null||diff<0||diff>30)return;
    push(diff<=7?'warning':'info',`Investimento vence ${diff===0?'hoje':`em ${diff} dias`} · ${item.product||item.name||'Investimento'}`,item.institution||portfolioTypeLabel?.(item.type)||'Carteira',item.maturityDate,diff);
  });

  (state.liabilities||[]).filter(item=>item.status!=='paid'&&item.dueDate).forEach(item=>{
    const diff=dayDiff(todayKey,item.dueDate);if(diff===null||diff>30)return;
    if(diff<0)push('danger',`Dívida vencida · ${item.name}`,fmt.format(item.currentBalance||0),item.dueDate,diff);
    else push(diff<=7?'warning':'info',`Dívida vence ${diff===0?'hoje':`em ${diff} dias`} · ${item.name}`,fmt.format(item.currentBalance||0),item.dueDate,diff);
  });

  const patrimony=typeof patrimonyMetrics==='function'?patrimonyMetrics():null;
  (state.financialGoals||[]).filter(goal=>goal.deadline).forEach(goal=>{
    const current=typeof goalCurrentValue==='function'?goalCurrentValue(goal,patrimony):Number(goal.currentAmount||0);
    if(current>=Number(goal.targetAmount||0))return;
    const diff=dayDiff(todayKey,goal.deadline);if(diff===null||diff<0||diff>30)return;
    push(diff<=7?'warning':'info',`Prazo da meta ${diff===0?'hoje':`em ${diff} dias`} · ${goal.name}`,`${fmt.format(current)} de ${fmt.format(goal.targetAmount||0)}`,goal.deadline,diff);
  });

  [...(state.fixedTemplates||[]),...(state.savingTemplates||[])].forEach(template=>{
    const end=typeof recurringEndDate==='function'?recurringEndDate(template):template.endDate;
    if(!end)return;
    const diff=dayDiff(todayKey,end);if(diff===null||diff<0||diff>30)return;
    push('info',`Recorrência termina ${diff===0?'hoje':`em ${diff} dias`} · ${template.description||'Recorrência'}`,end,'',diff);
  });

  if(typeof patrimonyProjection==='function'){
    const projection=patrimonyProjection(30);
    if(projection.cash<0)push('danger','Caixa projetado negativo em 30 dias',fmt.format(projection.cash),projection.endDate,30);
  }

  const weight={danger:0,warning:1,info:2};
  return alerts.sort((a,b)=>(weight[a.severity]-weight[b.severity])||(a.sortDays-b.sortDays)||String(a.title).localeCompare(String(b.title)));
}

function renderCalendarAlerts(alerts=calendarAlerts()){
  const host=document.querySelector('#calendarAlerts');
  if(host){
    host.innerHTML=alerts.length?alerts.map(alert=>`<article class="calendar-alert-item ${alert.severity}"><span class="calendar-alert-icon">${alert.severity==='danger'?'!':alert.severity==='warning'?'△':'i'}</span><span class="calendar-alert-copy"><strong>${escapeHtml(alert.title)}</strong><span>${escapeHtml(alert.detail||'')}</span></span><span class="calendar-alert-date">${alert.date?formatDate(alert.date):''}</span></article>`).join(''):'<div class="empty">Nenhum alerta importante agora.</div>';
  }
  const count=document.querySelector('#calendarAlertCount');if(count)count.textContent=String(alerts.length);
  const badge=document.querySelector('#calendarAlertBadge');if(badge)badge.textContent=`${alerts.length} alerta${alerts.length===1?'':'s'}`;
  const summary=document.querySelector('#calendarAlertSummary');if(summary)summary.textContent=alerts[0]?.title||'Nenhum alerta importante';
  return alerts;
}

function monthRealizedSummary(month){
  const tx=(state.transactions||[]).filter(item=>String(item.date||'').slice(0,7)===month);
  const realizedIncome=sum(tx.filter(item=>item.kind==='income'&&item.status==='realized'));
  const realizedExpenses=sum(tx.filter(item=>item.kind==='expense'&&item.status==='realized'));
  const pendingExpenses=sum(tx.filter(item=>item.kind==='expense'&&item.status==='planned'));
  const plannedIncome=sum(tx.filter(item=>item.kind==='income'&&item.status==='planned'));
  const savings=(state.savings||[]).filter(item=>String(item.date||'').slice(0,7)===month&&item.status==='realized');
  const savingsDeposits=sum(savings.filter(item=>item.type==='deposit'));
  const savingsWithdrawals=sum(savings.filter(item=>item.type==='withdrawal'));
  const savingsNet=round2(savingsDeposits-savingsWithdrawals);
  const result=round2(realizedIncome-realizedExpenses);
  const savingsRate=realizedIncome>0?round2(Math.max(0,savingsNet)/realizedIncome*100):0;
  const categoryMap={};
  tx.filter(item=>item.kind==='expense'&&item.status==='realized').forEach(item=>categoryMap[item.category||'Sem categoria']=(categoryMap[item.category||'Sem categoria']||0)+Number(item.amount||0));
  const categories=Object.entries(categoryMap).map(([name,value])=>({name,value:round2(value)})).sort((a,b)=>b.value-a.value).slice(0,5);
  return {month,realizedIncome:round2(realizedIncome),realizedExpenses:round2(realizedExpenses),pendingExpenses:round2(pendingExpenses),plannedIncome:round2(plannedIncome),savingsNet,result,savingsRate,categories,transactionCount:tx.length};
}

function renderMonthlyClosing(){
  ensureCalendarState();
  const summary=monthRealizedSummary(key());
  const previous=monthRealizedSummary(monthKeyAdd(key(),-1));
  setMoney('closingIncome',summary.realizedIncome);setMoney('closingExpenses',summary.realizedExpenses);setMoney('closingResult',summary.result);setMoney('closingSavings',summary.savingsNet);setMoney('closingPending',summary.pendingExpenses);
  const rate=document.querySelector('#closingSavingsRate');if(rate)rate.textContent=`${summary.savingsRate.toFixed(1).replace('.',',')}%`;
  const title=document.querySelector('#monthlyClosingTitle');if(title)title.textContent=`Fechamento · ${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const resultEl=document.querySelector('#closingResult');if(resultEl){resultEl.classList.toggle('negative',summary.result<0);resultEl.classList.toggle('positive',summary.result>0)}
  const savingsEl=document.querySelector('#closingSavings');if(savingsEl){savingsEl.classList.toggle('negative',summary.savingsNet<0);savingsEl.classList.toggle('positive',summary.savingsNet>0)}

  const diff=round2(summary.result-previous.result);
  const comparison=document.querySelector('#closingComparison');
  if(comparison)comparison.innerHTML=`<span>Anterior: <strong>${fmt.format(previous.result)}</strong></span><span>Atual: <strong>${fmt.format(summary.result)}</strong></span><span>Variação: <strong class="${diff>0?'positive':diff<0?'negative':''}">${diff>=0?'+ ':''}${fmt.format(diff)}</strong></span>`;

  const categories=document.querySelector('#closingCategories');
  if(categories)categories.innerHTML=summary.categories.length?summary.categories.map(item=>`<div class="calendar-closing-category"><span>${escapeHtml(item.name)}</span><strong>${fmt.format(item.value)}</strong></div>`).join(''):'<div class="empty">Nenhum gasto realizado.</div>';

  const saved=state.monthlyClosings.find(item=>item.month===key());
  const button=document.querySelector('#saveMonthlyClosing');if(button)button.textContent=saved?'Atualizar fechamento':'Salvar fechamento';
  const stateHost=document.querySelector('#monthlyClosingSavedState');
  if(stateHost)stateHost.innerHTML=saved?`<div class="notice"><div><strong>Fechamento salvo</strong><p>Última atualização: ${escapeHtml(new Date(saved.savedAt).toLocaleString('pt-BR'))}. Salvar novamente atualiza este registro.</p></div></div>`:'';

  renderMonthlyClosingHistory();
  return summary;
}

function renderMonthlyClosingHistory(){
  ensureCalendarState();
  const rows=[...state.monthlyClosings].sort((a,b)=>String(b.month).localeCompare(String(a.month))).slice(0,12);
  const host=document.querySelector('#monthlyClosingHistory');if(!host)return;
  const count=document.querySelector('#monthlyClosingCount');if(count)count.textContent=String(state.monthlyClosings.length);
  host.innerHTML=rows.length?rows.map(item=>{
    const [year,monthNumber]=item.month.split('-').map(Number);
    return `<article class="calendar-closing-history-item"><span><strong>${MONTHS[monthNumber-1]} ${year}</strong><small>Entradas ${fmt.format(item.realizedIncome||0)} · Gastos ${fmt.format(item.realizedExpenses||0)} · Aportes ${fmt.format(item.savingsNet||0)}</small></span><strong class="${Number(item.result||0)<0?'negative':'positive'}">${fmt.format(item.result||0)}</strong><button type="button" class="icon-btn small" data-closing-delete="${item.month}" aria-label="Excluir fechamento">×</button></article>`;
  }).join(''):'<div class="empty">Nenhum fechamento salvo ainda.</div>';
}

function saveMonthlyClosingSnapshot(){
  ensureCalendarState();
  const summary=monthRealizedSummary(key());
  const snapshot={...summary,savedAt:new Date().toISOString()};
  const index=state.monthlyClosings.findIndex(item=>item.month===key());
  if(index>=0)state.monthlyClosings[index]=snapshot;else state.monthlyClosings.push(snapshot);
  state.monthlyClosings=state.monthlyClosings.sort((a,b)=>String(a.month).localeCompare(String(b.month))).slice(-60);
  save({undoLabel:`Fechamento mensal salvo · ${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`});
  renderAll();
}

function deleteMonthlyClosing(month){
  const [year,monthNumber]=String(month).split('-').map(Number);
  if(!confirm(`Excluir o fechamento salvo de ${MONTHS[monthNumber-1]} ${year}?`))return;
  state.monthlyClosings=state.monthlyClosings.filter(item=>item.month!==month);
  save({undoLabel:`Fechamento mensal excluído · ${MONTHS[monthNumber-1]} ${year}`});
  renderAll();
}

function renderCalendarDashboard(){
  const root=document.querySelector('#calendarDashboardAlerts');if(!root)return;
  const alerts=calendarAlerts();
  const urgent=alerts.filter(item=>item.severity==='danger'||item.severity==='warning');
  const next=alerts.slice(0,3);
  const closing=state.monthlyClosings?.find(item=>item.month===key());
  const count=document.querySelector('#dashboardCalendarAlertCount');if(count)count.textContent=String(alerts.length);
  const urgentEl=document.querySelector('#dashboardCalendarUrgent');if(urgentEl)urgentEl.textContent=String(urgent.length);
  const closingEl=document.querySelector('#dashboardCalendarClosing');if(closingEl)closingEl.textContent=closing?'Salvo':'Pendente';
  root.innerHTML=next.length?next.map(item=>`<div class="calendar-dashboard-alert"><span>${escapeHtml(item.title)}</span><strong>${item.date?formatDate(item.date):''}</strong></div>`).join(''):'<div class="empty">Nenhum alerta importante.</div>';
}

function renderCalendar(){
  const root=document.querySelector('#view-calendar');if(!root)return;
  ensureCalendarState();ensureRecurring();ensureSavingRecurring(key());
  const events=calendarEvents(key());
  const tx=(state.transactions||[]).filter(item=>String(item.date||'').slice(0,7)===key());
  const expectedIncome=sum(tx.filter(item=>item.kind==='income'));
  const expectedExpense=sum(tx.filter(item=>item.kind==='expense'));
  const label=document.querySelector('#calendarMonthLabel');if(label)label.textContent=`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const todayBadge=document.querySelector('#calendarTodayBadge');if(todayBadge)todayBadge.textContent=localIsoDate().slice(0,7)===key()?'Mês atual':key();
  const eventCount=document.querySelector('#calendarEventCount');if(eventCount)eventCount.textContent=String(events.length);
  setMoney('calendarExpectedIncome',expectedIncome);setMoney('calendarExpectedExpense',expectedExpense);
  renderFinancialCalendar(events);renderCalendarAlerts();renderMonthlyClosing();renderCalendarDashboard();
}

ensureCalendarState();
document.querySelector('#saveMonthlyClosing')?.addEventListener('click',saveMonthlyClosingSnapshot);
document.querySelector('#view-calendar')?.addEventListener('click',event=>{const button=event.target.closest('[data-closing-delete]');if(button)deleteMonthlyClosing(button.dataset.closingDelete)});
