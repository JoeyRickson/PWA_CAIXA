// Patrimônio, dívidas, metas e projeções — SaldoPlan v2.18.0
function currentRealizedCashBalance(){
  const month=monthKey(today);
  const tx=state.transactions.filter(item=>String(item.date||'').slice(0,7)===month);
  const income=sum(tx.filter(item=>item.kind==='income'&&item.incomeType!=='flash'&&item.status==='realized'));
  const expense=sum(tx.filter(item=>item.kind==='expense'&&item.paySource==='cash'&&item.status==='realized'));
  return round2(income-expense);
}

function patrimonyFgtsBalance(){
  if(typeof fgtsAccountBalance!=='function')return 0;
  return round2((state.fgtsAccounts||[]).filter(account=>!account.isLegacy).reduce((total,account)=>total+Number(fgtsAccountBalance(account)||0),0));
}

function activeManualLiabilities(){
  return (state.liabilities||[]).filter(item=>item.status!=='paid'&&Number(item.currentBalance||0)>0);
}

function patrimonyMetrics(){
  const settings=state.patrimonySettings||{cashMode:'auto',manualCash:0};
  const cash=settings.cashMode==='manual'?Number(settings.manualCash||0):currentRealizedCashBalance();
  const savings=typeof savingsMetrics==='function'?Number(savingsMetrics(monthKey(today)).balance||0):0;
  const portfolio=typeof portfolioMetrics==='function'?Number(portfolioMetrics().current||0):0;
  const fgts=patrimonyFgtsBalance();
  const cardDebt=typeof cardOutstanding==='function'?Number(cardOutstanding()||0):0;
  const manualDebt=round2(activeManualLiabilities().reduce((total,item)=>total+Number(item.currentBalance||0),0));
  const assets=round2(cash+savings+portfolio+fgts);
  const liabilities=round2(cardDebt+manualDebt);
  const netWorth=round2(assets-liabilities);
  return {cash,savings,portfolio,fgts,cardDebt,manualDebt,assets,liabilities,netWorth};
}

function goalCurrentValue(goal,metrics=patrimonyMetrics()){
  if(goal.source==='savings')return metrics.savings;
  if(goal.source==='portfolio')return metrics.portfolio;
  if(goal.source==='fgts')return metrics.fgts;
  if(goal.source==='networth')return Math.max(0,metrics.netWorth);
  return Number(goal.currentAmount||0);
}

function goalSourceLabel(source){
  return ({manual:'Valor manual',savings:'Guardado',portfolio:'Carteira',fgts:'FGTS',networth:'Patrimônio líquido'})[source]||'Valor manual';
}

function monthsUntilDate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return 0;
  const [y,m,d]=value.split('-').map(Number);
  const now=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  const target=new Date(y,m-1,d);
  if(target<=now)return 0;
  let months=(y-now.getFullYear())*12+(m-1-now.getMonth());
  if(d>now.getDate())months++;
  return Math.max(1,months);
}

function monthKeysBetweenDates(startDate,endDate){
  const start=new Date(`${startDate}T12:00:00`),end=new Date(`${endDate}T12:00:00`);
  const keys=[];
  let cursorMonth=new Date(start.getFullYear(),start.getMonth(),1);
  const endMonth=new Date(end.getFullYear(),end.getMonth(),1);
  while(cursorMonth<=endMonth){
    keys.push(monthKey(cursorMonth));
    cursorMonth=new Date(cursorMonth.getFullYear(),cursorMonth.getMonth()+1,1);
  }
  return keys;
}

function virtualRecurringTransactions(startDate,endDate){
  const rows=[];
  for(const targetKey of monthKeysBetweenDates(startDate,endDate)){
    for(const template of state.fixedTemplates||[]){
      const start=recurringStartDate(template,targetKey,state.transactions,'templateId');
      const end=recurringEndDate(template);
      if(!start)continue;
      const date=recurrenceDateForMonth(targetKey,recurrenceAnchorDay(template));
      if(!date||date<start||(end&&date>end)||date<startDate||date>endDate)continue;
      const marker=`${template.id}:${targetKey}`;
      if(state.transactions.some(item=>item.recurringMarker===marker))continue;
      const row={kind:template.kind||'expense',amount:Number(template.amount||0),date,status:'planned',recurringMarker:marker};
      if(row.kind==='income')row.incomeType=template.incomeType||'first';
      else{row.expenseType=template.expenseType||'fixed';row.paySource=template.paySource||'cash'}
      rows.push(row);
    }
  }
  return rows;
}

