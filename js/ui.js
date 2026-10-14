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
  renderUndoHistory();
}
function renderAll(){applyTheme();renderDashboard();renderTransactions();renderCycles();renderSavings();renderPortfolio();renderSimulator();renderThirteenth();renderFgts();renderFixed();renderData()}

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

const BRAZIL_STATE_TIMEZONES={
  AC:'America/Rio_Branco',
  AL:'America/Maceio',
  AP:'America/Belem',
  AM:'America/Manaus',
  BA:'America/Bahia',
  CE:'America/Fortaleza',
  DF:'America/Sao_Paulo',
  ES:'America/Sao_Paulo',
  GO:'America/Sao_Paulo',
  MA:'America/Fortaleza',
  MT:'America/Cuiaba',
  MS:'America/Campo_Grande',
  MG:'America/Sao_Paulo',
  PA:'America/Belem',
  PB:'America/Fortaleza',
  PR:'America/Sao_Paulo',
  PE:'America/Recife',
  PI:'America/Fortaleza',
  RJ:'America/Sao_Paulo',
  RN:'America/Fortaleza',
  RS:'America/Sao_Paulo',
  RO:'America/Porto_Velho',
  RR:'America/Boa_Vista',
  SC:'America/Sao_Paulo',
  SP:'America/Sao_Paulo',
  SE:'America/Maceio',
  TO:'America/Araguaina'
};

const TIMEZONE_STATE_KEY='saldoplan.timezoneState';

function selectedTimezoneState(){
  try{
    return localStorage.getItem(TIMEZONE_STATE_KEY)||'auto';
  }catch{
    return 'auto';
  }
}

function currentTimezone(){
  const selected=selectedTimezoneState();

  if(selected!=='auto' && BRAZIL_STATE_TIMEZONES[selected]){
    return BRAZIL_STATE_TIMEZONES[selected];
  }

  try{
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }catch{
    return 'America/Sao_Paulo';
  }
}

function updateLiveClock(){
  const dateEl=document.querySelector('#liveDate');
  const timeEl=document.querySelector('#liveTime');

  if(!dateEl||!timeEl)return;

  const now=new Date();
  const timeZone=currentTimezone();

  try{
    dateEl.textContent=new Intl.DateTimeFormat('pt-BR',{
      timeZone,
      day:'2-digit',
      month:'2-digit',
      year:'numeric'
    }).format(now);

    timeEl.textContent=new Intl.DateTimeFormat('pt-BR',{
      timeZone,
      hour:'2-digit',
      minute:'2-digit',
      second:'2-digit',
      hour12:false
    }).format(now);

    dateEl.title=`Fuso: ${timeZone}`;
    timeEl.title=`Fuso: ${timeZone}`;
  }catch{
    dateEl.textContent=now.toLocaleDateString('pt-BR');
    timeEl.textContent=now.toLocaleTimeString('pt-BR');
  }
}

function initLiveClock(){
  const select=document.querySelector('#timezoneState');

  if(!select)return;

  const saved=selectedTimezoneState();

  if([...select.options].some(o=>o.value===saved)){
    select.value=saved;
  }else{
    select.value='auto';
  }

  select.addEventListener('change',()=>{
    try{
      localStorage.setItem(
        TIMEZONE_STATE_KEY,
        select.value
      );
    }catch{}

    updateLiveClock();
  });

  updateLiveClock();

  setInterval(updateLiveClock,1000);
}

const LAYOUT_MODE_KEY='saldoplan.layoutMode';
const DESKTOP_THEME_KEY='saldoplan.desktopTheme';

function readLayoutMode(){
  try{
    const value=localStorage.getItem(LAYOUT_MODE_KEY);
    return ['auto','desktop','compact'].includes(value)?value:'auto';
  }catch{
    return 'auto';
  }
}

function readDesktopTheme(){
  try{
    const value=localStorage.getItem(DESKTOP_THEME_KEY);
    return ['graphite','midnight','current'].includes(value)?value:'graphite';
  }catch{
    return 'graphite';
  }
}

function effectiveLayoutMode(){
  const selected=readLayoutMode();
  const width=window.innerWidth||document.documentElement.clientWidth||0;

  if(width<900)return 'compact';
  if(selected==='compact')return 'compact';
  if(selected==='desktop')return 'desktop';

  return width>=1100?'desktop':'compact';
}

