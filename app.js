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
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const today=new Date();
let cursor=new Date(today.getFullYear(),today.getMonth(),1);
let simCursor=new Date(today.getFullYear(),today.getMonth(),1);
let filter='all';
let deferredPrompt=null;
let driveToken=null;
let cloudTimer=null;

const seed={
  version:2,
  savingGoal:500,
  importNote:true,
  settings:{theme:'light'},
  cloud:{provider:'google',emailHint:'',clientId:'',account:'',providerClientId:'',folderName:'Meu Caixa - Backups',autoBackup:false,retentionDays:30,lastBackupAt:null,lastFileId:null},
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
  migrated.payrollConfig={...base.payrollConfig,...(raw.payrollConfig||{})};
  migrated.payrollMonths=(raw.payrollMonths&&typeof raw.payrollMonths==='object')?raw.payrollMonths:{};
  migrated.transactions=Array.isArray(raw.transactions)?raw.transactions:base.transactions;
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
    if(cloud&&state.cloud?.autoBackup&&driveToken)scheduleCloudBackup();
  }catch(e){console.error(e)}
}
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
  document.querySelector('#flashProjected').textContent=`Projetado: ${fmt.format(m.flashProjected)}`;
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
function incomeLabel(t){return ({first:'Quinzena',second:'Final do mês',extra:'Extra',flash:'Flash'})[t]||'Entrada'}
function expenseLabel(t){return ({fixed:'Fixo',variable:'Variável',unplanned:'Imprevisto'})[t]||'Gasto'}
function defaultIncomeDescription(t){return ({first:'Salário - quinzena',second:'Salário - final do mês',extra:'Entrada extra',flash:'Crédito Flash'})[t]||'Entrada'}
function defaultExpenseDescription(t,category){const c=String(category||'').trim();return c||({fixed:'Gasto fixo',variable:'Gasto variável',unplanned:'Gasto imprevisto'})[t]||'Gasto'}
function itemHtml(x){
  const isInc=x.kind==='income',flash=isInc?x.incomeType==='flash':x.paySource==='flash',label=isInc?incomeLabel(x.incomeType):`${expenseLabel(x.expenseType)} · ${x.category||'Sem categoria'}`;
  return `<button class="item" data-edit="${x.id}" style="width:100%;text-align:left;cursor:pointer"><span class="item-icon ${flash?'flash':''}">${isInc?'+':'−'}</span><span class="item-main"><strong>${escapeHtml(x.description)}</strong><span>${formatDate(x.date)} · ${escapeHtml(label)}</span></span><span class="item-side"><strong class="${isInc?'positive':'negative'}">${isInc?'+ ':'− '}${fmt.format(x.amount)}</strong><span class="${x.status==='planned'?'pending':''}">${x.status==='planned'?'Previsto':'Realizado'}</span></span></button>`;
}
function renderTransactions(){let tx=transactions();if(filter==='income')tx=tx.filter(x=>x.kind==='income');if(filter==='expense')tx=tx.filter(x=>x.kind==='expense');if(filter==='pending')tx=tx.filter(x=>x.status==='planned');document.querySelector('#transactionList').innerHTML=tx.length?tx.map(itemHtml).join(''):'<div class="empty">Nada por aqui.</div>'}
function renderFixed(){const fixeds=state.fixedTemplates.filter(t=>(t.kind||'expense')==='expense');document.querySelector('#fixedList').innerHTML=fixeds.length?fixeds.map(t=>`<button class="item" data-template="${t.id}" style="width:100%;text-align:left;cursor:pointer"><span class="item-icon">↻</span><span class="item-main"><strong>${escapeHtml(t.description)}</strong><span>Dia ${t.dueDay} · ${escapeHtml(t.category||'Sem categoria')} · ${t.paySource==='flash'?'Flash':'Salário / conta'}</span></span><span class="item-side"><strong>${fmt.format(t.amount)}</strong><span>Todo mês</span></span></button>`).join(''):'<div class="empty">Nenhum gasto fixo automático.</div>'}

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
  const [year,month]=monthKeyValue.split('-').map(Number),totalDays=new Date(year,month,0).getDate(),holidays=getAllHolidays(year);
  let sundays=0,holidaysCount=0;
  for(let day=1;day<=totalDays;day++){
    const date=new Date(year,month-1,day),iso=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if(date.getDay()===0){sundays++;continue}
    if(holidays.has(iso))holidaysCount++;
  }
  const restDays=sundays+holidaysCount;
  return {totalDays,sundays,holidays:holidaysCount,restDays,workingDays:totalDays-restDays};
}
function inss2026(base){
  const brackets=[[1621,0.075],[2902.84,0.09],[4354.27,0.12],[8475.55,0.14]];let prev=0,total=0;
  for(const [upper,rate] of brackets){const part=Math.max(0,Math.min(base,upper)-prev);total+=round2(part*rate);prev=upper;if(base<=upper)break}return round2(total);
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
  const extraBase=round2(v50+v100+nightValue),calendar=getDSRCalendar(k),manualHolidays=Math.max(0,Number(monthCfg.holidayCount||0)),holidays=calendar.holidays+manualHolidays,restDays=calendar.restDays+manualHolidays,workDays=Math.max(1,calendar.workingDays-manualHolidays),dsr=round2(extraBase/workDays*restDays);
  const extras=round2(extraBase+dsr),gross=round2(Number(cfg.baseSalary||0)+extras),inss=inss2026(gross),ir=irrf2026(gross,inss),netMonth=round2(gross-inss-ir.value),advance=round2(Number(cfg.advance||0)),finalPay=round2(netMonth-advance);
  return {k,h50,h100,night,hourBase,v50,v100,nightValue,extraBase,sundays:calendar.sundays,holidays,automaticHolidays:calendar.holidays,manualHolidays,restDays,workDays,dsr,extras,gross,inss,ir,netMonth,advance,finalPay,logs,reference:monthCfg.referenceHours&&logs.length===0};
}
function renderSimulator(){
  document.querySelector('#simMonthLabel').textContent=`${MONTHS[simCursor.getMonth()]} ${simCursor.getFullYear()}`;
  const cfg=state.payrollConfig,monthCfg=payrollMonthConfig();document.querySelector('#simBaseSalary').value=Number(cfg.baseSalary).toFixed(2).replace('.',',');document.querySelector('#simMonthlyHours').value=cfg.monthlyHours;document.querySelector('#simAdvance').value=Number(cfg.advance).toFixed(2).replace('.',',');document.querySelector('#simHolidayCount').value=monthCfg.holidayCount||0;document.querySelector('#simNightPct').value=cfg.nightPct;document.querySelector('#simExtraGoal').value=cfg.extraGoal||0;
  const p=payrollSimulation();document.querySelector('#simHours50').textContent=hoursLabel(p.h50);document.querySelector('#simValue50').textContent=fmt.format(p.v50);document.querySelector('#simHours100').textContent=hoursLabel(p.h100);document.querySelector('#simValue100').textContent=fmt.format(p.v100);document.querySelector('#simNightHours').textContent=hoursLabel(p.night);document.querySelector('#simNightValue').textContent=fmt.format(p.nightValue);setMoney('simDsrValue',p.dsr);document.querySelector('#simDsrDetail').textContent=`${p.restDays} DSR / ${p.workDays} dias no divisor`;
  setMoney('payBase',state.payrollConfig.baseSalary);setMoney('payExtras',p.extras);setMoney('payGross',p.gross);document.querySelector('#payInss').textContent=`− ${fmt.format(p.inss)}`;document.querySelector('#payIrrf').textContent=`− ${fmt.format(p.ir.value)}`;setMoney('payNetMonth',p.netMonth);document.querySelector('#payAdvance').textContent=`− ${fmt.format(p.advance)}`;setMoney('payFinal',p.finalPay);
  document.querySelector('#payrollReferenceNote').textContent=p.reference?'Referência de julho/2026 carregada: 39h08 de HE 50%, 3h00 de HE 100% e 7h00 de adicional noturno. O resultado deve reproduzir de perto o seu contracheque.':'INSS e IRRF usam as tabelas de 2026; DSR considera feriados automáticos nacionais + AM + Manaus e feriados extras manuais.';
  const records=[...p.logs].sort((a,b)=>b.date.localeCompare(a.date));
  let refHtml='';if(p.reference)refHtml=`<div class="item"><span class="item-icon">✓</span><span class="item-main"><strong>Referência do contracheque — julho/2026</strong><span>39h08 HE50 · 3h00 HE100 · 7h00 noturno</span></span><span class="item-side"><strong>${fmt.format(p.extras)}</strong><span>Calibração</span></span></div>`;
  document.querySelector('#extraList').innerHTML=refHtml+(records.length?records.map(r=>{const c=calculateExtraRecord(r);return `<button class="item" data-extra-edit="${r.id}" style="width:100%;text-align:left;cursor:pointer"><span class="item-icon">⌁</span><span class="item-main"><strong>${escapeHtml(r.description)}</strong><span>${formatDate(r.date)} · ${r.start}–${r.end}${r.holiday?' · HE 100%':''}</span></span><span class="item-side"><strong>${hoursLabel(c.minutes/60)}</strong><span>${c.is100?'100%':'50%'}${c.nightHours?` · ${hoursLabel(c.nightHours)} not.`:''}</span></span></button>`}).join(''):'');
  if(!p.reference&&!records.length)document.querySelector('#extraList').innerHTML='<div class="empty">Nenhuma hora extra registrada nesta competência.</div>';
}

