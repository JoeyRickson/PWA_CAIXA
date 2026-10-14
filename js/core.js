const STORAGE_KEY='meuCaixa.v1'; // Mantido de propósito para preservar os dados da versão anterior.
const PREVIOUS_KEY='meuCaixa.previousBackup.v2';
const UNDO_HISTORY_KEY='meuCaixa.undoHistory.v2';
const MAX_UNDO_SNAPSHOTS=12;
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
let thirteenthViewYear=today.getFullYear();
let fgtsViewYear=today.getFullYear();

const LAST_VIEW_MONTH_KEY='saldoplan.lastViewMonth';

try{
  const savedMonth=localStorage.getItem(LAST_VIEW_MONTH_KEY);
  if(/^\d{4}-\d{2}$/.test(savedMonth||'')){
    const [savedYear,savedMonthNumber]=savedMonth.split('-').map(Number);
    if(savedYear&&savedMonthNumber>=1&&savedMonthNumber<=12){
      cursor=new Date(savedYear,savedMonthNumber-1,1);
    }
  }
}catch{}

function rememberViewMonth(){
  try{
    localStorage.setItem(LAST_VIEW_MONTH_KEY,monthKey(cursor));
  }catch{}
}
const LAST_SIM_MONTH_KEY='saldoplan.lastSimMonth';

try{
  const savedSimMonth=localStorage.getItem(LAST_SIM_MONTH_KEY);
  if(/^\d{4}-\d{2}$/.test(savedSimMonth||'')){
    const [simYear,simMonthNumber]=savedSimMonth.split('-').map(Number);
    if(simYear&&simMonthNumber>=1&&simMonthNumber<=12){
      simCursor=new Date(simYear,simMonthNumber-1,1);
    }
  }
}catch{}

function rememberSimMonth(){
  try{
    localStorage.setItem(LAST_SIM_MONTH_KEY,monthKey(simCursor));
  }catch{}
}
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
  thirteenthByYear:{},
  fgtsByYear:{},
  fgtsAccounts:[],
  activeFgtsAccountId:'',
  fixedTemplates:[],
  savingTemplates:[],
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
  migrated.thirteenthByYear=(raw.thirteenthByYear&&typeof raw.thirteenthByYear==='object')?raw.thirteenthByYear:{};
  migrated.fgtsByYear=(raw.fgtsByYear&&typeof raw.fgtsByYear==='object')?raw.fgtsByYear:{};
  migrated.fgtsAccounts=Array.isArray(raw.fgtsAccounts)?raw.fgtsAccounts.filter(account=>account&&typeof account==='object').map(account=>({
    ...account,
    years:account.years&&typeof account.years==='object'?account.years:{}
  })):[];
  if(!migrated.fgtsAccounts.length&&Object.keys(migrated.fgtsByYear).length){
    migrated.fgtsAccounts.push({
      id:'fgts-legacy',
      employer:'Histórico anual antigo · contas não separadas',
      accountNumber:'',
      currentBalance:null,
      balanceDate:'',
      isLegacy:true,
      years:migrated.fgtsByYear
    });
    migrated.fgtsByYear={};
  }
  migrated.activeFgtsAccountId=migrated.fgtsAccounts.some(account=>account.id===raw.activeFgtsAccountId)
    ?raw.activeFgtsAccountId
    :migrated.fgtsAccounts[0]?.id||'';
  migrated.transactions=Array.isArray(raw.transactions)?raw.transactions:base.transactions;
  migrated.transactions=migrated.transactions.map(x=>x.description==='Crédito Flash'?{...x,description:migrated.settings.bonusName||'Bônus'}:x);
  migrated.fixedTemplates=Array.isArray(raw.fixedTemplates)?raw.fixedTemplates:[];
  migrated.savingTemplates=Array.isArray(raw.savingTemplates)?raw.savingTemplates:[];
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

function readUndoHistory(){
  try{
    const raw=localStorage.getItem(UNDO_HISTORY_KEY);
    if(!raw)return [];
    const items=JSON.parse(raw);
    return Array.isArray(items)?items.filter(item=>item&&typeof item?.state==='string').slice(-MAX_UNDO_SNAPSHOTS):[];
  }catch{
    return [];
  }
}