function virtualRecurringSavings(startDate,endDate){
  const rows=[];
  for(const targetKey of monthKeysBetweenDates(startDate,endDate)){
    for(const template of state.savingTemplates||[]){
      const start=recurringStartDate(template,targetKey,state.savings,'savingTemplateId');
      const end=recurringEndDate(template);
      if(!start)continue;
      const date=recurrenceDateForMonth(targetKey,recurrenceAnchorDay(template));
      if(!date||date<start||(end&&date>end)||date<startDate||date>endDate)continue;
      const marker=`${template.id}:${targetKey}`;
      if(state.savings.some(item=>item.savingRecurringMarker===marker))continue;
      rows.push({type:template.type||'deposit',amount:Number(template.amount||0),date,status:'planned',savingRecurringMarker:marker});
    }
  }
  return rows;
}

function patrimonyProjection(days){
  const current=patrimonyMetrics();
  const start=new Date(today.getFullYear(),today.getMonth(),today.getDate()+1);
  const end=new Date(today.getFullYear(),today.getMonth(),today.getDate()+Number(days||0));
  const startDate=start.toISOString().slice(0,10),endDate=end.toISOString().slice(0,10);
  const tx=[...state.transactions.filter(item=>item.date>=startDate&&item.date<=endDate&&item.status==='planned'),...virtualRecurringTransactions(startDate,endDate)];
  const savings=[...state.savings.filter(item=>item.date>=startDate&&item.date<=endDate&&item.status==='planned'),...virtualRecurringSavings(startDate,endDate)];
  let cashDelta=0;
  tx.forEach(item=>{
    if(item.kind==='income'&&item.incomeType!=='flash')cashDelta+=Number(item.amount||0);
    if(item.kind==='expense'&&item.paySource==='cash')cashDelta-=Number(item.amount||0);
  });
  let savingsDelta=0;
  savings.forEach(item=>{
    const amount=Number(item.amount||0);
    if(item.type==='deposit'){savingsDelta+=amount;cashDelta-=amount}
    else{savingsDelta-=amount;cashDelta+=amount}
  });
  const cardPaid=round2(sum(tx.filter(item=>item.cardPurchaseId&&item.kind==='expense'&&item.paySource==='cash')));
  const projectedCardDebt=Math.max(0,round2(current.cardDebt-cardPaid));
  const cash=round2(current.cash+cashDelta);
  const saved=round2(current.savings+savingsDelta);
  const assets=round2(cash+saved+current.portfolio+current.fgts);
  const liabilities=round2(projectedCardDebt+current.manualDebt);
  return {days,endDate,cash,assets,liabilities,netWorth:round2(assets-liabilities),cashDelta,savingsDelta};
}

function recordNetWorthSnapshot(metrics=patrimonyMetrics()){
  if(!Array.isArray(state.netWorthSnapshots))state.netWorthSnapshots=[];
  const date=new Date().toISOString().slice(0,10);
  const snapshot={date,total:round2(metrics.netWorth),assets:round2(metrics.assets),liabilities:round2(metrics.liabilities)};
  const index=state.netWorthSnapshots.findIndex(item=>item.date===date);
  let changed=false;
  if(index>=0){
    if(JSON.stringify(state.netWorthSnapshots[index])!==JSON.stringify(snapshot)){state.netWorthSnapshots[index]=snapshot;changed=true}
  }else{state.netWorthSnapshots.push(snapshot);changed=true}
  state.netWorthSnapshots=state.netWorthSnapshots.sort((a,b)=>a.date.localeCompare(b.date)).slice(-730);
  if(changed)save({backupOld:false,cloud:false,history:false});
}

function renderPatrimonyDashboard(){
  const metrics=patrimonyMetrics();
  const set=(id,value)=>{const el=document.querySelector(id);if(el)el.textContent=value};
  set('#dashboardNetWorth',fmt.format(metrics.netWorth));
  set('#dashboardAssets',fmt.format(metrics.assets));
  set('#dashboardLiabilities',fmt.format(metrics.liabilities));
  set('#dashboardGoals',String((state.financialGoals||[]).filter(goal=>goalCurrentValue(goal,metrics)<Number(goal.targetAmount||0)).length));
}

