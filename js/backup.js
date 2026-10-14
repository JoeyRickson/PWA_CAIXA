// Preferências e backup local
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function operationStart(title,detail){const overlay=document.querySelector('#operationOverlay'),modal=overlay.querySelector('.operation-modal');modal.classList.remove('done','error');document.querySelector('#operationTitle').textContent=title;document.querySelector('#operationDetail').textContent=detail;document.querySelector('#operationBar').style.width='35%';document.querySelector('#operationOk').classList.add('hidden');overlay.classList.remove('hidden')}
function operationFinish(title,detail,error=false){const overlay=document.querySelector('#operationOverlay'),modal=overlay.querySelector('.operation-modal');modal.classList.toggle('error',error);modal.classList.toggle('done',!error);document.querySelector('#operationTitle').textContent=title;document.querySelector('#operationDetail').textContent=detail;document.querySelector('#operationBar').style.width='100%';document.querySelector('#operationOk').classList.remove('hidden')}
document.querySelector('#operationOk').onclick=()=>document.querySelector('#operationOverlay').classList.add('hidden');
document.querySelector('#saveGoalBtn').onclick=()=>{state.savingGoal=money(document.querySelector('#savingGoal').value);save();renderAll();alert('Meta salva.')};
document.querySelector('#saveBonusConfig').onclick=()=>{state.settings.bonusEnabled=document.querySelector('#bonusEnabled').checked;state.settings.bonusName=document.querySelector('#bonusName').value.trim()||'Bônus';save();renderAll();alert('Configuração do bônus salva.')};
document.querySelector('#saveLocalData').onclick=()=>{save({backupOld:false,cloud:false});updateLocalSaveStatus();alert('Informações salvas neste aparelho.')};
document.querySelector('#historyEnabled')?.addEventListener('change',e=>{
  state.historySettings={...state.historySettings,enabled:e.target.checked,limit:historyLimit()};
  save({backupOld:false,history:false});
  renderUndoHistory();
});

document.querySelector('#historyLimit')?.addEventListener('change',e=>{
  state.historySettings={...state.historySettings,enabled:state.historySettings?.enabled!==false,limit:Math.min(30,Math.max(5,Number(e.target.value||20)))};
  writeUndoHistory(readUndoHistory());
  save({backupOld:false,history:false});
  renderUndoHistory();
});

document.querySelector('#clearUndoHistory')?.addEventListener('click',()=>{
  if(!confirm('Limpar todo o histórico local de restauração? Os dados financeiros atuais não serão apagados.'))return;
  clearUndoHistory();
});

document.querySelector('#undoQuickBtn')?.addEventListener('click',()=>restoreUndoSnapshot());
document.querySelector('#undoLastChange')?.addEventListener('click',()=>restoreUndoSnapshot());
addEventListener('click',e=>{
  const restore=e.target.closest('[data-undo-index]');
  if(!restore)return;
  restoreUndoSnapshot(Number(restore.dataset.undoIndex));
});
document.querySelector('#exportJson').onclick=()=>{operationStart('Preparando exportação','Gerando o backup completo em JSON…');download(`saldoplan-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2),'application/json');operationFinish('Exportação concluída','O arquivo JSON foi baixado para o seu aparelho.')};
function exportRows(){
  const rows=[['Tipo de registro','Data','Natureza','Categoria','Descrição','Conta / origem','Status','Valor (R$)','Início','Fim','Feriado','ID']];
  state.transactions.forEach(x=>rows.push(['Lançamento',x.date,x.kind==='income'?'Entrada':'Gasto',x.kind==='income'?incomeLabel(x.incomeType):expenseLabel(x.expenseType),x.description,x.imported?`Importado · ${x.importSource||x.importFile||'Extrato'}`:x.kind==='income'?'':x.cardPurchaseId?`Cartão · ${creditCardById(x.cardId)?.name||'Cartão'}`:x.paySource==='flash'?'Flash':'Salário / conta',x.status==='realized'?'Realizado':'Previsto',Number(x.amount||0).toFixed(2).replace('.',','),'','', '',x.id]));
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
document.querySelector('#importJson').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;operationStart('Importando informações','Lendo o arquivo e restaurando seus dados…');try{const data=migrateState(JSON.parse(await f.text()));if(!Array.isArray(data.transactions))throw new Error();createSafetySnapshot('Antes de importar backup');localStorage.setItem(PREVIOUS_KEY,JSON.stringify(state));state=data;save({backupOld:false,history:false});renderAll();operationFinish('Importação concluída','Backup importado sem perder a cópia local anterior.')}catch{operationFinish('Não foi possível importar','O arquivo selecionado não é um backup válido.',true)}e.target.value=''};
document.querySelector('#restorePreviousLocal').onclick=()=>{const old=localStorage.getItem(PREVIOUS_KEY);if(!old){alert('Ainda não existe uma cópia local anterior.');return}if(!confirm('Restaurar a cópia local anterior? O estado atual ficará como a próxima cópia de segurança.'))return;try{const current=JSON.stringify(state);createSafetySnapshot('Antes de restaurar cópia local');state=migrateState(JSON.parse(old));localStorage.setItem(PREVIOUS_KEY,current);save({backupOld:false,history:false});renderAll();alert('Cópia local restaurada.')}catch{alert('Não foi possível restaurar a cópia local.')}};
document.querySelector('#resetData').onclick=()=>{if(!confirm('Apagar os dados deste aparelho? Uma cópia local anterior será mantida.'))return;createSafetySnapshot('Antes de apagar todos os dados');localStorage.setItem(PREVIOUS_KEY,JSON.stringify(state));const keepCloud={...seed.cloud,...state.cloud};const keepSettings={...seed.settings,...state.settings};const keepHistorySettings={...seed.historySettings,...state.historySettings};state=deepClone(seed);state.cloud=keepCloud;state.settings=keepSettings;state.historySettings=keepHistorySettings;state.importNote=false;save({backupOld:false,history:false});renderAll()};