function writeUndoHistory(items){
  try{
    localStorage.setItem(UNDO_HISTORY_KEY,JSON.stringify(items.slice(-MAX_UNDO_SNAPSHOTS)));
  }catch{}
}

function renderUndoHistory(){
  const host=document.querySelector('#undoHistory');
  if(!host)return;
  const history=readUndoHistory().slice().reverse();
  if(!history.length){
    host.innerHTML='<div class="empty">Sem histórico recente de alterações.</div>';
    return;
  }

  host.innerHTML=history.map((item,index)=>{
    const entryIndex=history.length-1-index;
    return `<div class="undo-row">
      <div class="undo-copy">
        <strong>${escapeHtml(item.label||'Alteração salva')}</strong>
        <span>${new Date(item.createdAt).toLocaleString('pt-BR')}</span>
      </div>
      <button type="button" class="btn ghost small" data-undo-index="${entryIndex}">Restaurar</button>
    </div>`;
  }).join('');
}

function pushUndoSnapshot(label='Alteração salva'){
  const snapshot=JSON.stringify(state);
  const history=readUndoHistory();
  history.push({
    id:uid(),
    label:String(label||'Alteração salva').trim()||'Alteração salva',
    createdAt:new Date().toISOString(),
    state:snapshot
  });
  writeUndoHistory(history);
}

function restoreUndoSnapshot(index=-1){
  const history=readUndoHistory();
  if(!history.length){
    alert('Nenhuma alteração recente para desfazer.');
    return false;
  }

  const restoreIndex=index>=0?Math.min(index,history.length-1):history.length-1;
  const target=history[restoreIndex];
  const remaining=history.filter((_,idx)=>idx!==restoreIndex);
  writeUndoHistory(remaining);

  try{
    const current=JSON.stringify(state);
    state=migrateState(JSON.parse(target.state||'{}'));
    localStorage.setItem(PREVIOUS_KEY,current);
    save({backupOld:false,cloud:false});
    renderAll();
    alert(`Alteração restaurada: ${target.label}.`);
    return true;
  }catch{
    writeUndoHistory([...remaining,target]);
    alert('Não foi possível restaurar a última alteração.');
    return false;
  }
}