function applyLayoutExperience(){
  const selected=readLayoutMode();
  const effective=effectiveLayoutMode();
  const desktopTheme=readDesktopTheme();

  document.body.dataset.layoutMode=selected;
  document.body.dataset.layoutEffective=effective;
  document.body.dataset.desktopTheme=desktopTheme;

  const layoutSelect=document.querySelector('#layoutModeSelect');
  const themeSelect=document.querySelector('#desktopThemeSelect');

  if(layoutSelect && layoutSelect.value!==selected){
    layoutSelect.value=selected;
  }

  if(themeSelect && themeSelect.value!==desktopTheme){
    themeSelect.value=desktopTheme;
  }
}

function saveLayoutMode(value){
  const safe=['auto','desktop','compact'].includes(value)?value:'auto';
  try{localStorage.setItem(LAYOUT_MODE_KEY,safe)}catch{}
  applyLayoutExperience();
}

function saveDesktopTheme(value){
  const safe=['graphite','midnight','current'].includes(value)?value:'graphite';
  try{localStorage.setItem(DESKTOP_THEME_KEY,safe)}catch{}
  applyLayoutExperience();
}
function applyTheme(){
  const theme=state.settings?.theme==='dark'?'dark':'light';document.body.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.querySelector('meta[name="theme-color"]').setAttribute('content',theme==='dark'?'#070a0f':'#111827');document.querySelector('#themeQuickBtn').textContent=theme==='dark'?'☀':'☾';
}
function toggleTheme(){state.settings.theme=state.settings.theme==='dark'?'light':'dark';save({backupOld:false,cloud:false,history:false});applyTheme();renderData()}
function go(view){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.querySelector(`#view-${view}`).classList.add('active');document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.nav===view));if(view==='transactions')renderTransactions();if(view==='cycles')renderCycles();if(view==='savings')renderSavings();if(view==='portfolio')renderPortfolio();if(view==='simulator')renderSimulator();if(view==='thirteenth')renderThirteenth();if(view==='fgts')renderFgts();if(view==='fixed')renderFixed();if(view==='market')renderMarket();if(view==='data')renderData();window.scrollTo({top:0,behavior:'smooth'})}

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

document.querySelector('#layoutModeSelect')?.addEventListener('change',e=>{
  saveLayoutMode(e.target.value);
});

document.querySelector('#desktopThemeSelect')?.addEventListener('change',e=>{
  saveDesktopTheme(e.target.value);
});

let layoutResizeTimer=null;

addEventListener('resize',()=>{
  clearTimeout(layoutResizeTimer);
  layoutResizeTimer=setTimeout(applyLayoutExperience,120);
});

