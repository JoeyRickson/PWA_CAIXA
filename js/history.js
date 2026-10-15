// Histórico, snapshots e rollback
const UNDO_HISTORY_KEY='meuCaixa.undoHistory.v3';
const LEGACY_UNDO_HISTORY_KEY='meuCaixa.undoHistory.v2';
let undoHistoryExpanded=false;

function historyLimit(){
  const raw=Number(state.historySettings?.limit||20);
  return Math.min(30,Math.max(5,Number.isFinite(raw)?raw:20));
}

function normalizeHistorySettings(){
  if(!state.historySettings||typeof state.historySettings!=='object'){
    state.historySettings={enabled:true,limit:20};
  }

  state.historySettings.enabled=state.historySettings.enabled!==false;
  state.historySettings.limit=historyLimit();
}

function readUndoHistory(){
  normalizeHistorySettings();

  try{
    let raw=localStorage.getItem(UNDO_HISTORY_KEY);

    if(!raw){
      raw=localStorage.getItem(LEGACY_UNDO_HISTORY_KEY);
      if(raw){
        localStorage.setItem(UNDO_HISTORY_KEY,raw);
      }
    }

    if(!raw)return [];

    const items=JSON.parse(raw);

    return Array.isArray(items)
      ?items
        .filter(item=>item&&typeof item?.state==='string')
        .slice(-historyLimit())
      :[];
  }catch{
    return [];
  }
}

function writeUndoHistory(items){
  normalizeHistorySettings();

  try{
    const trimmed=(Array.isArray(items)?items:[]).slice(-historyLimit());

    try{
      localStorage.setItem(UNDO_HISTORY_KEY,JSON.stringify(trimmed));
    }catch(error){
      if(error?.name!=='QuotaExceededError')throw error;

      const reduced=trimmed.slice(-Math.max(5,Math.floor(trimmed.length/2)));
      localStorage.setItem(UNDO_HISTORY_KEY,JSON.stringify(reduced));
    }
  }catch(error){
    console.warn('Não foi possível atualizar o histórico local.',error);
  }
}

function transactionLabel(item){
  if(!item)return '';
  return item.description||item.category||item.incomeType||item.expenseType||'lançamento';
}

function collectionChange(previous,current,key,label,labelFn=item=>item?.description||label.toLowerCase()){
  const before=Array.isArray(previous?.[key])?previous[key]:[];
  const after=Array.isArray(current?.[key])?current[key]:[];

  if(before.length>after.length){
    const removed=before.find(item=>!after.some(currentItem=>currentItem?.id===item?.id));
    return `${label} excluído${removed?`: ${labelFn(removed)}`:''}`;
  }

  if(before.length<after.length){
    const created=after.find(item=>!before.some(previousItem=>previousItem?.id===item?.id));
    return `${label} criado${created?`: ${labelFn(created)}`:''}`;
  }

  const changed=after.find(item=>{
    const old=before.find(previousItem=>previousItem?.id===item?.id);
    return old&&JSON.stringify(old)!==JSON.stringify(item);
  });

  if(changed){
    return `${label} alterado: ${labelFn(changed)}`;
  }

  return '';
}

function describeStateChange(previousText,nextText){
  try{
    const previous=JSON.parse(previousText||'{}');
    const current=JSON.parse(nextText||'{}');

    const checks=[
      collectionChange(previous,current,'transactions','Lançamento',transactionLabel),
      collectionChange(previous,current,'savings','Guardado',item=>item?.description||item?.account||'movimentação'),
      collectionChange(previous,current,'investments','Investimento',item=>item?.product||item?.institution||'investimento'),
      collectionChange(previous,current,'overtimeLogs','Hora extra',item=>item?.description||item?.date||'registro'),
      collectionChange(previous,current,'fixedTemplates','Gasto fixo',item=>item?.description||'gasto fixo'),
      collectionChange(previous,current,'savingTemplates','Recorrência de guardado',item=>item?.description||'recorrência'),
      collectionChange(previous,current,'fgtsAccounts','Conta FGTS',item=>item?.employer||item?.accountNumber||'conta FGTS'),
      collectionChange(previous,current,'creditCards','Cartão',item=>item?.name||item?.institution||'cartão'),
      collectionChange(previous,current,'cardPurchases','Compra no cartão',item=>item?.description||'compra'),
      collectionChange(previous,current,'liabilities','Dívida',item=>item?.name||item?.institution||'dívida'),
      collectionChange(previous,current,'financialGoals','Meta financeira',item=>item?.name||'meta'),
      collectionChange(previous,current,'importRules','Regra de importação',item=>item?.pattern||'regra')
    ].find(Boolean);

    if(checks)return checks;

    if(JSON.stringify(previous.patrimonySettings)!==JSON.stringify(current.patrimonySettings)){
      return 'Configuração de patrimônio alterada';
    }

    if(JSON.stringify(previous.payrollConfig)!==JSON.stringify(current.payrollConfig)){
      return 'Parâmetros da simulação alterados';
    }

    if(JSON.stringify(previous.thirteenthByYear)!==JSON.stringify(current.thirteenthByYear)){
      return 'Simulação de 13º salário alterada';
    }

    if(JSON.stringify(previous.fgtsByYear)!==JSON.stringify(current.fgtsByYear)){
      return 'Informações de FGTS alteradas';
    }

    if(Number(previous.savingGoal)!==Number(current.savingGoal)){
      return 'Meta mensal alterada';
    }

    if(JSON.stringify(previous.cloud)!==JSON.stringify(current.cloud)){
      return 'Preferências de backup alteradas';
    }

    if(JSON.stringify(previous.settings)!==JSON.stringify(current.settings)){
      return 'Preferências do aplicativo alteradas';
    }
  }catch{}

  return 'Alteração salva';
}