function renderData(){
  document.querySelector('#savingGoal').value=(state.savingGoal||0).toFixed(2).replace('.',',');
  document.querySelector('#cloudProvider').value=state.cloud.provider||'google';document.querySelector('#googleEmailHint').value=state.cloud.emailHint||'';document.querySelector('#googleClientId').value=state.cloud.clientId||'';document.querySelector('#cloudAccount').value=state.cloud.account||'';document.querySelector('#cloudClientId').value=state.cloud.providerClientId||'';document.querySelector('#driveFolderName').value=state.cloud.folderName||'Meu Caixa - Backups';document.querySelector('#driveAutoBackup').checked=!!state.cloud.autoBackup;document.querySelector('#driveRetentionDays').value=String(state.cloud.retentionDays||30);updateCloudProviderFields();
  document.querySelectorAll('[data-theme-option]').forEach(b=>b.classList.toggle('active',b.dataset.themeOption===state.settings.theme));updateDriveStatus();
}
function renderAll(){applyTheme();renderDashboard();renderTransactions();renderSavings();renderSimulator();renderFixed();renderData()}

const cloudProviderNames={google:'Google Drive',onedrive:'OneDrive',dropbox:'Dropbox',icloud:'iCloud Drive'};
function updateCloudProviderFields(){
  const provider=document.querySelector('#cloudProvider')?.value||'google',isGoogle=provider==='google',name=cloudProviderNames[provider]||provider;
  document.querySelector('#googleCloudFields').classList.toggle('hidden',!isGoogle);document.querySelector('#otherCloudFields').classList.toggle('hidden',isGoogle);
  document.querySelector('#driveFolderName').closest('label').querySelector('span')?.remove();document.querySelector('#driveFolderName').closest('label').firstChild.textContent=isGoogle?'Pasta no Drive':'Pasta de backup';
  document.querySelector('#cloudAccountLabel').firstChild.textContent=`Conta ${name}`;document.querySelector('#cloudAccount').placeholder=provider==='icloud'?'seu Apple ID':'voce@exemplo.com';document.querySelector('#cloudClientLabel').firstChild.textContent=`Client ID OAuth do ${name}`;
  document.querySelector('#cloudProviderStatus').textContent=`Integração automática com ${name} ainda precisa ser configurada no app. Por enquanto, use Exportar backup (.json) para guardar o arquivo nesse serviço.`;
  const button=document.querySelector('#connectDrive');button.textContent=isGoogle?'Conectar ao Google Drive':`Conectar ao ${name} (em breve)`;button.disabled=!isGoogle;
}

