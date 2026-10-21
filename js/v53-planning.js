/* SaldoPlan 5.3.0 — área de planejamento. Só usa o estado do usuário; sem telemetria. */
(function(){
  'use strict';
  const E=window.SaldoPlanPlanningEngine;
  const byId=id=>document.getElementById(id);
  const isoToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
  const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const planning=()=>state.planningSettings||{openingBalance:0,openingDate:'',alertDays:7};
  const today=()=>isoToday();
  let cardSelection='',lastCardResult=[];
  function getForecast(){
    const pref=planning();return E.forecast(state,{openingBalance:pref.openingBalance||0,date:pref.openingDate||today(),days:90});
  }
  function chart(series){
    if(!series.length)return '';
    const values=series.map(x=>x.balance);
    const min=Math.min(0,...values),max=Math.max(0,...values),spread=Math.max(1,max-min);
    const w=660,h=185,pad=16;
    const points=series.map((row,index)=>`${(pad+index*(w-2*pad)/(series.length-1)).toFixed(1)},${(h-pad-(row.balance-min)*(h-2*pad)/spread).toFixed(1)}`).join(' ');
    const zeroY=(h-pad-(0-min)*(h-2*pad)/spread).toFixed(1);
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Projeção de saldo do dia ${series[0].date} a ${series[series.length-1].date}"><line class="sp53-axis" x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}"/><line class="sp53-zero" x1="${pad}" y1="${zeroY}" x2="${w-pad}" y2="${zeroY}"/><polyline class="sp53-line" points="${points}"/><text x="${pad}" y="12" fill="currentColor" font-size="12">${html(brl(max))}</text><text x="${pad}" y="${h-2}" fill="currentColor" font-size="12">${html(series[0].date.slice(5))}</text><text x="${w-pad}" y="${h-2}" text-anchor="end" fill="currentColor" font-size="12">${html(series[series.length-1].date.slice(5))}</text></svg>`;
  }
  function renderForecast(){
    const pref=planning();
    if(document.activeElement!==byId('sp53Opening'))byId('sp53Opening').value=Number(pref.openingBalance||0).toFixed(2);
    if(document.activeElement!==byId('sp53OpenDate'))byId('sp53OpenDate').value=pref.openingDate||today();
    if(document.activeElement!==byId('sp53AlertDays'))byId('sp53AlertDays').value=String(pref.alertDays||7);
    const entered=!!pref.openingDate;
    byId('sp53OpeningStatus').textContent=entered?`Ponto de partida: ${brl(pref.openingBalance)} em ${pref.openingDate}.`:'Informe seu saldo real acima para obter uma previsão personalizada. O valor inicial de R$ 0,00 é apenas um exemplo.';
    const forecast=getForecast();
    for(const [id,value] of [['sp53At30',forecast.at30],['sp53At60',forecast.at60],['sp53At90',forecast.at90]]){
      byId(id).textContent=entered?brl(value):'Informe seu saldo';
      byId(id).classList.toggle('sp53-negative',entered&&value<0);
    }
    byId('sp53ForecastChart').innerHTML=entered?chart(forecast.series):'<p class="helper">Gráfico disponível depois de informar o saldo inicial.</p>';
    const summary=`${forecast.pendingCount} lançamento(s) pendente(s) considerados nos próximos 90 dias (entradas: ${brl(forecast.income)}; saídas: ${brl(forecast.expense)}). `;
    byId('sp53ForecastHint').textContent=entered?(summary+(forecast.firstNegative?`Atenção: o saldo pode ficar negativo em ${forecast.firstNegative}.`:'Não há saldo negativo previsto nesse período.')+' Não projeta recorrências ainda não criadas; cartões já lançados contam uma vez por parcela.'):'';
  }
  function renderCards(){
    const select=byId('sp53CardSelect'),prev=select.value||cardSelection;
    const cards=Array.isArray(state.creditCards)?state.creditCards.filter(c=>c.active!==false):[];
    select.replaceChildren();
    if(!cards.length)select.add(new Option('Cadastre um cartão primeiro',''));
    for(const card of cards)select.add(new Option(`${card.name||'Cartão'}${card.last4?' ••••'+card.last4:''}`,card.id));
    if(cards.some(c=>c.id===prev))select.value=prev;
    cardSelection=select.value;
    if(!byId('sp53CardDate').value)byId('sp53CardDate').value=today();
    if(!cards.length){byId('sp53CardResult').textContent='Adicione seu primeiro cartão em Cartões para usar esta simulação.';lastCardResult=[];}
  }
  function renderGoals(){
    const goals=E.goals(state,today());const root=byId('sp53Goals');
    root.innerHTML=goals.length?goals.slice(0,15).map(g=>{
      const suffix=g.monthlyAmount!==null?`Guardar aproximadamente ${brl(g.monthlyAmount)} por mês`:'Adicione uma data na meta para calcular o valor mensal';
      return `<div class="sp53-item"><span><strong>${html(g.name)}</strong><small>${html(brl(g.current))} de ${html(brl(g.target))} · faltam ${html(brl(g.remaining))}</small></span><span><strong class="${g.overdue?'sp53-negative':''}">${g.remaining<=0?'Meta atingida':g.overdue?'Prazo ultrapassado':html(suffix)}</strong><small>${g.deadline?'Prazo '+html(g.deadline):'Sem prazo definido'}</small></span></div>`;
    }).join(''):'<p class="helper">Nenhuma meta cadastrada. Crie a primeira em Patrimônio → Metas.</p>';
  }
  function renderAlerts(){
    const list=E.dueAlerts(state,today(),planning().alertDays||7);
    byId('sp53Alerts').innerHTML=list.length?list.slice(0,12).map(t=>`<div class="sp53-item"><span><strong>${html(t.description)}</strong><small>${html(t.date)} ${t.card?'· Parcela de cartão':''}</small></span><strong>${html(brl(t.amount))}</strong></div>`).join(''):'<p class="helper">Nenhuma conta pendente encontrada nesse prazo.</p>';
  }
  function renderBank(){
    const rows=Array.isArray(state.bankChecks)?state.bankChecks:[];
    byId('sp53BankHistory').innerHTML=rows.length?rows.slice(-5).reverse().map(row=>`<div class="sp53-item"><span><strong>${html(row.account)}</strong><small>${html(row.date)} · Extrato ${html(brl(row.bankBalance))} · App ${html(brl(row.recordedBalance))}</small></span><strong class="${Math.abs(Number(row.difference))>0.005?'sp53-negative':'sp53-positive'}">${html(brl(row.difference))}</strong></div>`).join(''):'<p class="helper">Nenhuma conferência salva até agora.</p>';
  }
  function renderConnection(){
    const online=navigator.onLine;
    byId('sp53ConnectionState').textContent=online?'Conexão com a internet disponível. A sincronização depende do login Google e do status exibido em Dados e backup.':'Você está offline. As alterações podem ficar pendentes até a conexão voltar.';
  }
  function render(){if(!byId('view-planning')||!E)return;
    renderForecast();renderCards();renderGoals();renderAlerts();renderBank();renderConnection();
  }
  byId('sp53ForecastForm')?.addEventListener('submit',ev=>{
    ev.preventDefault();const opening=Number(byId('sp53Opening').value),date=byId('sp53OpenDate').value;
    if(!E.validDate(date)||!Number.isFinite(opening)||Math.abs(opening)>1e9){byId('sp53OpeningStatus').textContent='Verifique o saldo e a data.';return;}
    state.planningSettings={openingBalance:E.round(opening),openingDate:date,alertDays:Number(byId('sp53AlertDays').value)||7};
    save({undoLabel:'Atualização do planejamento'});render();
  });
  byId('sp53CardForm')?.addEventListener('submit',ev=>{
    ev.preventDefault();const card=state.creditCards.find(c=>c.id===byId('sp53CardSelect').value);
    try{
      lastCardResult=E.cardSimulation(card,byId('sp53CardAmount').value,Number(byId('sp53CardCount').value),byId('sp53CardDate').value);
      const total=lastCardResult.reduce((v,t)=>v+t.amount,0);
      byId('sp53CardResult').innerHTML=`<p class="helper">Simulação: ${lastCardResult.length} parcela(s), total ${html(brl(total))}. Nada foi cadastrado.</p>`+lastCardResult.slice(0,18).map(p=>`<div class="sp53-item"><span><strong>${p.index}/${lastCardResult.length} · ${html(p.month)}</strong><small>Vencimento ${html(p.date)}</small></span><strong>${html(brl(p.amount))}</strong></div>`).join('')+(lastCardResult.length>18?`<p class="helper">Mais ${lastCardResult.length-18} parcelas não exibidas.</p>`:'');
    }catch(err){byId('sp53CardResult').textContent=err.message;}
  });
  byId('sp53BankForm')?.addEventListener('submit',ev=>{
    ev.preventDefault();const name=byId('sp53BankName').value.trim();
    if(!name||name.length>80){byId('sp53BankResult').textContent='Informe a conta.';return;}
    try{
      const c=E.reconciliation(byId('sp53BankActual').value,byId('sp53BankApp').value);
      state.bankChecks=Array.isArray(state.bankChecks)?state.bankChecks:[];
      state.bankChecks.push({id:uid(),date:today(),account:name,...c});state.bankChecks=state.bankChecks.slice(-40);
      save({undoLabel:'Conferência manual de extrato'});
      byId('sp53BankResult').textContent=c.balanced?'Tudo certo: os saldos informados coincidem.':`Diferença encontrada: ${brl(c.difference)}. Verifique lançamentos pendentes, duplicidades e movimentações não importadas.`;
      renderBank();
    }catch(err){byId('sp53BankResult').textContent='Informe dois saldos válidos.';}
  });
  byId('sp53Print')?.addEventListener('click',()=>{
    const f=getForecast();const pref=planning();
    if(!pref.openingDate){byId('sp53OpeningStatus').textContent='Informe e salve o saldo inicial para gerar o relatório.';return;}
    const popup=window.open('','_blank');if(!popup){byId('sp53OpeningStatus').textContent='Permita uma nova aba para imprimir.';return;}
    const content=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>SaldoPlan · Planejamento</title><style>body{font:16px Arial;margin:40px;color:#172033}p{line-height:1.5}</style><h1>SaldoPlan · Planejamento</h1><p>Saldo em ${html(pref.openingDate)}: <b>${html(brl(f.openingBalance))}</b></p><p>30 dias: <b>${html(brl(f.at30))}</b></p><p>60 dias: <b>${html(brl(f.at60))}</b></p><p>90 dias: <b>${html(brl(f.at90))}</b></p><p>Entradas previstas: ${html(brl(f.income))} · Despesas previstas: ${html(brl(f.expense))}.</p><p>Primeiro saldo negativo: ${html(f.firstNegative||'nenhum no período')}</p><hr><small>Estimativa baseada em lançamentos previstos; não equivale a extrato bancário. Não inclui recorrências ainda não geradas.</small><script>window.onload=()=>window.print();<\/script></html>`;
    popup.document.open();popup.document.write(content);popup.document.close();
  });
  window.addEventListener('online',renderConnection);
  window.addEventListener('offline',renderConnection);
  window.saldoPlanRenderPlanning=render;
})();