function pushUndoSnapshot(label='Alteração salva',snapshotText=''){
  normalizeHistorySettings();

  if(state.historySettings.enabled===false)return false;

  const snapshot=snapshotText||JSON.stringify(state);

  if(!snapshot)return false;

  const history=readUndoHistory();
  const last=history[history.length-1];

  if(last?.state===snapshot){
    return false;
  }

  history.push({
    id:uid(),
    label:String(label||'Alteração salva').trim()||'Alteração salva',
    createdAt:new Date().toISOString(),
    state:snapshot
  });

  writeUndoHistory(history);
  return true;
}

function createSafetySnapshot(label='Cópia de segurança'){
  return pushUndoSnapshot(label,JSON.stringify(state));
}

function clearUndoHistory(){
  try{
    localStorage.removeItem(UNDO_HISTORY_KEY);
    localStorage.removeItem(LEGACY_UNDO_HISTORY_KEY);
  }catch{}

  renderUndoHistory();
}

function renderUndoHistory(){
  const host=document.querySelector('#undoHistory');
  const counter=document.querySelector('#undoHistoryCount');

  if(!host)return;

  normalizeHistorySettings();

  const history=readUndoHistory().slice().reverse();

  if(counter){
    counter.textContent=`${history.length}/${historyLimit()}`;
  }

  const enabled=document.querySelector('#historyEnabled');
  const limit=document.querySelector('#historyLimit');

  if(enabled)enabled.checked=state.historySettings.enabled!==false;
  if(limit)limit.value=String(historyLimit());

  if(!history.length){
    host.innerHTML='<div class="empty">Sem histórico recente de alterações.</div>';
    return;
  }

  const visible=undoHistoryExpanded?history:history.slice(0,3);
  let previousDay='';
  const markup=visible.map((item,index)=>{
    const entryIndex=history.length-1-index;
    const date=new Date(item.createdAt);
    const valid=!Number.isNaN(date.getTime());
    const day=valid?date.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'}):'Data indisponível';
    const time=valid?date.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'--:--';
    const header=day!==previousDay?`<div class="sp312-day">${escapeHtml(day)}</div>`:'';
    previousDay=day;
    return `${header}<div class="undo-row sp312-timeline-item">
      <div class="undo-copy">
        <strong>${escapeHtml(item.label||'Alteração salva')}</strong>
        <span>${escapeHtml(time)} · ${index===0?'Mais recente':'Versão anterior'}</span>
      </div>
      <button type="button" class="btn ghost small" data-undo-index="${entryIndex}" aria-label="Restaurar a versão de ${escapeHtml(day)} às ${escapeHtml(time)}">Restaurar</button>
    </div>`;
  }).join('');
  const more=history.length>3
    ?`<button type="button" class="btn ghost full sp312-history-toggle" data-undo-more="1" aria-expanded="${undoHistoryExpanded}">${undoHistoryExpanded?'Mostrar somente as 3 recentes':`Ver todas as ${history.length} versões`}</button>`
    :'';
  host.innerHTML=`<div class="sp312-timeline">${markup}</div>${more}`;
}

function restoreUndoSnapshot(index=-1){
  const history=readUndoHistory();

  if(!history.length){
    alert('Nenhuma alteração recente para desfazer.');
    return false;
  }

  const restoreIndex=index>=0
    ?Math.min(Math.max(0,index),history.length-1)
    :history.length-1;

  const target=history[restoreIndex];

  try{
    const current=JSON.stringify(state);

    if(current!==target.state){
      pushUndoSnapshot(`Antes de restaurar: ${target.label||'alteração'}`,current);
    }

    state=migrateState(JSON.parse(target.state||'{}'));
    localStorage.setItem(PREVIOUS_KEY,current);

    save({
      backupOld:false,
      cloud:true,
      history:false
    });

    renderAll();
    alert(`Alteração restaurada: ${target.label}.`);
    return true;
  }catch(error){
    console.error(error);
    alert('Não foi possível restaurar a alteração selecionada.');
    return false;
  }
}