function applyTheme(){
  const theme=state.settings?.theme==='dark'?'dark':'light';document.body.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.querySelector('meta[name="theme-color"]').setAttribute('content',theme==='dark'?'#070a0f':'#111827');document.querySelector('#themeQuickBtn').textContent=theme==='dark'?'☀':'☾';
}
function toggleTheme(){state.settings.theme=state.settings.theme==='dark'?'light':'dark';save();applyTheme();renderData()}
function go(view){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.querySelector(`#view-${view}`).classList.add('active');document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===view));if(view==='transactions')renderTransactions();if(view==='savings')renderSavings();if(view==='simulator')renderSimulator();if(view==='fixed')renderFixed();if(view==='data')renderData();window.scrollTo({top:0,behavior:'smooth'})}

// Navegação e atalhos
addEventListener('click',e=>{
  const nav=e.target.closest('[data-nav]');if(nav){go(nav.dataset.nav);return}
  const action=e.target.closest('[data-action]');if(action){if(action.dataset.action==='new-income')openEntry('income');else if(action.dataset.action==='new-fixed')openTemplate();else if(action.dataset.action==='new-saving')openSaving();else if(action.dataset.action==='new-extra')openExtra();else openEntry('expense');return}
  const edit=e.target.closest('[data-edit]');if(edit){const t=state.transactions.find(x=>x.id===edit.dataset.edit);if(t)openEntry(t.kind,t);return}
  const templ=e.target.closest('[data-template]');if(templ){openTemplate(state.fixedTemplates.find(t=>t.id===templ.dataset.template));return}
  const sedit=e.target.closest('[data-saving-edit]');if(sedit){openSaving(state.savings.find(x=>x.id===sedit.dataset.savingEdit));return}
  const xedit=e.target.closest('[data-extra-edit]');if(xedit){openExtra(state.overtimeLogs.find(x=>x.id===xedit.dataset.extraEdit));return}
});
document.querySelector('#themeQuickBtn').onclick=toggleTheme;
document.querySelector('#prevMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);renderAll()};
document.querySelector('#nextMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);renderAll()};
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
document.querySelector('#loadJulyReference').onclick=()=>{simCursor=new Date(2026,6,1);const m=payrollMonthConfig('2026-07');m.holidayCount=0;m.referenceHours={h50:39.14,h100:3,night:7};state.payrollConfig.baseSalary=5000;state.payrollConfig.monthlyHours=220;state.payrollConfig.advance=2000;state.payrollConfig.nightPct=20;save();renderSimulator()};
document.querySelector('#useSimulationIncome').onclick=()=>{const p=payrollSimulation(),[y,m]=p.k.split('-').map(Number),last=new Date(y,m,0).getDate(),date=`${y}-${String(m).padStart(2,'0')}-${String(last).padStart(2,'0')}`;let x=state.transactions.find(t=>t.source==='payroll-simulation'&&t.date?.slice(0,7)===p.k);const obj={id:x?.id||uid(),kind:'income',incomeType:'second',description:'Salário - final do mês (simulação)',amount:Math.max(0,p.finalPay),date,status:'planned',source:'payroll-simulation'};if(x)Object.assign(x,obj);else state.transactions.push(obj);cursor=new Date(y,m-1,1);save();renderAll();alert('Entrada prevista atualizada em Lançamentos.')};

// Preferências e backup local
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
document.querySelector('#saveGoalBtn').onclick=()=>{state.savingGoal=money(document.querySelector('#savingGoal').value);save();renderAll();alert('Meta salva.')};
document.querySelector('#exportJson').onclick=()=>download(`meu-caixa-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),'application/json');
document.querySelector('#exportCsv').onclick=()=>{const rows=[['Data','Tipo','Subtipo','Descrição','Categoria','Pago com','Status','Valor']].concat(state.transactions.map(x=>[x.date,x.kind==='income'?'Entrada':'Gasto',x.kind==='income'?incomeLabel(x.incomeType):expenseLabel(x.expenseType),x.description,x.category||'',x.paySource==='flash'?'Flash':x.paySource?'Salário / conta':'',x.status==='realized'?'Realizado':'Previsto',Number(x.amount).toFixed(2).replace('.',',')]));const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');download(`meu-caixa-${new Date().toISOString().slice(0,10)}.csv`,'\uFEFF'+csv,'text/csv;charset=utf-8')};
document.querySelector('#importJson').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=migrateState(JSON.parse(await f.text()));if(!Array.isArray(data.transactions))throw new Error();localStorage.setItem(PREVIOUS_KEY,JSON.stringify(state));state=data;save({backupOld:false});renderAll();alert('Backup importado sem perder a cópia local anterior.')}catch{alert('Arquivo de backup inválido.')}e.target.value=''};
document.querySelector('#restorePreviousLocal').onclick=()=>{const old=localStorage.getItem(PREVIOUS_KEY);if(!old){alert('Ainda não existe uma cópia local anterior.');return}if(!confirm('Restaurar a cópia local anterior? O estado atual ficará como a próxima cópia de segurança.'))return;try{const current=JSON.stringify(state);state=migrateState(JSON.parse(old));localStorage.setItem(PREVIOUS_KEY,current);save({backupOld:false});renderAll();alert('Cópia local restaurada.')}catch{alert('Não foi possível restaurar a cópia local.')}};
document.querySelector('#resetData').onclick=()=>{if(!confirm('Apagar os dados deste aparelho? Uma cópia local anterior será mantida.'))return;localStorage.setItem(PREVIOUS_KEY,JSON.stringify(state));const keepCloud={...seed.cloud,...state.cloud};const keepSettings={...seed.settings,...state.settings};state=deepClone(seed);state.cloud=keepCloud;state.settings=keepSettings;state.importNote=false;save({backupOld:false});renderAll()};

// Google Drive
function updateDriveStatus(message){const el=document.querySelector('#driveStatus'),detail=document.querySelector('#driveDetail');if(!el)return;const connected=!!driveToken;el.textContent=connected?'Conectado':'Desconectado';el.classList.toggle('ok',connected);if(message)detail.textContent=message;else if(state.cloud.lastBackupAt)detail.textContent=`Último backup conhecido: ${new Date(state.cloud.lastBackupAt).toLocaleString('pt-BR')}. Retenção: ${state.cloud.retentionDays||30} dias.`;else detail.innerHTML='O backup será salvo na pasta configurada.'}
function setDriveBusy(busy,label='Enviando backup…'){const button=document.querySelector('#backupDrive');if(!button)return;button.disabled=busy;button.classList.toggle('busy',busy);button.textContent=busy?label:'Enviar backup agora'}
document.querySelector('#cloudProvider').addEventListener('change',e=>{state.cloud.provider=e.target.value;updateCloudProviderFields()});
document.querySelector('#saveCloudConfig').onclick=()=>{state.cloud.provider=document.querySelector('#cloudProvider').value;state.cloud.emailHint=document.querySelector('#googleEmailHint').value.trim();state.cloud.clientId=document.querySelector('#googleClientId').value.trim();state.cloud.account=document.querySelector('#cloudAccount').value.trim();state.cloud.providerClientId=document.querySelector('#cloudClientId').value.trim();state.cloud.folderName=document.querySelector('#driveFolderName').value.trim()||'Meu Caixa - Backups';state.cloud.autoBackup=document.querySelector('#driveAutoBackup').checked;state.cloud.retentionDays=Math.max(1,Number(document.querySelector('#driveRetentionDays').value||30));save();renderData();alert(`Configuração de ${cloudProviderNames[state.cloud.provider]} salva.`)};
function requestDriveToken(){return new Promise((resolve,reject)=>{const clientId=(document.querySelector('#googleClientId').value.trim()||state.cloud.clientId||'');if(!clientId){reject(new Error('Informe o Google OAuth Client ID em Dados e backup.'));return}if(!window.google?.accounts?.oauth2){reject(new Error('O login do Google ainda não carregou. Tente novamente em alguns segundos.'));return}state.cloud.clientId=clientId;state.cloud.emailHint=document.querySelector('#googleEmailHint').value.trim()||state.cloud.emailHint;state.cloud.folderName=document.querySelector('#driveFolderName').value.trim()||state.cloud.folderName;state.cloud.autoBackup=document.querySelector('#driveAutoBackup').checked;save({cloud:false});const tokenClient=google.accounts.oauth2.initTokenClient({client_id:clientId,scope:'https://www.googleapis.com/auth/drive.file',hint:state.cloud.emailHint||undefined,callback:resp=>{if(resp.error){reject(new Error(resp.error));return}driveToken=resp.access_token;updateDriveStatus('Google Drive conectado nesta sessão.');resolve(driveToken)}});tokenClient.requestAccessToken({prompt:'consent'})})}
document.querySelector('#connectDrive').onclick=async()=>{try{await requestDriveToken();await findOrCreateDriveFolder();updateDriveStatus('Google Drive conectado. A pasta de backup foi criada ou localizada.');renderData()}catch(e){alert(e.message)}};
async function driveFetch(url,options={}){if(!driveToken)throw new Error('Conecte o Google Drive primeiro.');const headers=new Headers(options.headers||{});headers.set('Authorization',`Bearer ${driveToken}`);const r=await fetch(url,{...options,headers});if(r.status===401){driveToken=null;updateDriveStatus('A autorização expirou. Conecte novamente.');throw new Error('Autorização do Google expirada.')}if(!r.ok){let msg='Erro no Google Drive.';try{const j=await r.json();msg=j.error?.message||msg}catch{}throw new Error(msg)}return r}
async function findOrCreateDriveFolder(){const name=state.cloud.folderName||'Meu Caixa - Backups';const q=`mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g,"\\'")}' and trashed=false`;let r=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`);let j=await r.json();if(j.files?.[0])return j.files[0].id;r=await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/vnd.google-apps.folder'})});j=await r.json();return j.id}
async function findBackupFile(folderId){const q=`'${folderId}' in parents and name='meu-caixa-backup.json' and trashed=false`;const r=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&spaces=drive`);const j=await r.json();return j.files?.[0]||null}
async function listBackupFiles(folderId){const q=`'${folderId}' in parents and name contains 'meu-caixa-backup' and trashed=false`;const r=await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&spaces=drive`);const j=await r.json();return j.files||[]}
async function cleanOldBackups(folderId){const retention=Math.max(1,Number(state.cloud.retentionDays||30)),cutoff=Date.now()-retention*86400000,files=await listBackupFiles(folderId);await Promise.all(files.filter(file=>file.name!=='meu-caixa-backup.json'&&file.modifiedTime&&new Date(file.modifiedTime).getTime()<cutoff).map(file=>driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}`,{method:'DELETE'})))}
async function backupToDrive(silent=false){
  if(!driveToken){if(silent)return;await requestDriveToken()}
  if(!silent)setDriveBusy(true);
  try{const folderId=await findOrCreateDriveFolder(),now=new Date(),stamp=now.toISOString().replace(/[:.]/g,'-'),body=JSON.stringify({...state,exportedAt:now.toISOString()},null,2);let file=await findBackupFile(folderId),name='meu-caixa-backup.json';if(silent){name=`meu-caixa-backup-${stamp}.json`;file=null}if(!file){let r=await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name,modifiedTime',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,mimeType:'application/json',parents:[folderId]})});file=await r.json()}await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,{method:'PATCH',headers:{'Content-Type':'application/json'},body});if(silent)await cleanOldBackups(folderId);state.cloud.lastBackupAt=now.toISOString();state.cloud.lastFileId=file.id;save({backupOld:false,cloud:false});updateDriveStatus(`Backup enviado ao Drive em ${now.toLocaleString('pt-BR')}.`);if(!silent)alert('Backup enviado ao Google Drive.')}catch(e){if(!silent)alert(e.message);throw e}finally{if(!silent)setDriveBusy(false)}
}
document.querySelector('#backupDrive').onclick=()=>backupToDrive(false).catch(()=>{});
document.querySelector('#restoreDrive').onclick=async()=>{try{if(!driveToken)await requestDriveToken();const folderId=await findOrCreateDriveFolder(),files=await listBackupFiles(folderId),file=files[0]||null;if(!file){alert('Nenhum backup do Meu Caixa foi encontrado nessa pasta.');return}if(!confirm(`Restaurar o backup do Drive${file.modifiedTime?` de ${new Date(file.modifiedTime).toLocaleString('pt-BR')}`:''}? O estado atual será mantido como cópia local anterior.`))return;const r=await driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`),data=migrateState(await r.json());localStorage.setItem(PREVIOUS_KEY,JSON.stringify(state));state=data;state.cloud={...seed.cloud,...state.cloud,clientId:document.querySelector('#googleClientId').value.trim()||state.cloud.clientId,emailHint:document.querySelector('#googleEmailHint').value.trim()||state.cloud.emailHint};save({backupOld:false,cloud:false});renderAll();alert('Backup do Drive restaurado.')}catch(e){alert(e.message)}};

// PWA
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;document.querySelector('#installBtn').classList.remove('hidden')});
document.querySelector('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.querySelector('#installBtn').classList.add('hidden')};
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});

applyTheme();renderAll();