applyLayoutExperience();
document.querySelector('#prevMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);rememberViewMonth();renderAll()};
document.querySelector('#nextMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);rememberViewMonth();renderAll()};
document.querySelector('#prevTransactionMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);rememberViewMonth();renderAll()};
document.querySelector('#nextTransactionMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);rememberViewMonth();renderAll()};
document.querySelector('#prevCycleMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()-1,1);rememberViewMonth();renderAll()};
document.querySelector('#nextCycleMonth').onclick=()=>{cursor=new Date(cursor.getFullYear(),cursor.getMonth()+1,1);rememberViewMonth();renderAll()};
document.querySelector('#prevSimMonth').onclick=()=>{simCursor=new Date(simCursor.getFullYear(),simCursor.getMonth()-1,1);rememberSimMonth();renderSimulator()};
document.querySelector('#nextSimMonth').onclick=()=>{simCursor=new Date(simCursor.getFullYear(),simCursor.getMonth()+1,1);rememberSimMonth();renderSimulator()};
document.querySelector('#prevThirteenthYear').onclick=()=>{thirteenthViewYear--;renderThirteenth()};
document.querySelector('#nextThirteenthYear').onclick=()=>{thirteenthViewYear++;renderThirteenth()};
document.querySelector('#prevFgtsYear').onclick=()=>{fgtsViewYear--;renderFgts()};
document.querySelector('#nextFgtsYear').onclick=()=>{fgtsViewYear++;renderFgts()};
document.querySelector('#thirteenthStartMonth').onchange=()=>renderThirteenth(true);
document.querySelector('#thirteenthEndMonth').onchange=()=>renderThirteenth(true);
document.querySelector('#thirteenthFirstAmount').addEventListener('input',()=>{
  const calc=thirteenthCalculation(
    thirteenthViewYear,
    Number(document.querySelector('#thirteenthStartMonth').value),
    Number(document.querySelector('#thirteenthEndMonth').value)
  );
  const firstAmount=money(document.querySelector('#thirteenthFirstAmount').value);
  const secondAmount=round2(Math.max(0,calc.net-firstAmount));
  document.querySelector('#thirteenthSecondAmount').value=secondAmount.toFixed(2).replace('.',',');
  document.querySelector('#thirteenthFirstEstimate').textContent=fmt.format(firstAmount);
  document.querySelector('#thirteenthSecondEstimate').textContent=fmt.format(secondAmount);
});
document.querySelector('#thirteenthSecondAmount').addEventListener('input',()=>{
  document.querySelector('#thirteenthSecondEstimate').textContent=fmt.format(
    Math.max(0,money(document.querySelector('#thirteenthSecondAmount').value))
  );
});
document.querySelector('#saveThirteenth').onclick=saveThirteenth;
document.querySelector('#saveFgtsPeriod').onclick=()=>{
  const record=fgtsYearRecord(fgtsViewYear);
  const startMonth=Number(document.querySelector('#fgtsStartMonth').value);
  const endMonth=Number(document.querySelector('#fgtsEndMonth').value);
  if(startMonth>endMonth){
    alert('O mês inicial deve ser anterior ou igual ao mês final.');
    return;
  }
  record.startMonth=startMonth;
  record.endMonth=endMonth;
  save();
  renderFgts();
};
document.querySelector('#fgtsImportFile').addEventListener('change',e=>importFgtsStatement(e.target.files?.[0]));
document.querySelector('#addFgtsDepositRow').onclick=()=>addFgtsImportDraftRow({type:'deposit',competence:'',date:'',amount:null});
document.querySelector('#addFgtsThirteenthRow').onclick=()=>addFgtsImportDraftRow({type:'thirteenth',competence:'',date:'',amount:null});
document.querySelector('#addFgtsJamRow').onclick=()=>addFgtsImportDraftRow({type:'jam',competence:'',date:'',amount:null});
document.querySelector('#addFgtsWithdrawalRow').onclick=()=>addFgtsImportDraftRow({type:'withdrawal',competence:'',date:'',amount:null});
document.querySelector('#addFgtsJamWithdrawalRow').onclick=()=>addFgtsImportDraftRow({type:'jamWithdrawal',competence:'',date:'',amount:null});
document.querySelector('#addFgtsIndemnityRow').onclick=()=>addFgtsImportDraftRow({type:'indemnity',competence:'',date:'',amount:null});
document.querySelector('#addFgtsTerminationPenaltyRow').onclick=()=>addFgtsImportDraftRow({type:'terminationPenalty',competence:'',date:'',amount:null});
document.querySelector('#applyFgtsImport').onclick=applyFgtsImport;
addEventListener('change',e=>{
  const thirteenthPaid=e.target.closest('[data-fgts-thirteenth-paid]');
  if(thirteenthPaid){
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    const deposit=record.deposits.thirteenth||{};
    const thirteenthRecord=thirteenthYearRecord(fgtsViewYear);
    const calc=thirteenthCalculation(fgtsViewYear,thirteenthRecord.startMonth,thirteenthRecord.endMonth);
    const dateInput=document.querySelector('[data-fgts-thirteenth-date]');
    const amountInput=document.querySelector('[data-fgts-thirteenth-amount]');
    record.deposits.thirteenth={
      ...deposit,
      paid:thirteenthPaid.checked,
      amount:amountInput?.value.trim()?Math.max(0,money(amountInput.value)):round2(calc.gross*0.08),
      date:dateInput?.value||''
    };
    save();
    renderFgts();
    return;
  }
  const thirteenthDate=e.target.closest('[data-fgts-thirteenth-date]');
  if(thirteenthDate){
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    record.deposits.thirteenth={...(record.deposits.thirteenth||{}),date:thirteenthDate.value};
    save();
    return;
  }
  const thirteenthAmount=e.target.closest('[data-fgts-thirteenth-amount]');
  if(thirteenthAmount){
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    record.deposits.thirteenth={...(record.deposits.thirteenth||{}),amount:Math.max(0,money(thirteenthAmount.value))};
    save();
    renderFgts();
    return;
  }
  const thirteenthJam=e.target.closest('[data-fgts-thirteenth-jam]');
  if(thirteenthJam){
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    record.deposits.thirteenth={...(record.deposits.thirteenth||{}),jam:Math.max(0,money(thirteenthJam.value))};
    save();renderFgts();return;
  }
  const paidToggle=e.target.closest('[data-fgts-paid]');
  if(paidToggle){
    const month=Number(paidToggle.dataset.fgtsPaid);
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    const deposit=record.deposits[String(month)]||{};
    const extra=extraCompensationForMonth(fgtsViewYear,month);
    const amount=round2((Number(state.payrollConfig.baseSalary||0)+extra)*0.08);
    const dateInput=document.querySelector(`[data-fgts-date="${month}"]`);
    const amountInput=document.querySelector(`[data-fgts-amount="${month}"]`);
    record.deposits[String(month)]={
      ...deposit,
      paid:paidToggle.checked,
      amount:amountInput?.value.trim()?Math.max(0,money(amountInput.value)):amount,
      date:dateInput?.value||''
    };
    save();
    renderFgts();
    return;
  }
  const dateInput=e.target.closest('[data-fgts-date]');
  if(dateInput){
    const month=Number(dateInput.dataset.fgtsDate);
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    const deposit=record.deposits[String(month)]||{};
    record.deposits[String(month)]={...deposit,date:dateInput.value};
    save();
    return;
  }
  const amountInput=e.target.closest('[data-fgts-amount]');
  if(amountInput){
    const month=Number(amountInput.dataset.fgtsAmount);
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    const deposit=record.deposits[String(month)]||{};
    record.deposits[String(month)]={...deposit,amount:Math.max(0,money(amountInput.value))};
    save();
    renderFgts();
    return;
  }
  const jamInput=e.target.closest('[data-fgts-jam]');
  if(jamInput){
    const month=Number(jamInput.dataset.fgtsJam);
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    const deposit=record.deposits[String(month)]||{};
    record.deposits[String(month)]={...deposit,jam:Math.max(0,money(jamInput.value))};
    save();
    renderFgts();
    return;
  }
  const withdrawalInput=e.target.closest('[data-fgts-withdrawal]');
  if(withdrawalInput){
    const month=Number(withdrawalInput.dataset.fgtsWithdrawal);
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    const deposit=record.deposits[String(month)]||{};
    record.deposits[String(month)]={...deposit,withdrawal:Math.max(0,money(withdrawalInput.value))};
    save();
    renderFgts();
    return;
  }
  const jamWithdrawalInput=e.target.closest('[data-fgts-jam-withdrawal]');
  if(jamWithdrawalInput){
    const month=Number(jamWithdrawalInput.dataset.fgtsJamWithdrawal);
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    const deposit=record.deposits[String(month)]||{};
    record.deposits[String(month)]={...deposit,jamWithdrawal:Math.max(0,money(jamWithdrawalInput.value))};
    save();
    renderFgts();
    return;
  }
  const indemnityInput=e.target.closest('[data-fgts-indemnity]');
  if(indemnityInput){
    const month=Number(indemnityInput.dataset.fgtsIndemnity);
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    const deposit=record.deposits[String(month)]||{};
    record.deposits[String(month)]={...deposit,indemnity:Math.max(0,money(indemnityInput.value))};
    save();
    renderFgts();
    return;
  }
  const terminationPenaltyInput=e.target.closest('[data-fgts-termination-penalty]');
  if(terminationPenaltyInput){
    const month=Number(terminationPenaltyInput.dataset.fgtsTerminationPenalty);
    const record=fgtsYearRecord(fgtsViewYear);
    record.deposits=record.deposits||{};
    const deposit=record.deposits[String(month)]||{};
    record.deposits[String(month)]={...deposit,terminationPenalty:Math.max(0,money(terminationPenaltyInput.value))};
    save();
    renderFgts();
  }
});
document.querySelectorAll('.chip').forEach(c=>c.onclick=()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active');filter=c.dataset.filter;renderTransactions()});
document.querySelector('#dismissImportNote').onclick=()=>{state.importNote=false;save();renderDashboard()};
document.querySelectorAll('[data-theme-option]').forEach(b=>b.onclick=()=>{state.settings.theme=b.dataset.themeOption;save({backupOld:false,cloud:false,history:false});applyTheme();renderData()});
