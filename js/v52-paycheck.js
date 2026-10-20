/* SaldoPlan v5.2.0 - interface de conferência mensal do contracheque. */
(function(){
  'use strict';
  const engine=window.SaldoPlanPaycheckEngine;
  const root=document.getElementById('sp52Check');
  if(!engine||!root)return;
  const $=(sel)=>root.querySelector(sel);
  const fmtMoney=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
  const labels={salary:'Salário-base',v50:'Hora extra 50%',v100:'Hora extra 100%',night:'Adicional noturno',dsr:'DSR sobre extras',gross:'Total bruto',inss:'INSS',irrf:'IRRF',advance:'Adiantamento',final:'Líquido a receber'};
  const keys=engine.fields;
  const moneyInput=value=>value===null||value===undefined?'':Number(value).toFixed(2).replace('.',',');
  function parseMoney(value){
    const text=String(value||'').trim().replace(/R\$\s*/g,'').replace(/\s+/g,'');
    if(!text)return null;
    const n=Number(text.includes(',')?text.replace(/\./g,'').replace(',','.'):text);
    if(!Number.isFinite(n)||n<0)throw new Error('Digite valores monetários não negativos.');
    return Math.round((n+Number.EPSILON)*100)/100;
  }
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function hhmm(num){const minutes=Math.round(Number(num||0)*60);return `${Math.floor(minutes/60)}:${String(minutes%60).padStart(2,'0')}`;}
  function initialHours(p){return {h50:hhmm(p.h50),h100:hhmm(p.h100),night:hhmm(p.night)};}
  function record(){return state.payrollMonths?.[simKey()]?.paycheckAudit||null;}
  function actualValues(){
    const result={};for(const key of keys){result[key]=parseMoney($(`[data-sp52-actual="${key}"]`).value)}return result;
  }
  function configValues(){return {mode:$('#sp52Format').value,h50:$('#sp52Hour50').value.trim(),h100:$('#sp52Hour100').value.trim(),night:$('#sp52HourNight').value.trim(),restDays:Number($('#sp52Rest').value),workDays:Number($('#sp52Work').value)};}
  function estimated(sim){return {salary:sim.baseSalary,v50:sim.v50,v100:sim.v100,night:sim.nightValue,dsr:sim.dsr,gross:sim.gross,inss:sim.inss,irrf:sim.ir.value,advance:sim.advance,final:sim.finalPay};}
  function tableRows(value,actual){
    return engine.deltaTable(value,actual).map(item=>{
      const difference=item.delta===null?'—':fmtMoney(item.delta);
      return `<tr><th scope="row">${labels[item.key]}</th><td>${fmtMoney(item.estimate)}</td><td>${item.actual===null?'—':fmtMoney(item.actual)}</td><td>${difference}</td></tr>`;
    }).join('');
  }
  function calculate(){
    const data=configValues(),sim=payrollSimulation();
    const config=state.payrollConfig;
    const result=engine.calcFromHours({salary:Number(sim.baseSalary),monthlyHours:Number(config.monthlyHours),nightPct:Number(config.nightPct),advance:Number(config.advance),restDays:data.restDays,workDays:data.workDays},data,data.mode,{inss:inss2026,irrf:(gross,inss)=>irrf2026(gross,inss).value});
    return {data,result,sim};
  }
  function preview(){
    const status=$('#sp52CheckStatus');
    try{
      const {data,result,sim}=calculate();
      const actual=actualValues();
      $('#sp52Comparison').innerHTML=tableRows(result,actual);
      $('#sp52Estimate').textContent=fmtMoney(sim.finalPay);
      $('#sp52Reference').textContent=fmtMoney(result.final);
      $('#sp52Actual').textContent=actual.final===null?'Não informado':fmtMoney(actual.final);
      $('#sp52Difference').textContent=actual.final===null?'—':fmtMoney(result.final-actual.final);
      const inconsistency=engine.checkOfficial(actual);
      const notes=[];
      if(sim.imported)notes.push('A simulação principal está usando uma folha importada. A referência acima é calculada separadamente.');
      if(inconsistency!==null&&Math.abs(inconsistency)>0.02)notes.push(`Os itens oficiais informados diferem do total bruto em ${fmtMoney(inconsistency)}. Confira se há outras rubricas na folha.`);
      notes.push(`Referência calculada com ${data.restDays} DSR e ${data.workDays} dias no divisor. O modo escolhido interpreta as horas como ${data.mode==='hhmm'?'horas e minutos':'decimais'}.`);
      status.textContent=notes.join(' ');
      return {data,result,sim,actual};
    }catch(e){status.textContent=e.message||'Revise os campos.';$('#sp52Comparison').innerHTML='';return null;}
  }
  function renderHistory(){
    const rows=Object.entries(state.payrollMonths||{}).filter(([,m])=>m?.paycheckAudit).sort((a,b)=>b[0].localeCompare(a[0]));
    $('#sp52History').innerHTML=rows.length?rows.map(([month,m])=>{
      const a=m.paycheckAudit,fin=a.actual?.final,estimate=a.reference?.final;
      return `<tr><td><button type="button" class="btn ghost small" data-sp52-month="${esc(month)}">${esc(month.slice(5))}/${esc(month.slice(0,4))}</button></td><td>${estimate===undefined?'—':fmtMoney(estimate)}</td><td>${fin===null||fin===undefined?'—':fmtMoney(fin)}</td><td>${fin===null||fin===undefined||estimate===undefined?'—':fmtMoney(estimate-fin)}</td></tr>`;
    }).join(''):'<tr><td colspan="4">Nenhuma conferência salva.</td></tr>';
  }
  function render(){
    const p=payrollSimulation(), r=record();
    const data=r?.data||{mode:'hhmm',...initialHours(p),restDays:p.restDays,workDays:p.workDays};
    $('#sp52Format').value=data.mode||'hhmm';
    for(const [k,id] of [['h50','#sp52Hour50'],['h100','#sp52Hour100'],['night','#sp52HourNight']])$(id).value=String(data[k]??'');
    $('#sp52Rest').value=data.restDays??p.restDays;
    $('#sp52Work').value=data.workDays??p.workDays;
    const actual=r?.actual||{};
    for(const key of keys)$(`[data-sp52-actual="${key}"]`).value=moneyInput(actual[key]);
    $('#sp52Saved').textContent=r?.savedAt?'Conferência salva para este mês.':'Conferência não salva. Preencha os valores da folha oficial para comparar.';
    $('#sp52Hour50').placeholder=data.mode==='hhmm'?'42:46':'42,46';
    $('#sp52Hour100').placeholder=data.mode==='hhmm'?'10:40':'10,40';
    $('#sp52HourNight').placeholder=data.mode==='hhmm'?'9:10':'9,10';
    preview();renderHistory();
  }
  function saveCheck(){
    const result=preview();if(!result){alert('Corrija os campos destacados antes de salvar.');return;}
    const month=payrollMonthConfig();
    month.paycheckAudit={data:result.data,actual:result.actual,reference:result.result,savedAt:new Date().toISOString(),source:'user-reviewed'};
    save();
    $('#sp52Saved').textContent='Conferência salva neste mês e disponível entre seus aparelhos quando sincronizados.';
    renderHistory();
  }
  function useImported(){
    const value=payrollMonthConfig(simKey(),false).importedPayroll;
    if(!value){alert('Nenhuma folha importada nesta competência.');return;}
    const pairs={salary:value.baseSalary,gross:value.gross,inss:value.inss,irrf:value.irrf,advance:value.advance,final:value.finalPay};
    Object.entries(pairs).forEach(([key,n])=>{if(n!==null&&n!==undefined)$(`[data-sp52-actual="${key}"]`).value=moneyInput(n)});
    preview();
  }
  function openPrint(){
    const context=preview();if(!context)return;
    const printable=tableRows(context.result,context.actual);
    const title=`Conferência de contracheque — ${simKey()}`;
    const w=window.open('','_blank');if(!w){alert('Libere a janela de impressão no navegador.');return;}
    w.document.open();w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:14px Arial;margin:30px;color:#222}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:9px;text-align:right}th:first-child{text-align:left}thead{background:#eee}p{color:#555}@media print{button{display:none}}</style></head><body><h1>${esc(title)}</h1><p>Formato: ${context.data.mode==='hhmm'?'horas e minutos':'horas decimais'} · DSR: ${context.data.restDays}/${context.data.workDays}. Comparação informativa, sujeita às regras da folha oficial.</p><table><thead><tr><th>Rubrica</th><th>Calculado</th><th>Folha real</th><th>Diferença</th></tr></thead><tbody>${printable}</tbody></table><p>Diferença = calculado − folha real. Campos não preenchidos não são comparados.</p><button onclick="window.print()">Imprimir / salvar como PDF</button></body></html>`);w.document.close();
  }
  root.addEventListener('input',event=>{
    if(event.target.closest('input,select'))preview();
  });
  root.addEventListener('change',event=>{
    if(event.target.id==='sp52Format'){
      const mode=event.target.value;
      const previous=mode==='decimal'?'hhmm':'decimal';
      for(const id of ['#sp52Hour50','#sp52Hour100','#sp52HourNight']){
        const node=$(id);const value=String(node.value).trim();
        if(value){try{const hours=engine.parseHours(value,previous);node.value=mode==='hhmm'?hhmm(hours):hours.toFixed(4).replace(/0+$/,'').replace(/\.$/,'').replace('.',',');}catch{node.value='';}}
      }
      $('#sp52Hour50').placeholder=mode==='hhmm'?'42:46':'42,46';
      $('#sp52Hour100').placeholder=mode==='hhmm'?'10:40':'10,40';
      $('#sp52HourNight').placeholder=mode==='hhmm'?'9:10':'9,10';
    }
    preview();
  });
  root.addEventListener('click',event=>{
    if(event.target.closest('#sp52Save'))saveCheck();
    if(event.target.closest('#sp52Imported'))useImported();
    if(event.target.closest('#sp52Print'))openPrint();
    const btn=event.target.closest('[data-sp52-month]');if(btn){const [y,m]=btn.dataset.sp52Month.split('-').map(Number);simCursor=new Date(y,m-1,1);renderSimulator();}
  });
  // O app chama renderSimulator() quando a competência e o perfil mudam.
  const original=window.renderSimulator;
  if(typeof original==='function'){
    window.renderSimulator=function(){const out=original.apply(this,arguments);render();return out;};
  }
  render();
})();