function save({backupOld=true,cloud=true,undoLabel='Alteração salva'}={}){
  try{
    if(backupOld){
      const old=localStorage.getItem(STORAGE_KEY);
      if(old)localStorage.setItem(PREVIOUS_KEY,old);
      pushUndoSnapshot(undoLabel);
    }
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

function transactionMonth(x){
  return String(x?.date||'').slice(0,7);
}

function formatMonthValue(value){
  if(!/^\d{4}-\d{2}$/.test(value||''))return '—';
  const [y,m]=value.split('-').map(Number);
  return `${String(m).padStart(2,'0')}/${y}`;
}

function freezeRecurringHistory(templateId,beforeMonth){
  state.transactions.forEach(x=>{
    if(x.templateId===templateId && transactionMonth(x)<beforeMonth){
      delete x.templateId;
      delete x.recurringMarker;
    }
  });
}

function removeRecurringPlannedFrom(templateId,fromMonth,exceptId=''){
  state.transactions=state.transactions.filter(x=>{
    if(x.id===exceptId)return true;
    if(x.templateId!==templateId)return true;
    if(transactionMonth(x)<fromMonth)return true;
    return x.status==='realized';
  });
}

function detachRemainingRecurring(templateId){
  state.transactions.forEach(x=>{
    if(x.templateId===templateId){
      delete x.templateId;
      delete x.recurringMarker;
    }
  });
}

function inferRecurringStartMonth(t,targetKey){
  if(t.startMonth)return t.startMonth;

  const months=state.transactions
    .filter(x=>x.templateId===t.id)
    .map(transactionMonth)
    .filter(Boolean)
    .sort();

  return months.length ? months[months.length-1] : targetKey;
}

function ensureRecurring(){
  const targetKey=key();
  const [y,m]=targetKey.split('-').map(Number);
  let changed=false;

  state.fixedTemplates.forEach(t=>{
    const startMonth=inferRecurringStartMonth(t,targetKey);

    if(!t.startMonth){
      t.startMonth=startMonth;
      changed=true;
    }

    if(targetKey<startMonth)return;
    if(t.endMonth && targetKey>t.endMonth)return;

    const marker=`${t.id}:${targetKey}`;
    if(state.transactions.some(x=>x.recurringMarker===marker))return;

    const day=Math.min(t.dueDay||1,new Date(y,m,0).getDate());

    const obj={
      id:uid(),
      kind:t.kind||'expense',
      description:t.description,
      amount:t.amount,
      date:`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      status:'planned',
      recurringMarker:marker,
      templateId:t.id
    };

    if(obj.kind==='income'){
      obj.incomeType=t.incomeType||'first';
    }else{
      obj.expenseType=t.expenseType||'fixed';
      obj.paySource=t.paySource||'cash';
      obj.category=t.category||'Outros';
    }

    state.transactions.push(obj);
    changed=true;
  });

  if(changed)save();
}

function savingMonth(x){
  return String(x?.date||'').slice(0,7);
}

function freezeSavingHistory(templateId,beforeMonth){
  state.savings.forEach(x=>{
    if(x.savingTemplateId===templateId && savingMonth(x)<beforeMonth){
      delete x.savingTemplateId;
      delete x.savingRecurringMarker;
    }
  });
}

function removeSavingRecurringPlannedFrom(templateId,fromMonth,exceptId=''){
  state.savings=state.savings.filter(x=>{
    if(x.id===exceptId)return true;
    if(x.savingTemplateId!==templateId)return true;
    if(savingMonth(x)<fromMonth)return true;
    return x.status==='realized';
  });
}

function detachRemainingSavingRecurring(templateId){
  state.savings.forEach(x=>{
    if(x.savingTemplateId===templateId){
      delete x.savingTemplateId;
      delete x.savingRecurringMarker;
    }
  });
}

function inferSavingStartMonth(t,targetKey){
  if(t.startMonth)return t.startMonth;

  const months=state.savings
    .filter(x=>x.savingTemplateId===t.id)
    .map(savingMonth)
    .filter(Boolean)
    .sort();

  return months.length ? months[months.length-1] : targetKey;
}

function ensureSavingRecurring(targetKey=key()){
  const [y,m]=targetKey.split('-').map(Number);
  let changed=false;

  state.savingTemplates.forEach(t=>{
    const startMonth=inferSavingStartMonth(t,targetKey);

    if(!t.startMonth){
      t.startMonth=startMonth;
      changed=true;
    }

    if(targetKey<startMonth)return;
    if(t.endMonth && targetKey>t.endMonth)return;

    const marker=`${t.id}:${targetKey}`;
    if(state.savings.some(x=>x.savingRecurringMarker===marker))return;

    const day=Math.min(t.dueDay||1,new Date(y,m,0).getDate());

    state.savings.push({
      id:uid(),
      type:t.type||'deposit',
      date:`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      account:t.account||'Reserva',
      description:t.description||'Movimentação recorrente',
      amount:t.amount,
      status:'planned',
      savingTemplateId:t.id,
      savingRecurringMarker:marker
    });

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
  ensureSavingRecurring(k);

  const allItems=[...state.savings].sort((a,b)=>a.date.localeCompare(b.date));
  const all=allItems.filter(x=>x.status!=='planned');

  const deposits=sum(all.filter(x=>x.type==='deposit'));
  const withdrawals=sum(all.filter(x=>x.type==='withdrawal'));

  const month=all.filter(x=>inMonth(x,k));
  const monthDeposits=sum(month.filter(x=>x.type==='deposit'));
  const monthWithdrawals=sum(month.filter(x=>x.type==='withdrawal'));

  return {
    all,
    allItems,
    balance:deposits-withdrawals,
    monthDeposits,
    monthWithdrawals,
    monthNet:monthDeposits-monthWithdrawals
  };
}

const MARKET_CACHE_KEY='saldoplan.market.cache.v1';
const MARKET_CACHE_TTL=5*60*1000;