function renderPatrimonyHistory(){
  const host=document.querySelector('#patrimonyHistoryChart');
  const count=document.querySelector('#patrimonySnapshotCount');
  if(!host)return;
  const rows=(state.netWorthSnapshots||[]).slice(-30);
  if(count)count.textContent=`${state.netWorthSnapshots?.length||0} registro${state.netWorthSnapshots?.length===1?'':'s'}`;
  if(rows.length<2){host.innerHTML='<div class="empty">Use o SaldoPlan em dias diferentes para formar a curva do patrimônio.</div>';return}
  const values=rows.map(item=>Number(item.total||0)),min=Math.min(0,...values),max=Math.max(1,...values),range=Math.max(1,max-min),w=720,h=190,pad=26;
  const coords=rows.map((item,index)=>{const x=rows.length===1?w/2:pad+index*(w-2*pad)/(rows.length-1);const y=h-pad-(Number(item.total||0)-min)/range*(h-2*pad);return [x,y]});
  const line=coords.map(point=>point.join(',')).join(' '),area=`${coords[0][0]},${h-pad} ${line} ${coords[coords.length-1][0]},${h-pad}`;
  host.innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolução do patrimônio líquido"><line class="patrimony-chart-axis" x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}"/><polygon class="patrimony-chart-area" points="${area}"/><polyline class="patrimony-chart-line" points="${line}"/><text class="patrimony-chart-label" x="${pad}" y="${h-7}">${escapeHtml(formatDate(rows[0].date))}</text><text class="patrimony-chart-label" text-anchor="end" x="${w-pad}" y="${h-7}">${escapeHtml(formatDate(rows[rows.length-1].date))}</text><text class="patrimony-chart-label" x="${pad}" y="14">${escapeHtml(fmt.format(max))}</text></svg>`;
}

function renderLiabilities(metrics){
  setMoney('patrimonyCardDebt',metrics.cardDebt);setMoney('patrimonyManualDebt',metrics.manualDebt);
  const host=document.querySelector('#liabilityList');if(!host)return;
  const rows=[...(state.liabilities||[])].sort((a,b)=>(a.status==='paid')-(b.status==='paid')||String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')));
  host.innerHTML=rows.length?rows.map(item=>`<article class="patrimony-row ${item.status==='paid'?'goal-complete':''}"><div class="patrimony-row-main"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.institution||'Instituição não informada')}${item.dueDate?` · ${formatDate(item.dueDate)}`:''}</span></div><div class="patrimony-row-side"><strong>${fmt.format(item.currentBalance||0)}</strong><span>${item.status==='paid'?'Quitada':'Em aberto'}</span></div><button type="button" class="btn ghost small" data-liability-edit="${item.id}">Editar</button></article>`).join(''):'<div class="empty">Além das faturas dos cartões, você ainda não cadastrou outras dívidas.</div>';
}

function renderGoals(metrics){
  const host=document.querySelector('#goalList');if(!host)return;
  const rows=[...(state.financialGoals||[])].sort((a,b)=>String(a.deadline||'9999').localeCompare(String(b.deadline||'9999')));
  host.innerHTML=rows.length?rows.map(goal=>{
    const current=goalCurrentValue(goal,metrics),target=Math.max(0,Number(goal.targetAmount||0)),remaining=Math.max(0,target-current),pct=target>0?Math.min(100,current/target*100):0,months=monthsUntilDate(goal.deadline),monthly=remaining>0&&months>0?remaining/months:0,complete=target>0&&current>=target;
    return `<article class="patrimony-row ${complete?'goal-complete':''}"><div class="patrimony-row-main"><strong>${escapeHtml(goal.name)}</strong><span>${escapeHtml(goalSourceLabel(goal.source))}${goal.deadline?` · até ${formatDate(goal.deadline)}`:''}</span><div class="goal-progress-track"><i style="width:${pct}%"></i></div><span>${marketNumber(pct)}% concluído${!complete&&monthly>0?` · cerca de ${fmt.format(monthly)}/mês para o prazo`:''}</span></div><div class="patrimony-row-side"><strong>${fmt.format(current)} / ${fmt.format(target)}</strong><span>${complete?'Meta alcançada':`${fmt.format(remaining)} restantes`}</span></div><button type="button" class="btn ghost small" data-goal-edit="${goal.id}">Editar</button></article>`;
  }).join(''):'<div class="empty">Crie uma meta para reserva, imóvel, viagem ou qualquer objetivo financeiro.</div>';
}

function renderPatrimony(){
  const root=document.querySelector('#view-patrimony');if(!root)return;
  const metrics=patrimonyMetrics();
  recordNetWorthSnapshot(metrics);
  setMoney('patrimonyNetWorth',metrics.netWorth);setMoney('patrimonyAssets',metrics.assets);setMoney('patrimonyLiabilities',metrics.liabilities);setMoney('patrimonyCash',metrics.cash);setMoney('patrimonySavings',metrics.savings);setMoney('patrimonyPortfolio',metrics.portfolio);setMoney('patrimonyFgts',metrics.fgts);
  const snapshots=state.netWorthSnapshots||[],previous=snapshots.length>1?snapshots[snapshots.length-2]:null,variation=previous?round2(metrics.netWorth-Number(previous.total||0)):null;
  const variationEl=document.querySelector('#patrimonyVariation');
  if(variationEl){variationEl.textContent=variation===null?'—':`${variation>=0?'+ ':''}${fmt.format(variation)}`;variationEl.classList.toggle('negative',variation!==null&&variation<0)}
  const detail=document.querySelector('#patrimonyVariationDetail');if(detail)detail.textContent=previous?`Desde ${formatDate(previous.date)}`:'Aguardando outro dia de histórico';
  const mode=state.patrimonySettings?.cashMode==='manual'?'manual':'auto';document.querySelector('#patrimonyCashMode').value=mode;document.querySelector('#patrimonyManualCash').value=Number(state.patrimonySettings?.manualCash||0).toFixed(2).replace('.',',');document.querySelector('#patrimonyManualCashWrap').classList.toggle('hidden',mode!=='manual');document.querySelector('#patrimonyCashStatus').textContent=mode==='manual'?'Manual':'Automático';document.querySelector('#patrimonyCashHint').textContent=mode==='manual'?'Saldo bancário informado manualmente':'Saldo realizado da competência atual';
  document.querySelector('#patrimonyProjection').innerHTML=[30,60,90].map(days=>{const p=patrimonyProjection(days);return `<article class="patrimony-projection-card"><span>Em ${days} dias · ${formatDate(p.endDate)}</span><strong class="${p.netWorth<0?'negative':''}">${fmt.format(p.netWorth)}</strong><small>Caixa ${fmt.format(p.cash)} · Ativos ${fmt.format(p.assets)} · Dívidas ${fmt.format(p.liabilities)}</small></article>`}).join('');
  renderLiabilities(metrics);renderGoals(metrics);renderPatrimonyHistory();renderPatrimonyDashboard();
}

const liabilityDialog=document.querySelector('#liabilityDialog'),liabilityForm=document.querySelector('#liabilityForm');
function openLiability(item=null){liabilityForm.reset();document.querySelector('#liabilityId').value=item?.id||'';document.querySelector('#liabilityFormTitle').textContent=item?'Editar dívida':'Nova dívida';document.querySelector('#liabilityName').value=item?.name||'';document.querySelector('#liabilityInstitution').value=item?.institution||'';document.querySelector('#liabilityType').value=item?.type||'loan';document.querySelector('#liabilityBalance').value=item?Number(item.currentBalance||0).toFixed(2).replace('.',','):'';document.querySelector('#liabilityDueDate').value=item?.dueDate||'';document.querySelector('#liabilityStatus').value=item?.status||'active';document.querySelector('#liabilityNotes').value=item?.notes||'';document.querySelector('#deleteLiability').classList.toggle('hidden',!item);liabilityDialog.showModal()}
document.querySelector('#newLiabilityBtn')?.addEventListener('click',()=>openLiability());document.querySelector('#closeLiabilityDialog')?.addEventListener('click',()=>liabilityDialog.close());document.querySelector('#cancelLiability')?.addEventListener('click',()=>liabilityDialog.close());
liabilityForm?.addEventListener('submit',event=>{event.preventDefault();const id=document.querySelector('#liabilityId').value,obj={id:id||uid(),name:document.querySelector('#liabilityName').value.trim(),institution:document.querySelector('#liabilityInstitution').value.trim(),type:document.querySelector('#liabilityType').value,currentBalance:money(document.querySelector('#liabilityBalance').value),dueDate:document.querySelector('#liabilityDueDate').value,status:document.querySelector('#liabilityStatus').value,notes:document.querySelector('#liabilityNotes').value.trim()};if(!obj.name||obj.currentBalance<0)return;const index=state.liabilities.findIndex(item=>item.id===id);if(index>=0)state.liabilities[index]=obj;else state.liabilities.push(obj);save();liabilityDialog.close();renderAll()});
document.querySelector('#deleteLiability')?.addEventListener('click',()=>{const id=document.querySelector('#liabilityId').value;if(!id||!confirm('Excluir esta dívida?'))return;state.liabilities=state.liabilities.filter(item=>item.id!==id);save();liabilityDialog.close();renderAll()});

const goalDialog=document.querySelector('#goalDialog'),goalForm=document.querySelector('#goalForm');
function syncGoalCurrentVisibility(){document.querySelector('#goalCurrentWrap')?.classList.toggle('hidden',document.querySelector('#goalSource')?.value!=='manual')}
function openGoal(goal=null){goalForm.reset();document.querySelector('#goalId').value=goal?.id||'';document.querySelector('#goalFormTitle').textContent=goal?'Editar meta':'Nova meta';document.querySelector('#goalName').value=goal?.name||'';document.querySelector('#goalTarget').value=goal?Number(goal.targetAmount||0).toFixed(2).replace('.',','):'';document.querySelector('#goalDeadline').value=goal?.deadline||'';document.querySelector('#goalSource').value=goal?.source||'manual';document.querySelector('#goalCurrent').value=goal?Number(goal.currentAmount||0).toFixed(2).replace('.',','):'';document.querySelector('#goalNotes').value=goal?.notes||'';document.querySelector('#deleteGoal').classList.toggle('hidden',!goal);syncGoalCurrentVisibility();goalDialog.showModal()}
document.querySelector('#newGoalBtn')?.addEventListener('click',()=>openGoal());document.querySelector('#closeGoalDialog')?.addEventListener('click',()=>goalDialog.close());document.querySelector('#cancelGoal')?.addEventListener('click',()=>goalDialog.close());document.querySelector('#goalSource')?.addEventListener('change',syncGoalCurrentVisibility);
goalForm?.addEventListener('submit',event=>{event.preventDefault();const id=document.querySelector('#goalId').value,obj={id:id||uid(),name:document.querySelector('#goalName').value.trim(),targetAmount:money(document.querySelector('#goalTarget').value),currentAmount:money(document.querySelector('#goalCurrent').value),source:document.querySelector('#goalSource').value,deadline:document.querySelector('#goalDeadline').value,notes:document.querySelector('#goalNotes').value.trim()};if(!obj.name||obj.targetAmount<=0)return;const index=state.financialGoals.findIndex(item=>item.id===id);if(index>=0)state.financialGoals[index]=obj;else state.financialGoals.push(obj);save();goalDialog.close();renderAll()});
document.querySelector('#deleteGoal')?.addEventListener('click',()=>{const id=document.querySelector('#goalId').value;if(!id||!confirm('Excluir esta meta financeira?'))return;state.financialGoals=state.financialGoals.filter(item=>item.id!==id);save();goalDialog.close();renderAll()});

document.querySelector('#patrimonyCashMode')?.addEventListener('change',()=>{document.querySelector('#patrimonyManualCashWrap').classList.toggle('hidden',document.querySelector('#patrimonyCashMode').value!=='manual')});
document.querySelector('#savePatrimonyCash')?.addEventListener('click',()=>{state.patrimonySettings={cashMode:document.querySelector('#patrimonyCashMode').value==='manual'?'manual':'auto',manualCash:money(document.querySelector('#patrimonyManualCash').value)};save();renderAll()});

document.querySelector('#view-patrimony')?.addEventListener('click',event=>{const liability=event.target.closest('[data-liability-edit]');if(liability){openLiability(state.liabilities.find(item=>item.id===liability.dataset.liabilityEdit));return}const goal=event.target.closest('[data-goal-edit]');if(goal){openGoal(state.financialGoals.find(item=>item.id===goal.dataset.goalEdit));}});
