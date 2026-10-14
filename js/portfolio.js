function ensurePortfolioState(){
  if(!Array.isArray(state.investments)){
    state.investments=[];
  }
  return state.investments;
}

function portfolioTypeLabel(type){
  const labels={
    cdb:'CDB',
    lci:'LCI',
    lca:'LCA',
    treasury:'Tesouro Direto',
    stock:'Ação',
    fii:'FII',
    etf:'ETF',
    fund:'Fundo',
    savings:'Poupança',
    other:'Outro'
  };
  return labels[type]||'Outro';
}

function portfolioLiquidityLabel(value){
  const labels={
    daily:'Liquidez diária',
    maturity:'No vencimento',
    market:'Venda / mercado',
    other:'Outra liquidez'
  };
  return labels[value]||'Não informado';
}

function portfolioFgcLabel(value){
  if(value==='yes')return 'FGC: sim';
  if(value==='no')return 'FGC: não';
  return 'FGC: n/a';
}

function portfolioDateLabel(value){
  if(!value)return 'Sem data';
  const parts=String(value).split('-');
  if(parts.length!==3)return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function portfolioMetrics(){
  const investments=ensurePortfolioState();
  const active=investments.filter(x=>x.status!=='redeemed');

  const invested=active.reduce((total,x)=>total+Number(x.invested||0),0);
  const current=active.reduce((total,x)=>total+Number(x.current||0),0);
  const gain=current-invested;
  const returnPct=invested>0?(gain/invested)*100:0;

  return {active,invested,current,gain,returnPct};
}

function renderPortfolioSummary(){
  const metrics=portfolioMetrics();

  const currentEl=document.querySelector('#dashboardPortfolioCurrent');
  const gainEl=document.querySelector('#dashboardPortfolioGain');
  const countEl=document.querySelector('#dashboardPortfolioCount');

  if(currentEl)currentEl.textContent=fmt.format(metrics.current);

  if(gainEl){
    gainEl.textContent=`${metrics.gain>=0?'+ ':''}${fmt.format(metrics.gain)}`;
    gainEl.classList.toggle('portfolio-positive',metrics.gain>0);
    gainEl.classList.toggle('portfolio-negative',metrics.gain<0);
  }

  if(countEl)countEl.textContent=String(metrics.active.length);
}

function portfolioAllocationRows(active){
  const groups=new Map();

  active.forEach(item=>{
    const key=item.type||'other';
    groups.set(key,(groups.get(key)||0)+Number(item.current||0));
  });

  const total=[...groups.values()].reduce((a,b)=>a+b,0);

  return [...groups.entries()]
    .map(([type,value])=>({
      type,
      value,
      pct:total>0?(value/total)*100:0
    }))
    .sort((a,b)=>b.value-a.value);
}

function renderPortfolio(){
  const investments=ensurePortfolioState();
  const metrics=portfolioMetrics();

  setMoney('portfolioInvested',metrics.invested);
  setMoney('portfolioCurrent',metrics.current);

  const gainEl=document.querySelector('#portfolioGain');
  if(gainEl){
    gainEl.textContent=`${metrics.gain>=0?'+ ':''}${fmt.format(metrics.gain)}`;
    gainEl.classList.toggle('portfolio-positive',metrics.gain>0);
    gainEl.classList.toggle('portfolio-negative',metrics.gain<0);
  }

  const returnEl=document.querySelector('#portfolioReturn');
  if(returnEl){
    returnEl.textContent=`${metrics.returnPct>=0?'+':''}${marketNumber(metrics.returnPct)}%`;
    returnEl.classList.toggle('portfolio-positive',metrics.returnPct>0);
    returnEl.classList.toggle('portfolio-negative',metrics.returnPct<0);
  }

  const allocation=document.querySelector('#portfolioAllocation');

  if(allocation){
    const rows=portfolioAllocationRows(metrics.active);

    allocation.innerHTML=rows.length
      ?rows.map(row=>`
        <div class="portfolio-allocation-row">
          <div class="portfolio-allocation-head">
            <strong>${escapeHtml(portfolioTypeLabel(row.type))}</strong>
            <span>${marketNumber(row.pct)}% · ${fmt.format(row.value)}</span>
          </div>
          <div class="portfolio-allocation-track">
            <span style="width:${Math.max(1,Math.min(100,row.pct))}%"></span>
          </div>
        </div>
      `).join('')
      :'<div class="empty">Cadastre um investimento para começar.</div>';
  }

  const upcoming=document.querySelector('#portfolioUpcoming');

  if(upcoming){
    const todayKey=new Date().toISOString().slice(0,10);

    const rows=metrics.active
      .filter(x=>x.maturityDate && x.maturityDate>=todayKey)
      .sort((a,b)=>String(a.maturityDate).localeCompare(String(b.maturityDate)))
      .slice(0,5);

    upcoming.innerHTML=rows.length
      ?rows.map(item=>`
        <button type="button" class="portfolio-upcoming-item" data-investment-edit="${escapeHtml(item.id)}">
          <span>
            <strong>${escapeHtml(item.product||'Investimento')}</strong>
            <small>${escapeHtml(item.institution||'Instituição não informada')}</small>
          </span>
          <span class="portfolio-upcoming-date">${escapeHtml(portfolioDateLabel(item.maturityDate))}</span>
        </button>
      `).join('')
      :'<div class="empty">Nenhum vencimento futuro cadastrado.</div>';
  }

  const filter=document.querySelector('#portfolioFilter')?.value||'active';

  let rows=[...investments];

  if(filter==='active'){
    rows=rows.filter(x=>x.status!=='redeemed');
  }else if(filter==='redeemed'){
    rows=rows.filter(x=>x.status==='redeemed');
  }

  rows.sort((a,b)=>{
    const statusA=a.status==='redeemed'?1:0;
    const statusB=b.status==='redeemed'?1:0;
    if(statusA!==statusB)return statusA-statusB;
    return String(a.product||'').localeCompare(String(b.product||''),'pt-BR');
  });

  const list=document.querySelector('#portfolioList');

  if(list){
    list.innerHTML=rows.length
      ?rows.map(item=>{
        const invested=Number(item.invested||0);
        const current=Number(item.current||0);
        const gain=current-invested;
        const pct=invested>0?(gain/invested)*100:0;

        return `
          <article class="portfolio-item ${item.status==='redeemed'?'portfolio-item-redeemed':''}">
            <button type="button" class="portfolio-item-main" data-investment-edit="${escapeHtml(item.id)}">
              <span class="portfolio-item-title">
                <strong>${escapeHtml(item.product||'Investimento')}</strong>
                <small>${escapeHtml(item.institution||'Instituição não informada')}</small>
              </span>

              <span class="portfolio-item-values">
                <strong>${fmt.format(current)}</strong>
                <small class="${gain>0?'portfolio-positive':gain<0?'portfolio-negative':''}">
                  ${gain>=0?'+ ':''}${fmt.format(gain)} · ${pct>=0?'+':''}${marketNumber(pct)}%
                </small>
              </span>
            </button>

            <div class="portfolio-item-meta">
              <span>${escapeHtml(portfolioTypeLabel(item.type))}</span>
              <span>${escapeHtml(item.rate||'Taxa não informada')}</span>
              <span>${escapeHtml(portfolioLiquidityLabel(item.liquidity))}</span>
              <span>${escapeHtml(portfolioFgcLabel(item.fgc))}</span>
              ${item.maturityDate?`<span>Vence ${escapeHtml(portfolioDateLabel(item.maturityDate))}</span>`:''}
              ${item.status==='redeemed'?'<span>Encerrado</span>':''}
            </div>
          </article>
        `;
      }).join('')
      :'<div class="empty">Nenhum investimento neste filtro.</div>';
  }

  renderPortfolioSummary();
}

const portfolioDlg=document.querySelector('#portfolioDialog');
const portfolioForm=document.querySelector('#portfolioForm');

function openPortfolio(obj=null){
  ensurePortfolioState();
  portfolioForm.reset();

  document.querySelector('#portfolioId').value=obj?.id||'';
  document.querySelector('#portfolioFormTitle').textContent=obj?'Editar investimento':'Novo investimento';

  document.querySelector('#portfolioInstitution').value=obj?.institution||'';
  document.querySelector('#portfolioProduct').value=obj?.product||'';
  document.querySelector('#portfolioType').value=obj?.type||'cdb';
  document.querySelector('#portfolioStatus').value=obj?.status||'active';

  document.querySelector('#portfolioInvestedAmount').value=obj
    ?Number(obj.invested||0).toFixed(2).replace('.',',')
    :'';

  document.querySelector('#portfolioCurrentAmount').value=obj
    ?Number(obj.current||obj.invested||0).toFixed(2).replace('.',',')
    :'';

  document.querySelector('#portfolioStartDate').value=obj?.startDate||baseDate();
  document.querySelector('#portfolioMaturityDate').value=obj?.maturityDate||'';
  document.querySelector('#portfolioBenchmark').value=obj?.benchmark||'cdi';
  document.querySelector('#portfolioRate').value=obj?.rate||'';
  document.querySelector('#portfolioLiquidity').value=obj?.liquidity||'daily';
  document.querySelector('#portfolioFgc').value=obj?.fgc||'yes';
  document.querySelector('#portfolioNotes').value=obj?.notes||'';

  document.querySelector('#deletePortfolio').classList.toggle('hidden',!obj);

  portfolioDlg.showModal();
}

document.querySelector('#portfolioNewBtn')?.addEventListener('click',()=>openPortfolio());
document.querySelector('#closePortfolioDialog')?.addEventListener('click',()=>portfolioDlg.close());
document.querySelector('#cancelPortfolio')?.addEventListener('click',()=>portfolioDlg.close());

document.querySelector('#portfolioFilter')?.addEventListener('change',renderPortfolio);

addEventListener('click',e=>{
  const edit=e.target.closest('[data-investment-edit]');
  if(!edit)return;

  const item=ensurePortfolioState().find(x=>x.id===edit.dataset.investmentEdit);
  if(item)openPortfolio(item);
});

portfolioForm?.addEventListener('submit',e=>{
  e.preventDefault();

  ensurePortfolioState();

  const id=document.querySelector('#portfolioId').value;
  const invested=money(document.querySelector('#portfolioInvestedAmount').value);
  const currentRaw=document.querySelector('#portfolioCurrentAmount').value.trim();
  const current=currentRaw?money(currentRaw):invested;

  const obj={
    id:id||uid(),
    institution:document.querySelector('#portfolioInstitution').value.trim(),
    product:document.querySelector('#portfolioProduct').value.trim(),
    type:document.querySelector('#portfolioType').value,
    status:document.querySelector('#portfolioStatus').value,
    invested,
    current,
    startDate:document.querySelector('#portfolioStartDate').value,
    maturityDate:document.querySelector('#portfolioMaturityDate').value,
    benchmark:document.querySelector('#portfolioBenchmark').value,
    rate:document.querySelector('#portfolioRate').value.trim(),
    liquidity:document.querySelector('#portfolioLiquidity').value,
    fgc:document.querySelector('#portfolioFgc').value,
    notes:document.querySelector('#portfolioNotes').value.trim(),
    updatedAt:new Date().toISOString()
  };

  if(!obj.institution||!obj.product||!(obj.invested>0)){
    alert('Informe instituição, produto e valor aplicado.');
    return;
  }

  const ix=state.investments.findIndex(x=>x.id===id);

  if(ix>=0){
    state.investments[ix]=obj;
  }else{
    state.investments.push(obj);
  }

  save();
  portfolioDlg.close();
  renderAll();
});

document.querySelector('#deletePortfolio')?.addEventListener('click',()=>{
  const id=document.querySelector('#portfolioId').value;

  if(!id||!confirm('Excluir este investimento da carteira?'))return;

  ensurePortfolioState();
  state.investments=state.investments.filter(x=>x.id!==id);

  save();
  portfolioDlg.close();
  renderAll();
});

function placePortfolioDashboardPanel(){
  const panel=document.querySelector('.portfolio-dashboard-panel');
  const dashboard=document.querySelector('#view-dashboard');

  if(!panel||!dashboard||panel.parentElement===dashboard)return;

  const pendingList=dashboard.querySelector('#pendingList');
  const pendingPanel=pendingList?.closest('.panel');

  if(pendingPanel){
    dashboard.insertBefore(panel,pendingPanel);
  }else{
    dashboard.appendChild(panel);
  }
}

placePortfolioDashboardPanel();
