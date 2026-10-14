let marketData=null;
let marketNews=[];
let marketLoading=false;

function marketNumber(value,digits=2){
  const n=Number(value);
  if(!Number.isFinite(n))return '--';
  return n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
}

function marketMoney(value){
  const n=Number(value);
  return Number.isFinite(n)?fmt.format(n):'--';
}

function marketReadCache(){
  try{
    const raw=localStorage.getItem(MARKET_CACHE_KEY);
    if(!raw)return null;
    const data=JSON.parse(raw);
    if(!data||typeof data!=='object')return null;
    return data;
  }catch{
    return null;
  }
}

function marketWriteCache(data){
  try{
    localStorage.setItem(MARKET_CACHE_KEY,JSON.stringify({
      savedAt:Date.now(),
      market:data.market,
      news:data.news
    }));
  }catch{}
}

function marketFormatReference(value){
  if(!value)return 'sem referência';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  return d.toLocaleString('pt-BR');
}


let marketChartMetric='selic';

function marketHistoryConfig(metric){
  const configs={
    selic:{
      key:'selic',
      label:'Selic',
      suffix:'% a.a.',
      changeSuffix:' p.p.',
      source:'Banco Central do Brasil · SGS 1178',
      format:value=>`${marketNumber(value)}% a.a.`
    },
    dollar:{
      key:'dollar',
      label:'Dólar venda',
      suffix:'',
      changeSuffix:'',
      source:'Banco Central do Brasil · SGS 1',
      format:value=>marketMoney(value)
    },
    ipca:{
      key:'ipca',
      label:'IPCA mensal',
      suffix:'%',
      changeSuffix:' p.p.',
      source:'Banco Central do Brasil / IBGE · SGS 433',
      format:value=>`${marketNumber(value)}%`
    }
  };

  return configs[metric]||configs.selic;
}

function marketHistoryRows(data,metric){
  const config=marketHistoryConfig(metric);
  const rows=Array.isArray(data?.history?.[config.key])
    ?data.history[config.key]
    :[];

  return rows
    .map(row=>({
      date:String(row.date||''),
      value:Number(row.value)
    }))
    .filter(row=>row.date&&Number.isFinite(row.value));
}

function marketChartValueChange(metric,first,last){
  const diff=last-first;

  if(metric==='dollar'){
    const sign=diff>0?'+ ':diff<0?'- ':'';
    return `${sign}${marketMoney(Math.abs(diff))}`;
  }

  const sign=diff>0?'+':diff<0?'':'';
  return `${sign}${marketNumber(diff)} p.p.`;
}

function marketSvgPoint(value,min,max,index,count,width,height,padX,padY){
  const x=count<=1
    ?width/2
    :padX+(index/(count-1))*(width-padX*2);

  const range=max-min;
  const normalized=range===0?0.5:(value-min)/range;
  const y=height-padY-normalized*(height-padY*2);

  return {x,y};
}

