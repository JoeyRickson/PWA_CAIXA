const STORAGE_KEY='meuCaixa.v1'; // Mantido de propósito para preservar os dados da versão anterior.
const PREVIOUS_KEY='meuCaixa.previousBackup.v2';
const MONTHS=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const NATIONAL_HOLIDAYS={
  2026:['2026-01-01','2026-04-03','2026-04-21','2026-05-01','2026-09-07','2026-10-12','2026-11-02','2026-11-15','2026-11-20','2026-12-25']
};
const AMAZONAS_HOLIDAYS={2026:['2026-09-05']};
const MANAUS_HOLIDAYS={2026:['2026-02-17','2026-06-04','2026-10-24','2026-12-08']};
const fmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const money=v=>{
  let s=String(v??'').trim().replace(/\s/g,'').replace(/R\$/gi,'').replace(/[^0-9,.-]/g,'');
  if(!s)return 0;
  const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
  if(comma>=0&&dot>=0){
    if(comma>dot)s=s.replace(/\./g,'').replace(',','.');
    else s=s.replace(/,/g,'');
  }else if(comma>=0){
    s=s.replace(/\./g,'').replace(',','.');
  }else if(dot>=0){
    const decimals=s.length-dot-1;
    if((s.match(/\./g)||[]).length>1||decimals>2)s=s.replace(/\./g,'');
  }
  const n=Number(s);
  return Number.isFinite(n)?n:0;
};
const decimal=v=>Number(String(v??0).trim().replace(',','.'))||0;
const round2=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const trunc2=n=>Math.floor((Number(n)+1e-9)*100)/100;
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const today=new Date();
let cursor=new Date(today.getFullYear(),today.getMonth(),1);
let simCursor=new Date(today.getFullYear(),today.getMonth(),1);
let filter='all';
let deferredPrompt=null;
let driveToken=null;
let cloudToken=null;
let cloudTimer=null;

const seed={
  version:2,
  savingGoal:500,
  importNote:true,
  settings:{theme:'light',bonusEnabled:true,bonusName:'Bônus'},
  cloud:{provider:'google',emailHint:'',clientId:'',account:'',providerClientId:'',folderName:'SaldoPlan - Backups',folderId:'',autoBackup:false,retentionDays:30,lastBackupAt:null,lastFileId:null},
  payrollConfig:{baseSalary:5000,monthlyHours:220,advance:2000,nightPct:20,extraGoal:40},
  payrollMonths:{},
  fixedTemplates:[],
  savings:[],
  overtimeLogs:[],
  transactions:[
    {id:uid(),kind:'income',incomeType:'first',description:'Salário - quinzena',amount:2000,date:'2026-09-15',status:'realized'},
    {id:uid(),kind:'income',incomeType:'second',description:'Salário - final do mês',amount:3839,date:'2026-09-30',status:'planned'},
    {id:uid(),kind:'income',incomeType:'flash',description:'Crédito Flash',amount:441,date:'2026-09-01',status:'realized'},
    {id:uid(),kind:'expense',expenseType:'fixed',paySource:'cash',category:'Moradia',description:'Apartamento Mosaico',amount:1500,date:'2026-09-15',status:'realized'},
    {id:uid(),kind:'expense',expenseType:'variable',paySource:'cash',category:'Outros',description:'Bemol - fatura',amount:37.98,date:'2026-09-24',status:'planned'},
    {id:uid(),kind:'expense',expenseType:'variable',paySource:'cash',category:'Outros',description:'Bemol - fatura',amount:64.76,date:'2026-09-25',status:'planned'},
    {id:uid(),kind:'expense',expenseType:'variable',paySource:'cash',category:'Outros',description:'Bemol - fatura',amount:328.35,date:'2026-09-25',status:'planned'},
    {id:uid(),kind:'expense',expenseType:'variable',paySource:'cash',category:'Outros',description:'Bemol - fatura',amount:27.80,date:'2026-09-16',status:'realized'},
    {id:uid(),kind:'expense',expenseType:'fixed',paySource:'cash',category:'Educação',description:'Nyl cartão',amount:300,date:'2026-09-20',status:'planned'},
    {id:uid(),kind:'expense',expenseType:'fixed',paySource:'cash',category:'Internet',description:'Claro - internet residencial',amount:160,date:'2026-09-25',status:'planned'},
    {id:uid(),kind:'expense',expenseType:'unplanned',paySource:'cash',category:'Outros',description:'Empréstimo mercado',amount:135.49,date:'2026-09-20',status:'planned'},
    {id:uid(),kind:'expense',expenseType:'fixed',paySource:'cash',category:'Internet',description:'Claro - internet móvel',amount:2.10,date:'2026-09-15',status:'realized'},
    {id:uid(),kind:'expense',expenseType:'variable',paySource:'cash',category:'Cartão',description:'Bradesco - pagamento boleto',amount:2000,date:'2026-09-20',status:'planned'},
    {id:uid(),kind:'expense',expenseType:'fixed',paySource:'cash',category:'Assinaturas',description:'Gran Cursos',amount:54.90,date:'2026-09-20',status:'planned'}
  ]
};

function deepClone(x){return JSON.parse(JSON.stringify(x))}
function migrateState(raw){
  const base=deepClone(seed);
  if(!raw||typeof raw!=='object')return base;
  const migrated={...base,...raw};
  migrated.version=2;
  migrated.settings={...base.settings,...(raw.settings||{})};
  migrated.cloud={...base.cloud,...(raw.cloud||{})};
  if(migrated.cloud.folderName==='Meu Caixa - Backups')migrated.cloud.folderName='SaldoPlan - Backups';
  migrated.payrollConfig={...base.payrollConfig,...(raw.payrollConfig||{})};
  migrated.payrollMonths=(raw.payrollMonths&&typeof raw.payrollMonths==='object')?raw.payrollMonths:{};
  migrated.transactions=Array.isArray(raw.transactions)?raw.transactions:base.transactions;
  migrated.transactions=migrated.transactions.map(x=>x.description==='Crédito Flash'?{...x,description:migrated.settings.bonusName||'Bônus'}:x);
  migrated.fixedTemplates=Array.isArray(raw.fixedTemplates)?raw.fixedTemplates:[];
  migrated.savings=Array.isArray(raw.savings)?raw.savings:[];
  migrated.overtimeLogs=Array.isArray(raw.overtimeLogs)?raw.overtimeLogs:[];
  if(typeof migrated.savingGoal!=='number')migrated.savingGoal=money(migrated.savingGoal)||500;
  return migrated;
}
function load(){
  try{
    const text=localStorage.getItem(STORAGE_KEY);
    if(!text)return deepClone(seed);
    return migrateState(JSON.parse(text));
  }catch{return deepClone(seed)}
}
let state=load();
const hadExisting=!!localStorage.getItem(STORAGE_KEY);
if(hadExisting&&state.version===2){
  // Se veio da versão antiga, a migração já aconteceu em memória; apenas consolida sem apagar o conteúdo anterior.
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}else if(!hadExisting){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}

function save({backupOld=true,cloud=true}={}){
  try{
    if(backupOld){const old=localStorage.getItem(STORAGE_KEY);if(old)localStorage.setItem(PREVIOUS_KEY,old)}
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    localStorage.setItem(`${STORAGE_KEY}.savedAt`,new Date().toISOString());
    if(cloud&&state.cloud?.autoBackup&&(driveToken||cloudToken))scheduleCloudBackup();
  }catch(e){console.error(e)}
}
function updateLocalSaveStatus(){const el=document.querySelector('#localSaveStatus');if(!el)return;const savedAt=localStorage.getItem(`${STORAGE_KEY}.savedAt`);el.textContent=savedAt?`Última gravação neste aparelho: ${new Date(savedAt).toLocaleString('pt-BR')}.`:'As alterações também são salvas automaticamente ao usar o app.'}
function scheduleCloudBackup(){clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>backupToDrive(true).catch(()=>{}),1800)}
function key(){return monthKey(cursor)}
function simKey(){return monthKey(simCursor)}
// Define em qual folha a hora extra será paga.
// Regra:
// dia 01 até 09 = folha do próprio mês
// dia 10 em diante = folha do mês seguinte
const PAYROLL_CUTOFF_DAY = 10;

function payrollCompetenceKey(dateStr) {
  if (!dateStr) return '';

  const [year, month, day] = dateStr.split('-').map(Number);

  if (!year || !month || !day) return '';

  // Do dia 10 em diante -> próxima competência
  if (day >= PAYROLL_CUTOFF_DAY) {
    // month já está 1 acima do índice do JS,
    // então aqui automaticamente avançamos um mês.
    const nextMonth = new Date(year, month, 1);

    return monthKey(nextMonth);
  }

  // Dias 01 a 09 permanecem na competência atual
  return `${year}-${String(month).padStart(2, '0')}`;
}
function inMonth(t,k=key()){return t.date?.slice(0,7)===k}
function sum(arr){return arr.reduce((s,x)=>s+Number(x.amount||0),0)}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function formatDate(s){if(!s)return'';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`}
function setMoney(id,v){const el=document.getElementById(id);if(!el)return;el.textContent=fmt.format(v);el.classList.toggle('negative',v<0)}
function hoursLabel(decimalHours){
  const mins=Math.max(0,Math.round(Number(decimalHours||0)*60));
  return `${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')}`;
}

function ensureRecurring(){
  const targetKey=key();
  const [y,m]=targetKey.split('-').map(Number);
  let changed=false;
  state.fixedTemplates.forEach(t=>{
    const marker=`${t.id}:${targetKey}`;
    if(state.transactions.some(x=>x.recurringMarker===marker))return;
    const day=Math.min(t.dueDay||1,new Date(y,m,0).getDate());
    const obj={id:uid(),kind:t.kind||'expense',description:t.description,amount:t.amount,date:`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,status:'planned',recurringMarker:marker,templateId:t.id};
    if(obj.kind==='income')obj.incomeType=t.incomeType||'first';
    else{obj.expenseType=t.expenseType||'fixed';obj.paySource=t.paySource||'cash';obj.category=t.category||'Outros'}
    state.transactions.push(obj);
    changed=true;
  });
  if(changed)save();
}
function transactions(){ensureRecurring();return state.transactions.filter(x=>inMonth(x)).sort((a,b)=>a.date.localeCompare(b.date))}
function metrics(){
  const tx=transactions(),inc=tx.filter(x=>x.kind==='income'),exp=tx.filter(x=>x.kind==='expense');
  const cashIncReal=sum(inc.filter(x=>x.incomeType!=='flash'&&x.status==='realized'));
  const cashIncAll=sum(inc.filter(x=>x.incomeType!=='flash'));
  const flashIncReal=sum(inc.filter(x=>x.incomeType==='flash'&&x.status==='realized'));
  const flashIncAll=sum(inc.filter(x=>x.incomeType==='flash'));
  const cashExpReal=sum(exp.filter(x=>x.paySource==='cash'&&x.status==='realized'));
  const cashExpAll=sum(exp.filter(x=>x.paySource==='cash'));
  const flashExpReal=sum(exp.filter(x=>x.paySource==='flash'&&x.status==='realized'));
  const flashExpAll=sum(exp.filter(x=>x.paySource==='flash'));
  return {tx,inc,exp,cashNow:cashIncReal-cashExpReal,cashProjected:cashIncAll-cashExpAll,flashNow:flashIncReal-flashExpReal,flashProjected:flashIncAll-flashExpAll};
}


function transactionDay(x){return Number(String(x?.date||'').slice(8,10))||0}
function cycleWindow(kind){
  const tx=transactions(),isFirst=kind==='first',startDay=isFirst?10:20,[year,month]=key().split('-').map(Number),endDay=isFirst?18:new Date(year,month,0).getDate();
  const salaryIncomes=tx.filter(x=>x.kind==='income'&&x.incomeType===kind);
  const extraItems=tx.filter(x=>x.kind==='income'&&x.incomeType==='extra'&&transactionDay(x)>=startDay&&transactionDay(x)<=endDay);
  const includedExtraItems=extraItems.filter(x=>x.cycleInclude===true);
  const incomes=[...salaryIncomes,...includedExtraItems],expenses=tx.filter(x=>x.kind==='expense'&&x.paySource==='cash'&&transactionDay(x)>=startDay&&transactionDay(x)<=endDay);
  const receivedItems=incomes.filter(x=>x.status==='realized'),plannedIncomeItems=incomes.filter(x=>x.status==='planned'),paidItems=expenses.filter(x=>x.status==='realized'),plannedExpenseItems=expenses.filter(x=>x.status==='planned');
  const received=sum(receivedItems),plannedIncome=sum(plannedIncomeItems),paid=sum(paidItems),plannedExpense=sum(plannedExpenseItems),incomeTotal=received+plannedIncome,expenseTotal=paid+plannedExpense;
  const hasReceived=received>0,actualLeft=hasReceived?round2(received-paid):0,projectedLeft=round2(incomeTotal-expenseTotal);
  const salaryReceivedItems=salaryIncomes.filter(x=>x.status==='realized'),salaryPlannedItems=salaryIncomes.filter(x=>x.status==='planned');
  const incomeDates=[...salaryReceivedItems].sort((a,b)=>a.date.localeCompare(b.date)).map(x=>x.date),plannedDates=[...salaryPlannedItems].sort((a,b)=>a.date.localeCompare(b.date)).map(x=>x.date);
  return {kind,title:isFirst?'Quinzena':'Final do mês',startDay,endDay,received,plannedIncome,paid,plannedExpense,incomeTotal,expenseTotal,hasReceived,actualLeft,projectedLeft,receivedItems,plannedIncomeItems,paidItems,plannedExpenseItems,incomeDates,plannedDates,extraItems,includedExtraItems};
}
function cycleStatus(c){return c.hasReceived?{text:'Recebido',ok:true}:c.plannedIncome>0?{text:'Previsto',ok:false}:{text:'Sem entrada',ok:false}}
function cycleDateText(c){
  if(c.incomeDates.length)return `Recebido em ${c.incomeDates.map(formatDate).join(', ')}`;
  if(c.plannedDates.length)return `Previsto para ${c.plannedDates.map(formatDate).join(', ')}`;
  return 'Nenhuma entrada registrada neste mês';
}
function cycleExpenseListHtml(items){
  if(!items.length)return '<div class="empty">Nenhum gasto pago neste ciclo.</div>';
  return items.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(itemHtml).join('');
}
function cycleExtraListHtml(items){
  if(!items.length)return '<div class="empty">Nenhuma entrada extra registrada neste período.</div>';
  return items.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>{
    const included=x.cycleInclude===true,status=x.status==='planned'?'Previsto':'Realizado';
    return `<div class="cycle-extra-item">
      <div class="cycle-extra-copy">
        <strong>${escapeHtml(x.description||'Entrada extra')}</strong>
        <span>${formatDate(x.date)} · ${status} · ${fmt.format(x.amount)}</span>
      </div>
      <button type="button" class="cycle-extra-toggle ${included?'active':''}" data-cycle-extra-toggle="${x.id}" aria-pressed="${included?'true':'false'}">${included?'Considerando':'Ignorado'}</button>
    </div>`;
  }).join('');
}
function cycleCardHtml(c){
  const status=cycleStatus(c),balanceText=c.hasReceived?fmt.format(c.actualLeft):'Aguardando entrada',balanceClass=c.hasReceived&&c.actualLeft<0?'negative':'',hasProjection=c.plannedIncome>0||c.plannedExpense>0;
  return `
    <div class="section-head cycle-title-row">
      <div><span class="muted">Dias ${String(c.startDay).padStart(2,'0')}–${String(c.endDay).padStart(2,'0')}</span><h3>${c.title}</h3></div>
      <span class="status-pill ${status.ok?'ok':''}">${status.text}</span>
    </div>
    <p class="helper cycle-income-date">${escapeHtml(cycleDateText(c))}</p>
    <div class="cycle-balance-box">
      <span>Sobra do ciclo</span>
      <strong class="${balanceClass}">${balanceText}</strong>
      <small>${c.hasReceived?'Entrada recebida − gastos pagos':'A sobra aparece quando a entrada for realizada'}</small>
    </div>
    <div class="cycle-stats">
      <div class="mini-stat"><span>Entrada recebida</span><strong>${fmt.format(c.received)}</strong></div>
      <div class="mini-stat"><span>Pago / gasto</span><strong>${fmt.format(c.paid)}</strong></div>
      <div class="mini-stat"><span>A pagar no ciclo</span><strong>${fmt.format(c.plannedExpense)}</strong></div>
      <div class="mini-stat"><span>Entrada prevista</span><strong>${fmt.format(c.plannedIncome)}</strong></div>
    </div>
    ${hasProjection?`<div class="cycle-projection"><span>Projeção após previstos</span><strong class="${c.projectedLeft<0?'negative':''}">${fmt.format(c.projectedLeft)}</strong></div>`:''}
    <details class="cycle-details cycle-extra-organizer">
      <summary>Organizar extras (${c.includedExtraItems.length}/${c.extraItems.length} considerados)</summary>
      <p class="helper small-text">Extras entram neste ciclo pela data do lançamento. Marque apenas os valores que devem compor a sobra.</p>
      <div class="cycle-extra-list">${cycleExtraListHtml(c.extraItems)}</div>
    </details>
    <details class="cycle-details">
      <summary>Ver gastos pagos (${c.paidItems.length})</summary>
      <div class="list">${cycleExpenseListHtml(c.paidItems)}</div>
    </details>`;
}
function renderCycles(){
  const first=cycleWindow('first'),second=cycleWindow('second'),totalActual=round2(first.actualLeft+second.actualLeft),totalPaid=round2(first.paid+second.paid),totalProjected=round2(first.projectedLeft+second.projectedLeft),receivedTotal=round2(first.received+second.received);
  const label=document.querySelector('#cycleMonthLabel');if(!label)return;
  label.textContent=`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  document.querySelector('#cycleFirstCard').innerHTML=cycleCardHtml(first);
  document.querySelector('#cycleSecondCard').innerHTML=cycleCardHtml(second);
  document.querySelector('#cycleTotalCard').innerHTML=`
    <div class="section-head"><div><span class="muted">Resumo dos dois ciclos</span><h3>Sobra total do mês</h3></div><span class="cycle-total-badge">${first.hasReceived&&second.hasReceived?'Fechado':'Parcial'}</span></div>
    <div class="cycle-total-value ${totalActual<0?'negative':''}">${fmt.format(totalActual)}</div>
    <p class="helper">Soma das sobras já realizadas da quinzena e do pagamento final.</p>
    <div class="cycle-total-grid">
      <div><span>Entradas recebidas</span><strong>${fmt.format(receivedTotal)}</strong></div>
      <div><span>Total pago nos ciclos</span><strong>${fmt.format(totalPaid)}</strong></div>
      <div><span>Sobra da quinzena</span><strong class="${first.actualLeft<0?'negative':''}">${first.hasReceived?fmt.format(first.actualLeft):'—'}</strong></div>
      <div><span>Sobra do final</span><strong class="${second.actualLeft<0?'negative':''}">${second.hasReceived?fmt.format(second.actualLeft):'—'}</strong></div>
    </div>
    <div class="cycle-projection total"><span>Projeção considerando entradas e gastos previstos dos dois ciclos</span><strong class="${totalProjected<0?'negative':''}">${fmt.format(totalProjected)}</strong></div>
    <p class="helper small-text cycle-note">Entradas extras dos períodos 10–18 e 20–fim do mês entram somente quando marcadas como “Considerando”. Bônus/Flash, gastos pagos com bônus, dias 01–09 e dia 19 continuam fora do cálculo.</p>`;
}
function savingsMetrics(k=key()){
  const all=[...state.savings].sort((a,b)=>a.date.localeCompare(b.date));
  const deposits=sum(all.filter(x=>x.type==='deposit'));
  const withdrawals=sum(all.filter(x=>x.type==='withdrawal'));
  const month=all.filter(x=>inMonth(x,k));
  const monthDeposits=sum(month.filter(x=>x.type==='deposit'));
  const monthWithdrawals=sum(month.filter(x=>x.type==='withdrawal'));
  return {all,balance:deposits-withdrawals,monthDeposits,monthWithdrawals,monthNet:monthDeposits-monthWithdrawals};
}

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
function renderTransactions(){let tx=transactions();if(filter==='income')tx=tx.filter(x=>x.kind==='income');if(filter==='expense')tx=tx.filter(x=>x.kind==='expense');if(filter==='pending')tx=tx.filter(x=>x.status==='planned');document.querySelector('#transactionList').innerHTML=tx.length?tx.map(itemHtml).join(''):'<div class="empty">Nada por aqui.</div>'}
function renderFixed(){const fixeds=state.fixedTemplates.filter(t=>(t.kind||'expense')==='expense');document.querySelector('#fixedList').innerHTML=fixeds.length?fixeds.map(t=>`<button class="item" data-template="${t.id}" style="width:100%;text-align:left;cursor:pointer"><span class="item-icon">↻</span><span class="item-main"><strong>${escapeHtml(t.description)}</strong><span>Dia ${t.dueDay} · ${escapeHtml(t.category||'Sem categoria')} · ${t.paySource==='flash'?bonusLabel():'Salário / conta'}</span></span><span class="item-side"><strong>${fmt.format(t.amount)}</strong><span>Todo mês</span></span></button>`).join(''):'<div class="empty">Nenhum gasto fixo automático.</div>'}

function renderSavings(){
  const s=savingsMetrics();setMoney('savingBalance',s.balance);setMoney('savingDepositsMonth',s.monthDeposits);setMoney('savingWithdrawalsMonth',s.monthWithdrawals);setMoney('savingNetMonth',s.monthNet);
  const list=[...state.savings].sort((a,b)=>b.date.localeCompare(a.date));
  document.querySelector('#savingList').innerHTML=list.length?list.map(x=>`<button class="item" data-saving-edit="${x.id}" style="width:100%;text-align:left;cursor:pointer"><span class="item-icon saving">${x.type==='deposit'?'+':'−'}</span><span class="item-main"><strong>${escapeHtml(x.description)}</strong><span>${formatDate(x.date)} · ${escapeHtml(x.account||'Sem conta')}</span></span><span class="item-side"><strong class="${x.type==='deposit'?'positive':'negative'}">${x.type==='deposit'?'+ ':'− '}${fmt.format(x.amount)}</strong><span>${x.type==='deposit'?'Aporte':'Retirada'}</span></span></button>`).join(''):'<div class="empty">Você ainda não registrou valores guardados.</div>';
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

function timeToMinutes(t){if(!t)return null;const [h,m]=t.split(':').map(Number);return h*60+m}
function overlap(a1,a2,b1,b2){return Math.max(0,Math.min(a2,b2)-Math.max(a1,b1))}
function calculateExtraRecord(r){
  let start=timeToMinutes(r.start),end=timeToMinutes(r.end);if(start===null||end===null)return {minutes:0,nightMinutes:0,hours50:0,hours100:0};
  if(end<=start)end+=1440;
  let lunchStart=null,lunchEnd=null,lunchMinutes=0;
  if(r.deductLunch&&r.lunchStart&&r.lunchEnd){lunchStart=timeToMinutes(r.lunchStart);lunchEnd=timeToMinutes(r.lunchEnd);if(lunchEnd<=lunchStart)lunchEnd+=1440;while(lunchStart<start){lunchStart+=1440;lunchEnd+=1440}lunchMinutes=overlap(start,end,lunchStart,lunchEnd)}
  const total=Math.max(0,end-start-lunchMinutes);
  const windows=[[0,300],[1320,1440],[1440,1740],[2760,3180]];
  let night=windows.reduce((s,[a,b])=>s+overlap(start,end,a,b),0);
  if(lunchStart!==null)night-=windows.reduce((s,[a,b])=>s+overlap(lunchStart,lunchEnd,a,b),0);
  night=Math.max(0,night);
  const d=new Date(`${r.date}T12:00:00`);const is100=!!r.holiday||d.getDay()===0;
  return {minutes:total,nightMinutes:night,hours50:is100?0:total/60,hours100:is100?total/60:0,nightHours:night/60,is100};
}
function getAllHolidays(year){return new Set([...(NATIONAL_HOLIDAYS[year]||[]),...(AMAZONAS_HOLIDAYS[year]||[]),...(MANAUS_HOLIDAYS[year]||[])]);}
function getDSRCalendar(monthKeyValue){
  const [year,month]=monthKeyValue.split('-').map(Number);
  const totalDays=new Date(year,month,0).getDate();
  let sundays=0;
  for(let day=1;day<=totalDays;day++){
    const date=new Date(year,month-1,day);
    if(date.getDay()===0)sundays++;
  }
  const restDays=sundays;
  const workingDays=totalDays-sundays;
  return {totalDays,sundays,holidays:0,restDays,workingDays};
}
function inss2026(base){
  const brackets=[[1621,0.075],[2902.84,0.09],[4354.27,0.12],[8475.55,0.14]];
  let prev=0,total=0;
  for(const [upper,rate] of brackets){
    const part=Math.max(0,Math.min(base,upper)-prev);
    total+=trunc2(part*rate);
    prev=upper;
    if(base<=upper)break;
  }
  return round2(total);
}
function irrf2026(gross,inss){
  const simplified=607.20;const deduction=Math.max(inss,simplified);const base=Math.max(0,gross-deduction);let before=0;
  if(base<=2428.80)before=0;else if(base<=2826.65)before=base*.075-182.16;else if(base<=3751.05)before=base*.15-394.16;else if(base<=4664.68)before=base*.225-675.49;else before=base*.275-908.73;
  before=Math.max(0,round2(before));let reduction=0;
  if(gross<=5000)reduction=Math.min(before,312.89);else if(gross<=7350)reduction=Math.max(0,round2(978.62-0.133145*gross));
  reduction=Math.min(before,reduction);return {base:round2(base),before,reduction:round2(reduction),value:round2(Math.max(0,before-reduction)),deductionUsed:round2(deduction)};
}
function payrollMonthConfig(k=simKey()){if(!state.payrollMonths[k])state.payrollMonths[k]={holidayCount:0,referenceHours:null};return state.payrollMonths[k]}
function payrollSimulation(){
  const cfg = state.payrollConfig,
      k = simKey(),
      monthCfg = payrollMonthConfig(k);

const logs = state.overtimeLogs.filter(
  x => payrollCompetenceKey(x.date) === k
);
  let h50=0,h100=0,night=0;
  logs.forEach(r=>{const c=calculateExtraRecord(r);h50+=c.hours50;h100+=c.hours100;night+=c.nightHours});
  if(monthCfg.referenceHours&&logs.length===0){h50=Number(monthCfg.referenceHours.h50||0);h100=Number(monthCfg.referenceHours.h100||0);night=Number(monthCfg.referenceHours.night||0)}
  const hourBase=Number(cfg.baseSalary||0)/Math.max(1,Number(cfg.monthlyHours||220));
  const v50=round2(h50*hourBase*1.5),v100=round2(h100*hourBase*2),nightValue=round2(night*hourBase*(Number(cfg.nightPct||20)/100));
  const extraBase=round2(v50+v100+nightValue),calendar=getDSRCalendar(k),restDays=calendar.sundays,workDays=Math.max(1,calendar.totalDays-calendar.sundays),dsr=round2(extraBase/workDays*restDays);
  const extras=round2(extraBase+dsr),gross=round2(Number(cfg.baseSalary||0)+extras),inss=inss2026(gross),ir=irrf2026(gross,inss),netMonth=round2(gross-inss-ir.value),advance=round2(Number(cfg.advance||0)),finalPay=round2(netMonth-advance);
  return {k,h50,h100,night,hourBase,v50,v100,nightValue,extraBase,sundays:calendar.sundays,holidays:0,automaticHolidays:0,manualHolidays:0,restDays,workDays,dsr,extras,gross,inss,ir,netMonth,advance,finalPay,logs,reference:monthCfg.referenceHours&&logs.length===0};
}
function renderSimulator(){
  const referenceButton=document.querySelector('#loadJulyReference');if(referenceButton)referenceButton.textContent='Referência set/26';
  document.querySelector('#simMonthLabel').textContent=`${MONTHS[simCursor.getMonth()]} ${simCursor.getFullYear()}`;
  const cfg=state.payrollConfig,monthCfg=payrollMonthConfig();document.querySelector('#simBaseSalary').value=Number(cfg.baseSalary).toFixed(2).replace('.',',');document.querySelector('#simMonthlyHours').value=cfg.monthlyHours;document.querySelector('#simAdvance').value=Number(cfg.advance).toFixed(2).replace('.',',');document.querySelector('#simHolidayCount').value=monthCfg.holidayCount||0;document.querySelector('#simNightPct').value=cfg.nightPct;document.querySelector('#simExtraGoal').value=cfg.extraGoal||0;
  const p=payrollSimulation();document.querySelector('#simHours50').textContent=hoursLabel(p.h50);document.querySelector('#simValue50').textContent=fmt.format(p.v50);document.querySelector('#simHours100').textContent=hoursLabel(p.h100);document.querySelector('#simValue100').textContent=fmt.format(p.v100);document.querySelector('#simNightHours').textContent=hoursLabel(p.night);document.querySelector('#simNightValue').textContent=fmt.format(p.nightValue);setMoney('simDsrValue',p.dsr);document.querySelector('#simDsrDetail').textContent=`${p.restDays} DSR / ${p.workDays} dias no divisor`;
  setMoney('payBase',state.payrollConfig.baseSalary);setMoney('payExtras',p.extras);setMoney('payGross',p.gross);document.querySelector('#payInss').textContent=`− ${fmt.format(p.inss)}`;document.querySelector('#payIrrf').textContent=`− ${fmt.format(p.ir.value)}`;setMoney('payNetMonth',p.netMonth);document.querySelector('#payAdvance').textContent=`− ${fmt.format(p.advance)}`;setMoney('payFinal',p.finalPay);
  document.querySelector('#payrollReferenceNote').textContent=p.reference?'Referência de setembro/2026 carregada: 60h00 de HE 50%, 0h00 de HE 100% e 6h00 de adicional noturno. A calibração reproduz o holerite de setembro.':'INSS e IRRF usam as tabelas de 2026; o DSR da simulação segue o padrão observado no holerite de setembro, usando os domingos do mês.';
  const records=[...p.logs].sort((a,b)=>b.date.localeCompare(a.date));
  let refHtml='';if(p.reference)refHtml=`<div class="item"><span class="item-icon">✓</span><span class="item-main"><strong>Referência do contracheque — setembro/2026</strong><span>60h00 HE50 · 0h00 HE100 · 6h00 noturno</span></span><span class="item-side"><strong>${fmt.format(p.extras)}</strong><span>Calibração</span></span></div>`;
  document.querySelector('#extraList').innerHTML=refHtml+(records.length?records.map(r=>{const c=calculateExtraRecord(r);return `<button class="item" data-extra-edit="${r.id}" style="width:100%;text-align:left;cursor:pointer"><span class="item-icon">⌁</span><span class="item-main"><strong>${escapeHtml(r.description)}</strong><span>${formatDate(r.date)} · ${r.start}–${r.end}${r.holiday?' · HE 100%':''}</span></span><span class="item-side"><strong>${hoursLabel(c.minutes/60)}</strong><span>${c.is100?'100%':'50%'}${c.nightHours?` · ${hoursLabel(c.nightHours)} not.`:''}</span></span></button>`}).join(''):'');
  if(!p.reference&&!records.length)document.querySelector('#extraList').innerHTML='<div class="empty">Nenhuma hora extra registrada nesta competência.</div>';
}

function renderData(){
  document.querySelector('#savingGoal').value=(state.savingGoal||0).toFixed(2).replace('.',',');
  document.querySelector('#bonusEnabled').checked=state.settings.bonusEnabled!==false;document.querySelector('#bonusName').value=state.settings.bonusName||'Bônus';document.querySelector('#incomeType option[value="flash"]').textContent=bonusLabel();document.querySelector('#paySource option[value="flash"]').textContent=bonusLabel();
  document.querySelector('#cloudProvider').value=state.cloud.provider||'google';
  document.querySelector('#googleEmailHint').value=window.saldoPlanAuthUser?.email||state.cloud.emailHint||'';
  document.querySelector('#googleClientId').value=window.SALDOPLAN_DRIVE_CONFIG?.clientId||'';
  document.querySelector('#cloudAccount').value=state.cloud.account||'';
  document.querySelector('#cloudClientId').value=state.cloud.providerClientId||'';
  document.querySelector('#driveFolderName').value=state.cloud.folderName||'SaldoPlan - Backups';
  document.querySelector('#driveAutoBackup').checked=!!state.cloud.autoBackup;
  document.querySelector('#driveRetentionDays').value=String(state.cloud.retentionDays||30);
  updateCloudProviderFields();
  renderDriveFolderSelection();
  document.querySelectorAll('[data-theme-option]').forEach(b=>b.classList.toggle('active',b.dataset.themeOption===state.settings.theme));updateDriveStatus();updateLocalSaveStatus();
}
function renderAll(){applyTheme();renderDashboard();renderTransactions();renderCycles();renderSavings();renderSimulator();renderFixed();renderData()}

const cloudProviderNames={google:'Google Drive',onedrive:'OneDrive',dropbox:'Dropbox'};
function updateCloudProviderFields(){
  const provider=document.querySelector('#cloudProvider')?.value||'google',isGoogle=provider==='google',name=cloudProviderNames[provider]||provider;
  document.querySelector('#googleCloudFields').classList.toggle('hidden',!isGoogle);
  document.querySelector('#otherCloudFields').classList.toggle('hidden',isGoogle);
  document.querySelector('#driveFolderNameLabel')?.classList.toggle('hidden',isGoogle);
  document.querySelector('#cloudAccountLabel').firstChild.textContent=`Conta ${name}`;
  document.querySelector('#cloudAccount').placeholder='voce@exemplo.com';
  document.querySelector('#cloudClientLabel').firstChild.textContent=`Client ID OAuth do ${name}`;
  document.querySelector('#cloudProviderStatus').textContent=`Informe o Client ID do ${name}, salve as preferências e clique em Conectar.`;
  const button=document.querySelector('#connectDrive');button.textContent=`Conectar ao ${name}`;button.disabled=false;
}

function applyTheme(){
  const theme=state.settings?.theme==='dark'?'dark':'light';document.body.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.querySelector('meta[name="theme-color"]').setAttribute('content',theme==='dark'?'#070a0f':'#111827');document.querySelector('#themeQuickBtn').textContent=theme==='dark'?'☀':'☾';
}
function toggleTheme(){state.settings.theme=state.settings.theme==='dark'?'light':'dark';save();applyTheme();renderData()}
function go(view){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.querySelector(`#view-${view}`).classList.add('active');document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===view));if(view==='transactions')renderTransactions();if(view==='cycles')renderCycles();if(view==='savings')renderSavings();if(view==='simulator')renderSimulator();if(view==='fixed')renderFixed();if(view==='data')renderData();window.scrollTo({top:0,behavior:'smooth'})}

// Navegação e atalhos
addEventListener('click',e=>{
  const nav=e.target.closest('[data-nav]');if(nav){go(nav.dataset.nav);return}
  const action=e.target.closest('[data-action]');if(action){if(action.dataset.action==='new-income')openEntry('income');else if(action.dataset.action==='new-fixed')openTemplate();else if(action.dataset.action==='new-saving')openSaving();else if(action.dataset.action==='new-extra')openExtra();else openEntry('expense');return}
  const cycleExtra=e.target.closest('[data-cycle-extra-toggle]');if(cycleExtra){const t=state.transactions.find(x=>x.id===cycleExtra.dataset.cycleExtraToggle&&x.kind==='income'&&x.incomeType==='extra');if(t){t.cycleInclude=t.cycleInclude!==true;save();renderAll()}return}
  const edit=e.target.closest('[data-edit]');if(edit){const t=state.transactions.find(x=>x.id===edit.dataset.edit);if(t)openEntry(t.kind,t);return}
  const templ=e.target.closest('[data-template]');if(templ){openTemplate(state.fixedTemplates.find(t=>t.id===templ.dataset.template));return}
  const sedit=e.target.closest('[data-saving-edit]');if(sedit){openSaving(state.savings.find(x=>x.id===sedit.dataset.savingEdit));return}
  const xedit=e.target.closest('[data-extra-edit]');if(xedit){openExtra(state.overtimeLogs.find(x=>x.id===xedit.dataset.extraEdit));return}
});
document.querySelector('#themeQuickBtn').onclick=toggleTheme;
document.querySelector('#prevMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);renderAll()};
document.querySelector('#nextMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);renderAll()};
document.querySelector('#prevCycleMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);renderAll()};
document.querySelector('#nextCycleMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);renderAll()};
document.querySelector('#prevSimMonth').onclick=()=>{simCursor=new Date(simCursor.getFullYear(),simCursor.getMonth()-1,1);renderSimulator()};
document.querySelector('#nextSimMonth').onclick=()=>{simCursor=new Date(simCursor.getFullYear(),simCursor.getMonth()+1,1);renderSimulator()};
document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');filter=c.dataset.filter;renderTransactions()});
document.querySelector('#dismissImportNote').onclick=()=>{state.importNote=false;save();renderDashboard()};
document.querySelectorAll('[data-theme-option]').forEach(b=>b.onclick=()=>{state.settings.theme=b.dataset.themeOption;save();applyTheme();renderData()});

// Lançamentos
const dlg=document.querySelector('#entryDialog'),form=document.querySelector('#entryForm');
function baseDate(d=cursor){const y=d.getFullYear(),m=d.getMonth();const day=(today.getFullYear()===y&&today.getMonth()===m)?today.getDate():1;return `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
function openEntry(kind='expense',obj=null){
  form.reset();document.querySelector('#entryId').value=obj?.id||'';document.querySelector('#entryKind').value=kind;document.querySelector('#fixedTemplateMode').value='0';document.querySelector('#formEyebrow').textContent=kind==='income'?'ENTRADA':'GASTO';document.querySelector('#formTitle').textContent=obj?'Editar lançamento':kind==='income'?'Nova entrada':'Novo gasto';document.querySelector('#incomeFields').classList.toggle('hidden',kind!=='income');document.querySelector('#expenseFields').classList.toggle('hidden',kind!=='expense');document.querySelector('#repeatLabel').classList.remove('hidden');document.querySelector('#deleteEntry').classList.toggle('hidden',!obj);document.querySelector('#entryDate').value=obj?.date||baseDate();document.querySelector('#entryStatus').value=obj?.status||'realized';document.querySelector('#repeatMonthly').checked=!!obj?.templateId;
  if(kind==='income'){
    const type=obj?.incomeType||'first';document.querySelector('#incomeType').value=type;document.querySelector('#description').value=obj?.description||defaultIncomeDescription(type);
  }else{
    document.querySelector('#expenseType').value=obj?.expenseType||'variable';document.querySelector('#paySource').value=obj?.paySource||'cash';document.querySelector('#category').value=obj?.category||'';document.querySelector('#description').value=obj?.description||'';
  }
  document.querySelector('#amount').value=obj?Number(obj.amount).toFixed(2).replace('.',','):'';dlg.showModal();
}
function openTemplate(t=null){
  form.reset();document.querySelector('#entryId').value=t?.id||'';document.querySelector('#entryKind').value='expense';document.querySelector('#fixedTemplateMode').value='1';document.querySelector('#formEyebrow').textContent='GASTO FIXO';document.querySelector('#formTitle').textContent=t?'Editar gasto fixo':'Novo gasto fixo';document.querySelector('#incomeFields').classList.add('hidden');document.querySelector('#expenseFields').classList.remove('hidden');document.querySelector('#repeatLabel').classList.add('hidden');document.querySelector('#deleteEntry').classList.toggle('hidden',!t);document.querySelector('#expenseType').value='fixed';document.querySelector('#expenseType').disabled=true;document.querySelector('#paySource').value=t?.paySource||'cash';document.querySelector('#category').value=t?.category||'';document.querySelector('#description').value=t?.description||'';document.querySelector('#amount').value=t?Number(t.amount).toFixed(2).replace('.',','):'';const day=t?.dueDay||15;document.querySelector('#entryDate').value=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;document.querySelector('#entryStatus').value='planned';document.querySelector('#entryStatus').closest('label').classList.add('hidden');dlg.showModal();
}
function closeDialog(){document.querySelector('#expenseType').disabled=false;document.querySelector('#entryStatus').closest('label').classList.remove('hidden');dlg.close()}
document.querySelector('#closeDialog').onclick=closeDialog;
form.addEventListener('submit',e=>{
  e.preventDefault();
  const id=document.querySelector('#entryId').value,templateMode=document.querySelector('#fixedTemplateMode').value==='1',kind=document.querySelector('#entryKind').value,amount=money(document.querySelector('#amount').value),date=document.querySelector('#entryDate').value;
  const incomeType=document.querySelector('#incomeType').value,expenseType=document.querySelector('#expenseType').value,category=document.querySelector('#category').value.trim();
  let description=document.querySelector('#description').value.trim();
  if(!description)description=kind==='income'?defaultIncomeDescription(incomeType):defaultExpenseDescription(expenseType,category);
  if(!(amount>0)){alert('Informe um valor maior que zero. Ex.: 2000 ou 2.000,00.');document.querySelector('#amount').focus();return}
  if(!date){alert('Informe a data do lançamento.');document.querySelector('#entryDate').focus();return}
  if(templateMode){
    const t={id:id||uid(),description,amount,dueDay:Number(date.slice(-2)),category:category||'Outros',paySource:document.querySelector('#paySource').value};
    const ix=state.fixedTemplates.findIndex(x=>x.id===id);if(ix>=0)state.fixedTemplates[ix]=t;else state.fixedTemplates.push(t);
  }else{
    const obj={id:id||uid(),kind,description,amount,date,status:document.querySelector('#entryStatus').value};
    if(kind==='income')obj.incomeType=incomeType;else{obj.expenseType=expenseType;obj.paySource=document.querySelector('#paySource').value;obj.category=category||'Outros'}
    const repeatMonthly=document.querySelector('#repeatMonthly').checked;
    const previousTransaction=state.transactions.find(x=>x.id===id);
    const oldTemplateId=previousTransaction?.templateId;
    if(repeatMonthly){
      const templateId=oldTemplateId||uid();
      const template={id:templateId,kind,description,amount,dueDay:Number(date.slice(-2))};
      if(kind==='income')template.incomeType=incomeType;
      else{template.expenseType=expenseType;template.paySource=document.querySelector('#paySource').value;template.category=category||'Outros'}
      const templateIndex=state.fixedTemplates.findIndex(t=>t.id===templateId);
      if(templateIndex>=0)state.fixedTemplates[templateIndex]=template;
      else state.fixedTemplates.push(template);
      obj.templateId=templateId;
      obj.recurringMarker=`${templateId}:${date.slice(0,7)}`;
    }else if(oldTemplateId){
      state.fixedTemplates=state.fixedTemplates.filter(t=>t.id!==oldTemplateId);
      state.transactions=state.transactions.filter(x=>{
        if(x.id===id)return true;
        if(x.templateId!==oldTemplateId)return true;
        return x.date<=date;
      });
      delete obj.templateId;
      delete obj.recurringMarker;
    }
    const ix=state.transactions.findIndex(x=>x.id===id);
    if(ix>=0){
      if(!repeatMonthly&&oldTemplateId){
        delete state.transactions[ix].templateId;
        delete state.transactions[ix].recurringMarker;
      }
      state.transactions[ix]={...state.transactions[ix],...obj};
    }else state.transactions.push(obj);
    const [y,m]=date.slice(0,7).split('-').map(Number);cursor=new Date(y,m-1,1);
  }
  save();closeDialog();renderAll();
});
document.querySelector('#incomeType').addEventListener('change',e=>{
  if(document.querySelector('#entryKind').value!=='income')return;
  const d=document.querySelector('#description'),autoValues=['Salário - quinzena','Salário - final do mês','Entrada extra','Crédito Flash',''];
  if(autoValues.includes(d.value.trim()))d.value=defaultIncomeDescription(e.target.value);
});
document.querySelector('#deleteEntry').onclick=()=>{const id=document.querySelector('#entryId').value,templateMode=document.querySelector('#fixedTemplateMode').value==='1';if(!id)return;if(!confirm('Excluir este item?'))return;if(templateMode){state.fixedTemplates=state.fixedTemplates.filter(x=>x.id!==id);state.transactions=state.transactions.filter(x=>x.templateId!==id)}else state.transactions=state.transactions.filter(x=>x.id!==id);save();closeDialog();renderAll()};

// Guardado
const savingDlg=document.querySelector('#savingDialog'),savingForm=document.querySelector('#savingForm');
function openSaving(obj=null){savingForm.reset();document.querySelector('#savingId').value=obj?.id||'';document.querySelector('#savingFormTitle').textContent=obj?'Editar movimentação':'Nova movimentação';document.querySelector('#savingType').value=obj?.type||'deposit';document.querySelector('#savingDate').value=obj?.date||baseDate();document.querySelector('#savingAccount').value=obj?.account||'Reserva de emergência';document.querySelector('#savingDescription').value=obj?.description||'';document.querySelector('#savingAmount').value=obj?Number(obj.amount).toFixed(2).replace('.',','):'';document.querySelector('#deleteSaving').classList.toggle('hidden',!obj);savingDlg.showModal()}
document.querySelector('#closeSavingDialog').onclick=()=>savingDlg.close();
savingForm.addEventListener('submit',e=>{e.preventDefault();const id=document.querySelector('#savingId').value,obj={id:id||uid(),type:document.querySelector('#savingType').value,date:document.querySelector('#savingDate').value,account:document.querySelector('#savingAccount').value.trim()||'Reserva',description:document.querySelector('#savingDescription').value.trim(),amount:money(document.querySelector('#savingAmount').value)};if(!obj.date||!obj.description||!obj.amount)return;const ix=state.savings.findIndex(x=>x.id===id);if(ix>=0)state.savings[ix]=obj;else state.savings.push(obj);save();savingDlg.close();renderAll()});
document.querySelector('#deleteSaving').onclick=()=>{const id=document.querySelector('#savingId').value;if(!id||!confirm('Excluir esta movimentação?'))return;state.savings=state.savings.filter(x=>x.id!==id);save();savingDlg.close();renderAll()};

// Horas extras
const extraDlg=document.querySelector('#extraDialog'),extraForm=document.querySelector('#extraForm');
function openExtra(obj=null){
  const monthCfg=payrollMonthConfig();if(!obj&&monthCfg.referenceHours&&state.overtimeLogs.filter(
  x => payrollCompetenceKey(x.date) === simKey()
).length === 0){if(!confirm('Esta competência está usando a referência do contracheque. Ao adicionar um registro real, a referência será removida. Continuar?'))return;monthCfg.referenceHours=null;save()}
  extraForm.reset();document.querySelector('#extraId').value=obj?.id||'';document.querySelector('#extraFormTitle').textContent=obj?'Editar registro':'Novo registro';document.querySelector('#extraDate').value=obj?.date||baseDate(simCursor);document.querySelector('#extraDescription').value=obj?.description||'';document.querySelector('#extraStart').value=obj?.start||'17:18';document.querySelector('#extraEnd').value=obj?.end||'19:18';document.querySelector('#extraDeductLunch').checked=!!obj?.deductLunch;document.querySelector('#extraLunchStart').value=obj?.lunchStart||'11:00';document.querySelector('#extraLunchEnd').value=obj?.lunchEnd||'12:00';document.querySelector('#extraHoliday').checked=!!obj?.holiday;document.querySelector('#lunchFields').classList.toggle('hidden',!obj?.deductLunch);document.querySelector('#deleteExtra').classList.toggle('hidden',!obj);updateExtraPreview();extraDlg.showModal();
}
function currentExtraDraft(){return {date:document.querySelector('#extraDate').value,start:document.querySelector('#extraStart').value,end:document.querySelector('#extraEnd').value,deductLunch:document.querySelector('#extraDeductLunch').checked,lunchStart:document.querySelector('#extraLunchStart').value,lunchEnd:document.querySelector('#extraLunchEnd').value,holiday:document.querySelector('#extraHoliday').checked}}
function updateExtraPreview(){const c=calculateExtraRecord(currentExtraDraft());document.querySelector('#extraPreview').textContent=`Total calculado: ${hoursLabel(c.minutes/60)} · HE ${c.is100?'100%':'50%'}: ${hoursLabel(c.minutes/60)} · adicional noturno: ${hoursLabel(c.nightHours||0)}`}
['#extraDate','#extraStart','#extraEnd','#extraLunchStart','#extraLunchEnd','#extraHoliday'].forEach(sel=>document.querySelector(sel).addEventListener('input',updateExtraPreview));document.querySelector('#extraDeductLunch').addEventListener('change',e=>{document.querySelector('#lunchFields').classList.toggle('hidden',!e.target.checked);updateExtraPreview()});
document.querySelector('#closeExtraDialog').onclick=()=>extraDlg.close();
extraForm.addEventListener('submit',e=>{e.preventDefault();const id=document.querySelector('#extraId').value,obj={id:id||uid(),date:document.querySelector('#extraDate').value,description:document.querySelector('#extraDescription').value.trim(),start:document.querySelector('#extraStart').value,end:document.querySelector('#extraEnd').value,deductLunch:document.querySelector('#extraDeductLunch').checked,lunchStart:document.querySelector('#extraLunchStart').value,lunchEnd:document.querySelector('#extraLunchEnd').value,holiday:document.querySelector('#extraHoliday').checked};const c=calculateExtraRecord(obj);if(!obj.date||!obj.description||!obj.start||!obj.end||c.minutes<=0)return;const ix=state.overtimeLogs.findIndex(x=>x.id===id);if(ix>=0)state.overtimeLogs[ix]=obj;else state.overtimeLogs.push(obj);save();extraDlg.close();renderAll()});
document.querySelector('#deleteExtra').onclick=()=>{const id=document.querySelector('#extraId').value;if(!id||!confirm('Excluir este registro de hora extra?'))return;state.overtimeLogs=state.overtimeLogs.filter(x=>x.id!==id);save();extraDlg.close();renderAll()};

document.querySelector('#savePayrollConfig').onclick=()=>{state.payrollConfig.baseSalary=money(document.querySelector('#simBaseSalary').value);state.payrollConfig.monthlyHours=Math.max(1,decimal(document.querySelector('#simMonthlyHours').value));state.payrollConfig.advance=money(document.querySelector('#simAdvance').value);state.payrollConfig.nightPct=Math.max(0,decimal(document.querySelector('#simNightPct').value));state.payrollConfig.extraGoal=Math.max(0,decimal(document.querySelector('#simExtraGoal').value));payrollMonthConfig().holidayCount=Math.max(0,Number(document.querySelector('#simHolidayCount').value||0));save();renderSimulator();alert('Parâmetros da simulação salvos.')};
document.querySelector('#loadJulyReference').onclick=()=>{simCursor=new Date(2026,8,1);const m=payrollMonthConfig('2026-09');m.holidayCount=0;m.referenceHours={h50:60,h100:0,night:6};state.payrollConfig.baseSalary=5000;state.payrollConfig.monthlyHours=220;state.payrollConfig.advance=2000;state.payrollConfig.nightPct=20;save();renderSimulator()};
document.querySelector('#useSimulationIncome').onclick=()=>{const p=payrollSimulation(),[y,m]=p.k.split('-').map(Number),last=new Date(y,m,0).getDate(),date=`${y}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}`;let x=state.transactions.find(t=>t.source==='payroll-simulation'&&t.date?.slice(0,7)===p.k);const obj={id:x?.id||uid(),kind:'income',incomeType:'second',description:'Salário - final do mês (simulação)',amount:Math.max(0,p.finalPay),date,status:'planned',source:'payroll-simulation'};if(x)Object.assign(x,obj);else state.transactions.push(obj);cursor=new Date(y,m-1,1);save();renderAll();alert('Entrada prevista atualizada em Lançamentos.')};

// Preferências e backup local
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function operationStart(title,detail){const overlay=document.querySelector('#operationOverlay'),modal=overlay.querySelector('.operation-modal');modal.classList.remove('done','error');document.querySelector('#operationTitle').textContent=title;document.querySelector('#operationDetail').textContent=detail;document.querySelector('#operationBar').style.width='35%';document.querySelector('#operationOk').classList.add('hidden');overlay.classList.remove('hidden')}
function operationFinish(title,detail,error=false){const overlay=document.querySelector('#operationOverlay'),modal=overlay.querySelector('.operation-modal');modal.classList.toggle('error',error);modal.classList.toggle('done',!error);document.querySelector('#operationTitle').textContent=title;document.querySelector('#operationDetail').textContent=detail;document.querySelector('#operationBar').style.width='100%';document.querySelector('#operationOk').classList.remove('hidden')}
document.querySelector('#operationOk').onclick=()=>document.querySelector('#operationOverlay').classList.add('hidden');
document.querySelector('#saveGoalBtn').onclick=()=>{state.savingGoal=money(document.querySelector('#savingGoal').value);save();renderAll();alert('Meta salva.')};
document.querySelector('#saveBonusConfig').onclick=()=>{state.settings.bonusEnabled=document.querySelector('#bonusEnabled').checked;state.settings.bonusName=document.querySelector('#bonusName').value.trim()||'Bônus';save();renderAll();alert('Configuração do bônus salva.')};
document.querySelector('#saveLocalData').onclick=()=>{save({backupOld:false,cloud:false});updateLocalSaveStatus();alert('Informações salvas neste aparelho.')};
document.querySelector('#exportJson').onclick=()=>{operationStart('Preparando exportação','Gerando o backup completo em JSON…');download(`saldoplan-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),'application/json');operationFinish('Exportação concluída','O arquivo JSON foi baixado para o seu aparelho.')};
function exportRows(){
  const rows=[['Tipo de registro','Data','Natureza','Categoria','Descrição','Conta / origem','Status','Valor (R$)','Início','Fim','Feriado','ID']];
  state.transactions.forEach(x=>rows.push(['Lançamento',x.date,x.kind==='income'?'Entrada':'Gasto',x.kind==='income'?incomeLabel(x.incomeType):expenseLabel(x.expenseType),x.description,x.kind==='income'?'':x.paySource==='flash'?'Flash':'Salário / conta',x.status==='realized'?'Realizado':'Previsto',Number(x.amount||0).toFixed(2).replace('.',','),'','', '',x.id]));
  state.savings.forEach(x=>rows.push(['Guardado',x.date,x.type==='deposit'?'Aporte':'Retirada','',x.description,x.account||'',x.type==='deposit'?'Entrada':'Saída',Number(x.amount||0).toFixed(2).replace('.',','),'','','',x.id]));
  state.overtimeLogs.forEach(x=>rows.push(['Hora extra',x.date,x.holiday?'HE 100%':'HE 50%','',x.description,'',x.holiday?'Feriado':'Dia normal','',x.start,x.end,x.holiday?'Sim':'Não',x.id]));
  return rows;
}
document.querySelector('#exportCsv').onclick=()=>{operationStart('Preparando exportação','Organizando lançamentos, guardado e horas extras…');const csv=exportRows().map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(';')).join('\n');download(`saldoplan-dados-${new Date().toISOString().slice(0,10)}.csv`,'\uFEFF'+csv,'text/csv;charset=utf-8');operationFinish('Exportação concluída','O relatório CSV foi baixado para o seu aparelho.')};
function exportPdf(){
  const rows=exportRows(),moneyValue=value=>value?`R$ ${value}`:'',tableRows=rows.slice(1).map(row=>`<tr>${row.slice(0,10).map((value,index)=>`<td class="${index===7?'money':''}">${escapeHtml(index===7?moneyValue(value):value)}</td>`).join('')}</tr>`).join('');
  const totals=metrics(),saved=savingsMetrics(),popup=window.open('','_blank','width=1000,height=800');if(!popup){alert('Permita pop-ups para gerar o PDF.');return}
  popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório SaldoPlan</title><style>body{font-family:Arial,sans-serif;color:#18212f;margin:32px}h1{margin:0 0 4px;color:#0f172a}p{color:#64748b;margin:4px 0 20px}.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}.summary div{background:#eef4ff;border:1px solid #cbd8ef;padding:12px;border-radius:8px}.summary b{display:block;font-size:17px;margin-top:5px}.summary span{font-size:11px;color:#52647c}table{border-collapse:collapse;width:100%;font-size:10px}th{background:#172554;color:#fff;text-align:left;padding:8px}td{border-bottom:1px solid #dbe3ef;padding:7px}tr:nth-child(even){background:#f8fafc}.money{text-align:right;white-space:nowrap}@media print{body{margin:15mm}.no-print{display:none}.summary{grid-template-columns:repeat(4,1fr)}} </style></head><body><h1>SaldoPlan</h1><p>Relatório financeiro gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p><div class="summary"><div><span>Saldo atual</span><b>${fmt.format(totals.cashNow)}</b></div><div><span>Saldo projetado</span><b>${fmt.format(totals.cashProjected)}</b></div><div><span>Guardado</span><b>${fmt.format(saved.balance)}</b></div><div><span>Registros</span><b>${rows.length-1}</b></div></div><table><thead><tr>${rows[0].slice(0,10).map(value=>`<th>${escapeHtml(value)}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);popup.document.close()}
document.querySelector('#exportPdf').onclick=()=>{operationStart('Preparando relatório','Montando o relatório PDF com totais e tabelas…');exportPdf();operationFinish('Relatório pronto','A janela de impressão foi aberta. Escolha “Salvar como PDF”.')};
document.querySelector('#importJson').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;operationStart('Importando informações','Lendo o arquivo e restaurando seus dados…');try{const data=migrateState(JSON.parse(await f.text()));if(!Array.isArray(data.transactions))throw new Error();localStorage.setItem(PREVIOUS_KEY,JSON.stringify(state));state=data;save({backupOld:false});renderAll();operationFinish('Importação concluída','Backup importado sem perder a cópia local anterior.')}catch{operationFinish('Não foi possível importar','O arquivo selecionado não é um backup válido.',true)}e.target.value=''};
document.querySelector('#restorePreviousLocal').onclick=()=>{const old=localStorage.getItem(PREVIOUS_KEY);if(!old){alert('Ainda não existe uma cópia local anterior.');return}if(!confirm('Restaurar a cópia local anterior? O estado atual ficará como a próxima cópia de segurança.'))return;try{const current=JSON.stringify(state);state=migrateState(JSON.parse(old));localStorage.setItem(PREVIOUS_KEY,current);save({backupOld:false});renderAll();alert('Cópia local restaurada.')}catch{alert('Não foi possível restaurar a cópia local.')}};
document.querySelector('#resetData').onclick=()=>{if(!confirm('Apagar os dados deste aparelho? Uma cópia local anterior será mantida.'))return;localStorage.setItem(PREVIOUS_KEY,JSON.stringify(state));const keepCloud={...seed.cloud,...state.cloud};const keepSettings={...seed.settings,...state.settings};state=deepClone(seed);state.cloud=keepCloud;state.settings=keepSettings;state.importNote=false;save({backupOld:false});renderAll()};

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
    return;
  }
  const config=oauthConfig[provider],clientId=state.cloud.providerClientId;if(!clientId)throw new Error(`Informe o Client ID do ${cloudProviderNames[provider]} antes de conectar.`);
  const verifier=base64Url(crypto.getRandomValues(new Uint8Array(32))),challenge=base64Url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),oauthState=uid(),redirectUri=`${location.origin}${location.pathname}`;
  sessionStorage.setItem('saldoPlan.oauth',JSON.stringify({provider,verifier,state:oauthState,redirectUri}));
  const params=new URLSearchParams({client_id:clientId,response_type:'code',redirect_uri:redirectUri,state:oauthState,code_challenge:challenge,code_challenge_method:'S256'});if(config.scope)params.set('scope',config.scope);if(provider==='dropbox')params.set('token_access_type','offline');
  const popup=window.open(`${config.authorize}?${params}`,'saldoPlanOAuth','width=520,height=700');if(!popup)throw new Error('Permita pop-ups para concluir a conexão.');
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{window.removeEventListener('message',receive);reject(new Error('A autorização expirou ou foi cancelada.'))},180000);function receive(event){if(event.origin!==location.origin||event.data?.type!=='saldoPlanOAuth')return;clearTimeout(timer);window.removeEventListener('message',receive);if(event.data.error){reject(new Error(event.data.error));return}fetch(config.token,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,grant_type:'authorization_code',code:event.data.code,redirect_uri:redirectUri,code_verifier:verifier}).toString()}).then(r=>r.json()).then(data=>{if(!data.access_token)throw new Error(data.error_description||'Não foi possível obter o token.');cloudToken=data.access_token;resolve()}).catch(reject)}window.addEventListener('message',receive)});
  updateDriveStatus(`${cloudProviderNames[provider]} conectado. Backup pronto para uso.`);
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
    save({cloud:false});
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
  state.cloud.lastBackupAt=new Date().toISOString();save({backupOld:false,cloud:false});updateDriveStatus(`Backup enviado ao ${cloudProviderNames[state.cloud.provider]}.`);alert('Backup enviado com sucesso.');
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
    save({backupOld:false,cloud:false});
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
    localStorage.setItem(PREVIOUS_KEY,JSON.stringify(state));
    state=data;
    state.cloud={...seed.cloud,...state.cloud,clientId:DRIVE_CONFIG.clientId||state.cloud.clientId,emailHint:window.saldoPlanAuthUser?.email||state.cloud.emailHint};
    save({backupOld:false,cloud:false});
    renderAll();
    alert('Backup do Drive restaurado.');
  }catch(e){alert(e.message)}
};

// PWA
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.querySelector('#installBtn').classList.remove('hidden')});
document.querySelector('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.querySelector('#installBtn').classList.add('hidden')};
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});

if(handleCloudOAuthCallback()){}else{applyTheme();renderAll()}