function renderMarketHistory(data){
  const root=document.querySelector('#marketHistoryChart');
  if(!root)return;

  const config=marketHistoryConfig(marketChartMetric);
  const rows=marketHistoryRows(data,marketChartMetric);

  document.querySelectorAll('[data-market-chart]').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.marketChart===marketChartMetric);
  });

  const source=document.querySelector('#marketChartSource');
  if(source)source.textContent=`Fonte: ${config.source}.`;

  if(rows.length<2){
    root.innerHTML='<div class="empty">Histórico insuficiente para montar o gráfico agora.</div>';
    document.querySelector('#marketChartCurrent').textContent='--';
    document.querySelector('#marketChartChange').textContent='--';
    return;
  }

  const values=rows.map(row=>row.value);
  const min=Math.min(...values);
  const max=Math.max(...values);
  const first=rows[0];
  const last=rows[rows.length-1];

  document.querySelector('#marketChartCurrent').textContent=config.format(last.value);
  document.querySelector('#marketChartChange').textContent=marketChartValueChange(
    marketChartMetric,
    first.value,
    last.value
  );

  document.querySelector('#marketChartPeriod').textContent=
    `${first.date} → ${last.date} · ${rows.length} observações`;

  const width=760;
  const height=230;
  const padX=52;
  const padY=30;

  const points=rows.map((row,index)=>({
    ...marketSvgPoint(row.value,min,max,index,rows.length,width,height,padX,padY),
    ...row
  }));

  const path=points
    .map((point,index)=>`${index===0?'M':'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const area=`${path} L ${points[points.length-1].x.toFixed(2)} ${(height-padY).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height-padY).toFixed(2)} Z`;

  const mid=(min+max)/2;

  root.innerHTML=`
    <svg class="market-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(config.label)} de ${escapeHtml(first.date)} até ${escapeHtml(last.date)}">
      <line class="market-chart-grid" x1="${padX}" y1="${padY}" x2="${width-padX}" y2="${padY}"></line>
      <line class="market-chart-grid" x1="${padX}" y1="${height/2}" x2="${width-padX}" y2="${height/2}"></line>
      <line class="market-chart-grid" x1="${padX}" y1="${height-padY}" x2="${width-padX}" y2="${height-padY}"></line>

      <text class="market-chart-label" x="6" y="${padY+4}">${escapeHtml(config.format(max))}</text>
      <text class="market-chart-label" x="6" y="${height/2+4}">${escapeHtml(config.format(mid))}</text>
      <text class="market-chart-label" x="6" y="${height-padY+4}">${escapeHtml(config.format(min))}</text>

      <path class="market-chart-area" d="${area}"></path>
      <path class="market-chart-line" d="${path}"></path>

      <circle class="market-chart-dot" cx="${points[points.length-1].x}" cy="${points[points.length-1].y}" r="4"></circle>

      <text class="market-chart-date" x="${padX}" y="${height-7}">${escapeHtml(first.date)}</text>
      <text class="market-chart-date market-chart-date-end" x="${width-padX}" y="${height-7}">${escapeHtml(last.date)}</text>
    </svg>
  `;
}

document.querySelectorAll('[data-market-chart]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    marketChartMetric=btn.dataset.marketChart||'selic';
    if(marketData)renderMarketHistory(marketData);
  });
});
function marketScenario(data){
  const selic=Number(data?.indicators?.selic?.value);
  const ipca=Number(data?.indicators?.ipca12m?.value);

  let tag='Cenário misto';
  let text='Compare rentabilidade, liquidez, prazo e risco antes de escolher um produto.';

  if(Number.isFinite(selic)){
    if(selic>=10){
      tag='Juros elevados';
      text='Com juros em nível elevado, produtos pós-fixados e títulos ligados a taxas de curto prazo ficam especialmente relevantes para comparação.';
    }else if(selic>=7){
      tag='Juros intermediários';
      text='O nível de juros ainda torna a renda fixa importante na comparação, mas prazo, inflação e liquidez ganham peso.';
    }else{
      tag='Juros mais baixos';
      text='Com juros mais baixos, compare com atenção o retorno real acima da inflação, o prazo e o risco assumido.';
    }
  }

  const facts=[];

  if(Number.isFinite(selic)){
    facts.push(`Selic de ${marketNumber(selic)}% a.a.`);
  }

  if(Number.isFinite(ipca)){
    facts.push(`IPCA acumulado aproximado em 12 meses: ${marketNumber(ipca)}%`);
  }

  if(Number.isFinite(selic)&&Number.isFinite(ipca)){
    const real=((1+selic/100)/(1+ipca/100)-1)*100;
    facts.push(`Juro real simples de referência: ${marketNumber(real)}% a.a.`);
  }

  return {tag,text,facts};
}

function renderMarketData(data,fromCache=false){
  if(!data)return;

  marketData=data;

  const selic=data.indicators?.selic;
  const dollar=data.indicators?.dollar;
  const ipca=data.indicators?.ipca12m;

  const selicEl=document.querySelector('#marketSelic');
  const dollarEl=document.querySelector('#marketDollar');
  const ipcaEl=document.querySelector('#marketIpca');
  const countEl=document.querySelector('#marketTreasuryCount');

  if(selicEl)selicEl.textContent=Number.isFinite(Number(selic?.value))?`${marketNumber(selic.value)}% a.a.`:'--';
  if(dollarEl)dollarEl.textContent=Number.isFinite(Number(dollar?.value))?marketMoney(dollar.value):'--';
  if(ipcaEl)ipcaEl.textContent=Number.isFinite(Number(ipca?.value))?`${marketNumber(ipca.value)}%`:'--';

  document.querySelector('#marketSelicDate').textContent=selic?.date?`Ref. ${selic.date}`:'Banco Central';
  document.querySelector('#marketDollarDate').textContent=dollar?.date?`Ref. ${dollar.date}`:'Banco Central';
  document.querySelector('#marketIpcaDate').textContent=ipca?.reference?`Até ${ipca.reference}`:'Últimos dados';

  const generated=data.generatedAt?new Date(data.generatedAt):null;
  const freshness=document.querySelector('#marketFreshness');

  if(freshness){
    freshness.textContent=generated&&!Number.isNaN(generated.getTime())
      ?`${fromCache?'Último dado salvo':'Atualizado'} em ${generated.toLocaleString('pt-BR')}`
      :(fromCache?'Exibindo último dado salvo':'Dados atualizados');
  }

  renderMarketHistory(data);

  const scenario=marketScenario(data);
  document.querySelector('#marketScenarioTag').textContent=scenario.tag;
  document.querySelector('#marketScenarioText').textContent=scenario.text;
  document.querySelector('#marketScenarioFacts').innerHTML=scenario.facts.length
    ?scenario.facts.map(x=>`<span>${escapeHtml(x)}</span>`).join('')
    :'<span>Aguardando indicadores.</span>';

  const refInput=document.querySelector('#marketReferenceRate');

  if(refInput && !refInput.dataset.userEdited && Number.isFinite(Number(selic?.value))){
    refInput.value=Number(selic.value).toFixed(2).replace('.',',');
  }

  updateMarketComparison();
}

function marketCategoryLabel(category){
  const labels={
    'renda-fixa':'Renda fixa',
    'juros':'Juros / inflação',
    'tesouro':'Tesouro',
    'bancos':'Bancos',
    'bolsa':'Bolsa',
    'regulacao':'CVM / regulação',
    'mercado':'Mercado'
  };

  return labels[category]||'Mercado';
}

function renderMarketNews(){
  const root=document.querySelector('#marketNewsList');
  if(!root)return;

  const filter=document.querySelector('#marketNewsFilter')?.value||'all';

  const rows=marketNews.filter(n=>filter==='all'||n.category===filter);

  root.innerHTML=rows.length
    ?rows.slice(0,20).map(n=>`
      <a class="market-news-item" href="${escapeHtml(n.url||'#')}" target="_blank" rel="noopener noreferrer">
        <span class="market-news-meta">
          <b>${escapeHtml(n.source||'Fonte')}</b>
          <span>${escapeHtml(marketCategoryLabel(n.category))}</span>
          <span class="market-news-impact">${escapeHtml(n.impact||'Acompanhar contexto')}</span>
          <time>${escapeHtml(n.publishedLabel||'')}</time>
        </span>
        <strong>${escapeHtml(n.title||'Notícia')}</strong>
      </a>
    `).join('')
    :'<div class="empty">Nenhuma notícia nessa categoria agora.</div>';
}

function updateMarketComparison(){
  const amount=money(document.querySelector('#marketCompareAmount')?.value||0);
  const months=Math.max(1,Math.min(600,Number(document.querySelector('#marketCompareMonths')?.value||12)));
  const reference=decimal(document.querySelector('#marketReferenceRate')?.value||0);
  const pct=decimal(document.querySelector('#marketOfferPct')?.value||0);

  if(!(amount>0)||!(reference>=0)||!(pct>=0)){
    return;
  }

  const years=months/12;
  const offerAnnual=reference*(pct/100);

  const referenceFinal=amount*Math.pow(1+reference/100,years);
  const offerFinal=amount*Math.pow(1+offerAnnual/100,years);
  const difference=offerFinal-referenceFinal;

  document.querySelector('#marketReferenceResult').textContent=marketMoney(referenceFinal);
  document.querySelector('#marketOfferResult').textContent=marketMoney(offerFinal);
  document.querySelector('#marketDifferenceResult').textContent=`${difference>=0?'+ ':''}${marketMoney(difference)}`;
}


const TREASURY_CACHE_KEY='saldoplan.treasury.cache.v1';
const TREASURY_CACHE_TTL=6*60*60*1000;
let treasuryLoading=false;

function treasuryReadCache(){
  try{
    const raw=localStorage.getItem(TREASURY_CACHE_KEY);
    if(!raw)return null;

    const data=JSON.parse(raw);
    return data&&typeof data==='object'?data:null;
  }catch{
    return null;
  }
}

function treasuryWriteCache(data){
  try{
    localStorage.setItem(
      TREASURY_CACHE_KEY,
      JSON.stringify({
        savedAt:Date.now(),
        data
      })
    );
  }catch{}
}

function renderTreasury(data,fromCache=false){
  const treasury=Array.isArray(data?.items)?data.items:[];

  const countEl=document.querySelector('#marketTreasuryCount');
  const dateEl=document.querySelector('#marketTreasuryDate');
  const list=document.querySelector('#marketTreasuryList');

  if(countEl){
    countEl.textContent=treasury.length
      ?String(treasury.length)
      :'--';
  }

  if(dateEl){
    dateEl.textContent=data?.referenceDate
      ?`Ref. ${data.referenceDate}${fromCache?' · cache':''}`
      :'Última base oficial disponível';
  }

  if(!list)return;

  list.innerHTML=treasury.length
    ?treasury.map(t=>`
      <article class="market-treasury-card">
        <div>
          <strong>${escapeHtml(t.name||'Título público')}</strong>
          <span>Vencimento: ${escapeHtml(t.maturity||'--')}</span>
        </div>
        <div>
          <strong>${Number.isFinite(Number(t.buyRate))?`${marketNumber(t.buyRate)}%`:'--'}</strong>
          <span>${Number.isFinite(Number(t.buyPrice))?marketMoney(t.buyPrice):'Taxa de compra'}</span>
        </div>
      </article>
    `).join('')
    :'<div class="empty">A base oficial do Tesouro não respondeu agora. Tente novamente mais tarde.</div>';
}

async function loadTreasury(force=false){
  if(treasuryLoading)return;

  const cache=treasuryReadCache();

  if(cache?.data){
    renderTreasury(cache.data,true);

    if(
      !force &&
      Date.now()-Number(cache.savedAt||0)<TREASURY_CACHE_TTL
    ){
      return;
    }
  }else{
    const list=document.querySelector('#marketTreasuryList');

    if(list){
      list.innerHTML='<div class="empty">Consultando a base oficial do Tesouro...</div>';
    }
  }

  treasuryLoading=true;

  try{
    const response=await fetch('/api/treasury',{
      cache:'no-store'
    });

    if(!response.ok){
      throw new Error(`Tesouro HTTP ${response.status}`);
    }

    const data=await response.json();

    renderTreasury(data,false);
    treasuryWriteCache(data);
  }catch(error){
    console.warn('Tesouro indisponível:',error);

    if(!cache?.data){
      renderTreasury({
        items:[],
        referenceDate:null
      },false);
    }
  }finally{
    treasuryLoading=false;
  }
}
async function loadMarket(force=false){
  if(marketLoading)return;
  marketLoading=true;

  const refresh=document.querySelector('#marketRefresh');
  if(refresh){
    refresh.disabled=true;
    refresh.textContent='Atualizando...';
  }

  const cache=marketReadCache();

  if(cache?.market){
    renderMarketData(cache.market,true);
    marketNews=Array.isArray(cache.news)?cache.news:[];
    renderMarketNews();

    if(!force && Date.now()-Number(cache.savedAt||0)<MARKET_CACHE_TTL){
      marketLoading=false;
      if(refresh){
        refresh.disabled=false;
        refresh.textContent='Atualizar';
      }
      return;
    }
  }

  try{
    const [marketResponse,newsResponse]=await Promise.all([
      fetch('/api/market',{cache:'no-store'}),
      fetch('/api/news',{cache:'no-store'})
    ]);

    if(!marketResponse.ok)throw new Error(`Mercado HTTP ${marketResponse.status}`);

    const newMarket=await marketResponse.json();
    const newNews=newsResponse.ok?await newsResponse.json():{items:[]};

    renderMarketData(newMarket,false);
    marketNews=Array.isArray(newNews.items)?newNews.items:[];
    renderMarketNews();

    marketWriteCache({
      market:newMarket,
      news:marketNews
    });

  }catch(err){
    console.warn('Mercado indisponível:',err);

    const freshness=document.querySelector('#marketFreshness');

    if(freshness){
      freshness.textContent=cache?.market
        ?'Sem conexão com as fontes agora. Exibindo o último dado salvo.'
        :'Não foi possível consultar as fontes agora.';
    }
  }finally{
    marketLoading=false;

    if(refresh){
      refresh.disabled=false;
      refresh.textContent='Atualizar';
    }
  }
}

function renderMarket(){
  loadMarket(false);
  loadTreasury(false);
}

document.querySelector('#marketRefresh')?.addEventListener('click',()=>{
  loadMarket(true);
  loadTreasury(true);
});
document.querySelector('#marketNewsFilter')?.addEventListener('change',renderMarketNews);

['marketCompareAmount','marketCompareMonths','marketReferenceRate','marketOfferPct'].forEach(id=>{
  document.querySelector(`#${id}`)?.addEventListener('input',()=>{
    if(id==='marketReferenceRate'){
      document.querySelector(`#${id}`).dataset.userEdited='1';
    }
    updateMarketComparison();
  });
});

setInterval(()=>{
  if(document.querySelector('#view-market')?.classList.contains('active')){
    loadMarket(true);
    loadTreasury(false);
  }
},5*60*1000);
