/* SaldoPlan Mercado v5.3.4 · notícias ilustradas quando a fonte disponibilizar foto */
let marketData=null,marketNews=[],marketLoading=false,treasuryLoading=false,marketChartMetric='selic',marketChartRange='all';
const MARKET_531_CACHE='saldoplan.market.v531'; // Mantém dados públicos salvos pela v5.3.1
const MARKET_531_MAXAGE=5*60*1000;
const MARKET_531_TREASURY_MAXAGE=6*60*60*1000;
const MARKET_532_NEWS_MAXAGE=15*60*1000;
const MARKET_533_ARCHIVE_MAXAGE=12*60*60*1000;
let marketNewsMonth='',marketNewsDay='',marketNewsSearch='',marketNewsShowAll=false,marketNewsLoading=false,marketNewsSeq=0,marketNewsIsCached=false;
const marketFmt=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
function marketValid(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))}
function marketNumber(v,d=2){return marketValid(v)?Number(v).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—'}
function marketMoney(v){return marketValid(v)?marketFmt.format(Number(v)):'—'}
function marketElement(id){return document.getElementById(id)}
function marketSet(id,text){const e=marketElement(id);if(e)e.textContent=text}
function marketEscape(text){return String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function marketDate(s){if(!s)return 'Sem data';const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);if(m)return s;const d=new Date(`${s}T12:00:00`);return Number.isFinite(d.getTime())?d.toLocaleDateString('pt-BR'):String(s)}
function marketDateValue(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return NaN;const time=Date.parse(`${s}T12:00:00Z`);return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===s?time:NaN}
function marketCacheRead(key){try{const v=JSON.parse(localStorage.getItem(MARKET_531_CACHE+'.'+key)||'null');return v&&typeof v==='object'?v:null}catch{return null}}
function marketCacheWrite(key,value){try{localStorage.setItem(MARKET_531_CACHE+'.'+key,JSON.stringify({savedAt:Date.now(),value}))}catch{}}
function marketSetSourceStatus(id,status){marketSet(id,status)}
const marketConfigs={
 selic:{name:'Selic anualizada',key:'selic',source:'Banco Central · SGS 1178',format:v=>`${marketNumber(v)}% a.a.`,unit:'p.p.'},
 dollar:{name:'Dólar venda',key:'dollar',source:'Banco Central · SGS 1',format:marketMoney,unit:'R$'},
 ipca:{name:'IPCA mensal',key:'ipca',source:'Banco Central · SGS 433',format:v=>`${marketNumber(v)}%`,unit:'p.p.'}
};
function marketHistoryRows(d,key,range='all'){
 const rows=(Array.isArray(d?.history?.[key])?d.history[key]:[])
 .filter(r=>r&&Number.isFinite(marketDateValue(r.date))&&marketValid(r.value))
 .map(r=>({date:r.date,value:Number(r.value)})).sort((a,b)=>a.date.localeCompare(b.date));
 if(range==='all'||!rows.length)return rows;
 const days=Number(range);if(!Number.isFinite(days)||days<=0)return rows;
 const newest=marketDateValue(rows[rows.length-1].date);
 return rows.filter(r=>newest-marketDateValue(r.date)<=days*86400000);
}
function marketChartSVG(rows,label,formatter){
 if(!rows.length)return '';
 const w=850,h=290,L=100,R=22,T=25,B=45;
 let min=Math.min(...rows.map(r=>r.value)),max=Math.max(...rows.map(r=>r.value));
 if(min===max){const pad=Math.max(Math.abs(min)*.04,.01);min-=pad;max+=pad}else{const pad=(max-min)*.12;min-=pad;max+=pad}
 const times=rows.map(r=>marketDateValue(r.date)),firstTime=times[0],lastTime=times.at(-1),duration=Math.max(1,lastTime-firstTime);
 const px=i=>L+((times[i]-firstTime)/duration)*(w-L-R);
 const py=v=>h-B-((v-min)/(max-min))*(h-T-B);
 const line=rows.map((r,i)=>`${i?'L':'M'}${px(i).toFixed(1)},${py(r.value).toFixed(1)}`).join(' ');
 const area=line+` L${px(rows.length-1).toFixed(1)},${h-B} L${px(0)},${h-B} Z`;
 const lines=[0,1,2,3].map(i=>{const val=max-(max-min)*i/3,y=py(val);return `<line class="market-chart-grid" x1="${L}" y1="${y}" x2="${w-R}" y2="${y}"/><text class="market-chart-label" x="${L-9}" y="${y+4}" text-anchor="end">${marketEscape(formatter(val))}</text>`}).join('');
 const step=Math.max(1,Math.ceil(rows.length/55));
 const points=rows.map((r,i)=>{if(i%step!==0&&i!==rows.length-1)return '';return `<circle class="market-chart-point" cx="${px(i).toFixed(2)}" cy="${py(r.value).toFixed(2)}" r="${i===rows.length-1?5:3}" tabindex="0"><title>${marketEscape(marketDate(r.date))}: ${marketEscape(formatter(r.value))}</title></circle>`}).join('');
 return `<svg class="market-chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Histórico de ${marketEscape(label)}, ${rows.length} observações"><title>${marketEscape(label)} · ${marketEscape(marketDate(rows[0].date))} até ${marketEscape(marketDate(rows.at(-1).date))}</title>${lines}<path class="market-chart-area" d="${area}"/><path class="market-chart-line" d="${line}"/>${points}<text class="market-chart-date" x="${L}" y="${h-13}">${marketEscape(marketDate(rows[0].date))}</text><text class="market-chart-date market-chart-date-end" x="${w-R}" y="${h-13}" text-anchor="end">${marketEscape(marketDate(rows.at(-1).date))}</text></svg>`;
}
function renderMarketHistory(data){
 const root=marketElement('marketHistoryChart');if(!root)return;
 const config=marketConfigs[marketChartMetric]||marketConfigs.selic;
 let rows=marketHistoryRows(data,config.key,marketChartRange);
 document.querySelectorAll('[data-market-chart]').forEach(b=>{const a=b.dataset.marketChart===marketChartMetric;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a))});
 document.querySelectorAll('[data-market-range]').forEach(b=>{const a=b.dataset.marketRange===marketChartRange;b.classList.toggle('active',a);b.setAttribute('aria-pressed',String(a));const unavailable=marketChartMetric==='ipca'&&['7','30','90'].includes(b.dataset.marketRange);b.disabled=unavailable;b.title=unavailable?'IPCA é mensal; utilize 12 meses ou todo o histórico':''});
 marketSet('marketChartSource',`Fonte: ${config.source}. Datas de referência oficiais; sem atualização contínua fora da divulgação.`);
 if(rows.length<2){root.innerHTML='<div class="empty" role="status">Não há dados suficientes deste indicador no período escolhido. Tente outro período ou atualize as fontes.</div>';marketSet('marketChartCurrent','—');marketSet('marketChartChange','—');marketSet('marketChartPeriod','Sem observações suficientes');marketSet('marketChartDataStatus','Sem dados para o gráfico');return}
 const first=rows[0],last=rows.at(-1),delta=last.value-first.value;
 marketSet('marketChartCurrent',config.format(last.value));
 marketSet('marketChartChange',config.key==='dollar'?`${delta>=0?'+ ':''}${marketMoney(delta)}`:`${delta>=0?'+':''}${marketNumber(delta)} p.p.`);
 marketSet('marketChartPeriod',`${marketDate(first.date)} — ${marketDate(last.date)} · ${rows.length} observações`);marketSet('marketChartDataStatus',data?.status?.[config.key]?.stale?'Dados históricos salvos':'Histórico disponível');
 root.innerHTML=marketChartSVG(rows,config.name,config.format);
}
function marketScenario(data){
 const selic=data?.indicators?.selic?.value,ipca=data?.indicators?.ipca12m?.value;
 if(!marketValid(selic)){marketSet('marketScenarioTag','Dados parciais');marketSet('marketScenarioText','A leitura de cenário será atualizada quando o Banco Central responder.');marketElement('marketScenarioFacts')?.replaceChildren();return}
 const s=Number(selic),high=s>=10;
 marketSet('marketScenarioTag',high?'Juros elevados':s>=7?'Juros intermediários':'Juros mais baixos');
 marketSet('marketScenarioText','Compare rendimento, liquidez, tributação e prazo antes de decidir. Taxas públicas não representam uma oferta contratável.');
 const facts=[`Selic anualizada: ${marketNumber(s)}%`];
 if(marketValid(ipca)){facts.push(`IPCA em 12 meses: ${marketNumber(ipca)}%`);const real=((1+s/100)/(1+Number(ipca)/100)-1)*100;facts.push(`Comparação teórica juros × inflação: ${marketNumber(real)}% a.a.`)}
 marketElement('marketScenarioFacts').innerHTML=facts.map(x=>`<span>${marketEscape(x)}</span>`).join('');
}
function renderMarketData(data,fromCache=false){
 if(!data||typeof data!=='object')return;marketData=data;
 const indicators=data.indicators||{};
 marketSet('marketSelic',marketValid(indicators.selic?.value)?`${marketNumber(indicators.selic.value)}% a.a.`:'—');
 marketSet('marketDollar',marketMoney(indicators.dollar?.value));
 marketSet('marketIpca',marketValid(indicators.ipca12m?.value)?`${marketNumber(indicators.ipca12m.value)}%`:'—');
 marketSet('marketSelicDate',indicators.selic?.date?`Ref. ${marketDate(indicators.selic.date)}${fromCache||data.status?.selic?.stale?' · salvo':''}`:'Fonte indisponível');
 marketSet('marketDollarDate',indicators.dollar?.date?`Ref. ${marketDate(indicators.dollar.date)}${fromCache||data.status?.dollar?.stale?' · salvo':''}`:'Fonte indisponível');
 marketSet('marketIpcaDate',indicators.ipca12m?.reference?`Até ${marketDate(indicators.ipca12m.reference)}${fromCache||data.status?.ipca?.stale?' · salvo':''}`:'Aguardando 12 meses completos');
 marketSet('marketChartDataStatus',fromCache?'Dados salvos':data.partial?'Fontes parciais':'Indicadores disponíveis');
 renderMarketHistory(data);marketScenario(data);
 const reference=marketElement('marketReferenceRate');if(reference&&!reference.dataset.userEdited&&marketValid(indicators.selic?.value))reference.value=Number(indicators.selic.value).toFixed(2).replace('.',',');
 updateMarketComparison();
}
function marketNewsCategory(c){return ({'renda-fixa':'Renda fixa',juros:'Juros e inflação',tesouro:'Tesouro',bancos:'Bancos',bolsa:'Bolsa',regulacao:'Regulação',mercado:'Mercado'})[c]||'Mercado'}
function marketNewsToday(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const val=k=>parts.find(x=>x.type===k)?.value||'';return `${val('year')}-${val('month')}-${val('day')}`}
function marketNewsMonthShift(month,n){const d=new Date(`${month}-15T12:00:00Z`);if(!Number.isFinite(d.getTime()))return month;d.setUTCMonth(d.getUTCMonth()+n);return d.toISOString().slice(0,7)}
function marketNewsMonthLabel(month){const d=new Date(`${month}-15T12:00:00Z`);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',month:'long',year:'numeric'}).format(d):month}
function marketNewsAllowedMonth(month){const current=marketNewsToday().slice(0,7);return /^\d{4}-(0[1-9]|1[0-2])$/.test(month)&&month<=current&&month>=marketNewsMonthShift(current,-23)}
function marketNewsCard(n,featured=false){
 const url=/^https:\/\/[^\s]+$/.test(n.url||'')?n.url:'';
 if(!url)return '';
 const image=/^https:\/\/[^\s]+$/.test(n.imageUrl||'')&&!/\.svg(?:[?#]|$)/i.test(n.imageUrl)?n.imageUrl:'';
 const illustration=image?`<img class="market-news-photo" src="${marketEscape(image)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:`<div class="market-news-placeholder" aria-hidden="true"><span>📰</span><small>Imagem não fornecida pela fonte</small></div>`;
 const timestamp=Number.isFinite(Date.parse(n.publishedAt))?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(n.publishedAt)):(n.day||'');
 const excerpt=String(n.summary||'').trim();
 return `<article class="market-news-card${featured&&image?' is-featured':''}${image?'':' without-photo'}"><a class="market-news-image-link" href="${marketEscape(url)}" target="_blank" rel="noopener noreferrer" aria-label="Abrir notícia: ${marketEscape(n.title||'Notícia')}">${illustration}</a><div class="market-news-body"><div class="market-news-meta"><b>${marketEscape(n.source||'Fonte')}</b><span>${marketEscape(marketNewsCategory(n.category))}</span><time datetime="${marketEscape(n.publishedAt||'')}">${marketEscape(timestamp)}</time></div><a class="market-news-title" href="${marketEscape(url)}" target="_blank" rel="noopener noreferrer">${marketEscape(n.title||'Notícia')}</a>${excerpt?`<p class="market-news-excerpt">${marketEscape(excerpt)}</p>`:''}<a class="market-news-read" href="${marketEscape(url)}" target="_blank" rel="noopener noreferrer">Ler notícia original <span aria-hidden="true">↗</span></a></div></article>`;
}
function renderMarketNewsCalendar(){
 const grid=marketElement('marketNewsCalendar');if(!grid)return;
 if(!marketNewsMonth)marketNewsMonth=marketNewsToday().slice(0,7);
 const [year,mon]=marketNewsMonth.split('-').map(Number),days=new Date(Date.UTC(year,mon,0)).getUTCDate();
 const pad=(new Date(Date.UTC(year,mon-1,1)).getUTCDay()+6)%7;
 const counts=Object.create(null);marketNews.forEach(n=>{if(typeof n.day==='string'&&n.day.startsWith(marketNewsMonth))counts[n.day]=(counts[n.day]||0)+1});
 const today=marketNewsToday(),dots=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(x=>`<span class="market-calendar-weekday">${x}</span>`);
 const cells=[...dots];for(let i=0;i<pad;i++)cells.push('<span class="market-calendar-gap" aria-hidden="true"></span>');
 for(let day=1;day<=days;day++){
  const date=`${marketNewsMonth}-${String(day).padStart(2,'0')}`,count=counts[date]||0,selected=marketNewsDay===date,future=date>today;
  cells.push(`<button type="button" class="market-calendar-day${selected?' selected':''}${date===today?' today':''}${count?' has-news':''}" data-market-news-day="${date}" aria-pressed="${selected}" aria-label="Dia ${day}: ${count} notícia(s) encontrada(s)" ${future?'disabled':''}><span>${day}</span>${count?'<i aria-hidden="true"></i>':''}</button>`);
 }
 grid.innerHTML=cells.join('');marketSet('marketNewsMonthLabel',marketNewsMonthLabel(marketNewsMonth));
 const prev=marketElement('marketNewsPrev'),next=marketElement('marketNewsNext');if(prev)prev.disabled=!marketNewsAllowedMonth(marketNewsMonthShift(marketNewsMonth,-1));if(next)next.disabled=!marketNewsAllowedMonth(marketNewsMonthShift(marketNewsMonth,1));
 marketSet('marketNewsCalendarInfo',marketNews.length?`${marketNews.length} notícias encontradas no mês; pontos indicam dias com publicações.`:'Nenhuma publicação encontrada neste mês nas fontes consultadas.');
 const clear=marketElement('marketNewsAllDays');if(clear){clear.disabled=!marketNewsDay;clear.setAttribute('aria-pressed',String(!marketNewsDay))}
}
function renderMarketNews(){
 const root=marketElement('marketNewsList');if(!root)return;
 const filter=marketElement('marketNewsFilter')?.value||'all',search=marketNewsSearch.toLocaleLowerCase('pt-BR');
 const rows=marketNews.filter(n=>(filter==='all'||n.category===filter)&&(!marketNewsDay||n.day===marketNewsDay)&&(!search||`${n.title} ${n.summary} ${n.source}`.toLocaleLowerCase('pt-BR').includes(search)));
 const selected=marketNewsDay?` em ${marketDate(marketNewsDay)}`:'';
 marketSet('marketNewsResults',`${rows.length} resultado(s)${selected}${marketNewsIsCached?' · consulta salva':''}`);
 const shown=marketNewsShowAll?rows:rows.slice(0,12);
 root.innerHTML=shown.length?shown.map((n,i)=>marketNewsCard(n,i===0)).join(''):`<div class="empty market-news-empty">Nenhuma notícia encontrada${selected}. Experimente outro dia, mês ou categoria. O histórico depende do que as fontes ainda disponibilizam.</div>`;
 const more=marketElement('marketNewsMore');if(more){more.hidden=rows.length<=12;more.textContent=marketNewsShowAll?'Mostrar menos':`Mostrar mais (${rows.length-12})`}
 renderMarketNewsCalendar();
}
async function loadNewsMonth(force=false){
 if(!marketNewsMonth)marketNewsMonth=marketNewsToday().slice(0,7);
 if(!marketNewsAllowedMonth(marketNewsMonth))return;
 const month=marketNewsMonth,request=++marketNewsSeq,cacheKey=`news.v534.month.${month}`;
 const cache=marketCacheRead(cacheKey);
 if(cache?.value?.items){marketNews=cache.value.items;marketNewsIsCached=true;renderMarketNews()}
 else {marketNews=[];marketNewsIsCached=false;renderMarketNews()}
 const maxAge=month===marketNewsToday().slice(0,7)?MARKET_532_NEWS_MAXAGE:MARKET_533_ARCHIVE_MAXAGE;
 if(!force&&cache?.value&&Date.now()-(cache.savedAt||0)<maxAge){marketSet('marketNewsStatus','Consulta salva');marketSet('marketNewsCoverage','Notícias de fontes públicas. O calendário mostra apenas publicações encontradas, não um arquivo completo.');return}
 marketNewsLoading=true;marketSet('marketNewsStatus','Buscando notícias...');if(!cache?.value&&marketElement('marketNewsList'))marketElement('marketNewsList').innerHTML='<div class="empty market-news-empty">Consultando fontes públicas... Aguarde alguns segundos.</div>';
 try{
  const data=await marketFetch(`/api/news?month=${encodeURIComponent(month)}`);
  if(request!==marketNewsSeq||month!==marketNewsMonth)return;
  if(!Array.isArray(data.items)||data.month!==month)throw Error('Resposta de notícias inválida');
  marketNews=data.items;marketNewsIsCached=false;marketNewsShowAll=false;marketCacheWrite(cacheKey,data);
  marketSet('marketNewsStatus',data.partial?'Fontes parciais':`${marketNews.length} notícias`);
  marketSet('marketNewsCoverage',data.coverage||'Resultados disponíveis nas fontes públicas; o histórico pode estar incompleto.');
  renderMarketNews();
 }catch(e){if(request!==marketNewsSeq||month!==marketNewsMonth)return;marketSet('marketNewsStatus',cache?.value?'Última consulta salva':'Fontes indisponíveis');marketSet('marketNewsCoverage',cache?.value?'Sem conexão com as fontes. Exibindo último resultado salvo do mês.':'Não foi possível consultar este mês. Verifique a conexão e tente novamente.');renderMarketNews();}
 finally{if(request===marketNewsSeq)marketNewsLoading=false}
}
function marketInputNumber(id){const v=String(marketElement(id)?.value??'').trim();if(!v)return NaN;const s=v.includes(',')?v.replace(/\./g,'').replace(',','.'):v;return Number(s)}
function updateMarketComparison(){
 const initial=marketInputNumber('marketCompareAmount'),months=marketInputNumber('marketCompareMonths'),rate=marketInputNumber('marketReferenceRate'),pct=marketInputNumber('marketOfferPct');
 if(![initial,months,rate,pct].every(Number.isFinite)||initial<=0||months<1||months>600||rate<0||pct<0){['marketReferenceResult','marketOfferResult','marketDifferenceResult'].forEach(id=>marketSet(id,'—'));marketSet('marketCompareMessage','Informe valores válidos para comparar. A estimativa é bruta, sem impostos ou taxas.');return}
 const years=months/12,r=initial*(1+rate/100)**years,o=initial*(1+(rate*pct/100)/100)**years;
 marketSet('marketReferenceResult',marketMoney(r));marketSet('marketOfferResult',marketMoney(o));marketSet('marketDifferenceResult',`${o-r>=0?'+ ':''}${marketMoney(o-r)}`);
 marketSet('marketCompareMessage','Estimativa bruta simplificada: a Selic não é necessariamente o CDI. Não inclui impostos, taxas, carência nem marcação a mercado.');
}
function renderTreasury(data,fromCache=false){
 marketTreasuryData=data;
 const allItems=Array.isArray(data?.items)?data.items:[];
 const category=marketElement('marketTreasuryFilter')?.value||'all';
 const classify=marketTreasuryType;
 const filtered=allItems.filter(x=>category==='all'||classify(x.name)===category);
 const limit=marketTreasuryShowAll?filtered.length:Math.min(filtered.length,12);
 const items=filtered.slice(0,limit);
 marketSet('marketTreasuryCount',allItems.length?String(allItems.length):'—');
 marketSet('marketTreasuryDate',data?.referenceDate?`Ref. ${marketDate(data.referenceDate)}`:'Dados não disponíveis');
 marketSet('marketTreasuryStatus',fromCache?'Última consulta salva':data?.stale?'Dados antigos':'Base oficial');
 const more=marketElement('marketTreasuryMore');if(more){more.hidden=filtered.length<=12;more.textContent=marketTreasuryShowAll?'Mostrar menos':`Mostrar mais (${filtered.length-12})`}
 const root=marketElement('marketTreasuryList');if(!root)return;
 root.innerHTML=items.length?items.map(t=>`<article class="market-treasury-card"><div><strong>${marketEscape(t.name||'Título')}</strong><span>Vencimento: ${marketEscape(marketDate(t.maturity)||'—')}</span></div><div><strong>${marketValid(t.buyRate)?`${marketNumber(t.buyRate)}%`:'Taxa indisponível'}</strong><span>${marketMoney(t.buyPrice)} · preço de compra</span></div></article>`).join(''):'<div class="empty">A fonte oficial não respondeu. Confira as taxas no site do Tesouro Direto.</div>';
}
function marketTreasuryType(name){const text=String(name||'').toLowerCase();if(text.includes('selic'))return 'selic';if(text.includes('ipca'))return 'ipca';if(text.includes('prefixado'))return 'prefixado';if(text.includes('renda+'))return 'renda';if(text.includes('educa+'))return 'educa';return 'outros'}
let marketTreasuryShowAll=false, marketTreasuryData=null;
async function marketFetch(url){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),26000);try{const res=await fetch(url,{cache:'no-store',signal:ctl.signal,headers:{Accept:'application/json'}});if(!res.ok)throw Error(`HTTP ${res.status}`);const j=await res.json();if(!j||typeof j!=='object')throw Error('Resposta inválida');return j}finally{clearTimeout(timer)}}
async function loadMarket(force=false){
 if(marketLoading)return;
 marketLoading=true;
 const btn=marketElement('marketRefresh');if(btn){btn.disabled=true;btn.textContent='Atualizando...'}
 const cached=marketCacheRead('indicators');
 if(cached?.value)renderMarketData(cached.value,true);
 if(!cached?.value)renderMarketHistory({history:{},status:{}});
 const now=Date.now(),needIndicators=force||!cached?.value||now-(cached.savedAt||0)>MARKET_531_MAXAGE;
 if(!needIndicators){marketSet('marketFreshness','Exibindo últimas consultas salvas. Confira as datas de referência.');marketLoading=false;if(btn){btn.disabled=false;btn.textContent='Atualizar dados'}return}
 marketSet('marketFreshness','Consultando indicadores públicos...');
 try{
  const data=await marketFetch('/api/market');
  const indicatorOK=Object.values(data.status||{}).some(x=>x.ok||x.stale);
  if(indicatorOK){renderMarketData(data);marketCacheWrite('indicators',data)}
  else if(!cached?.value){renderMarketHistory({history:{},status:{}});marketSet('marketScenarioTag','Sem dados');marketSet('marketScenarioText','Não foi possível consultar as taxas do Banco Central.')}
  const outdated=indicatorOK&&Object.values(data.status||{}).some(x=>x.stale||!x.ok);
  marketSet('marketFreshness',indicatorOK?(outdated?'Alguns indicadores estão indisponíveis ou usam dados salvos. Confira a referência.':'Indicadores disponíveis. Consulte a data de referência de cada taxa.'):(cached?.value?'Indicadores não atualizados. Exibindo dados salvos.':'Indicadores indisponíveis. Confira a conexão e tente novamente.'));
  const mark=marketElement('marketStatusMark');if(mark)mark.classList.toggle('offline',!indicatorOK||outdated);
 }catch(error){console.warn('[Mercado] Erro de atualização:',error?.message);marketSet('marketFreshness',cached?.value?'Não foi possível atualizar. Exibindo últimas taxas salvas.':'Não foi possível atualizar as fontes. Tente novamente.');renderMarketHistory(marketData||{history:{},status:{}})}
 finally{marketLoading=false;if(btn){btn.disabled=false;btn.textContent='Atualizar dados'}}
}
async function loadTreasury(force=false){
 if(treasuryLoading)return;const cached=marketCacheRead('treasury');if(cached?.value){renderTreasury(cached.value,true);if(!force&&Date.now()-(cached.savedAt||0)<MARKET_531_TREASURY_MAXAGE)return}
 treasuryLoading=true;marketSet('marketTreasuryStatus','Atualizando...');
 try{const data=await marketFetch('/api/treasury');if(!Array.isArray(data.items)||!data.items.length)throw Error('Lista de títulos vazia');renderTreasury(data);marketCacheWrite('treasury',data)}catch(e){console.warn('[Mercado] Tesouro:',e);marketSet('marketTreasuryStatus',cached?.value?'Última consulta salva':'Fonte indisponível');if(!cached?.value)renderTreasury({items:[]})}finally{treasuryLoading=false}
}
function renderMarket(){if(!marketNewsMonth)marketNewsMonth=marketNewsToday().slice(0,7);loadMarket();loadTreasury();loadNewsMonth()}
// Inicializado após o carregamento assíncrono das views pelo app.js.
document.addEventListener('click',e=>{
 const metric=e.target.closest('[data-market-chart]');if(metric){marketChartMetric=metric.dataset.marketChart||'selic';if(marketChartMetric==='ipca'&&['7','30','90'].includes(marketChartRange))marketChartRange='365';renderMarketHistory(marketData||{history:{},status:{}})}
 const range=e.target.closest('[data-market-range]');if(range&&!range.disabled){marketChartRange=range.dataset.marketRange||'all';renderMarketHistory(marketData||{history:{},status:{}})}
 if(e.target.closest('#marketRefresh')){loadMarket(true);loadTreasury(true);loadNewsMonth(true)}
 const day=e.target.closest('[data-market-news-day]');if(day&&!day.disabled){marketNewsDay=marketNewsDay===day.dataset.marketNewsDay?'':day.dataset.marketNewsDay;marketNewsShowAll=false;renderMarketNews()}
 if(e.target.closest('#marketNewsPrev')){const p=marketNewsMonthShift(marketNewsMonth,-1);if(marketNewsAllowedMonth(p)){marketNewsMonth=p;marketNewsDay='';marketNewsShowAll=false;loadNewsMonth()}}
 if(e.target.closest('#marketNewsNext')){const p=marketNewsMonthShift(marketNewsMonth,1);if(marketNewsAllowedMonth(p)){marketNewsMonth=p;marketNewsDay='';marketNewsShowAll=false;loadNewsMonth()}}
 if(e.target.closest('#marketNewsToday')){marketNewsMonth=marketNewsToday().slice(0,7);marketNewsDay='';marketNewsShowAll=false;loadNewsMonth()}
 if(e.target.closest('#marketNewsAllDays')){marketNewsDay='';marketNewsShowAll=false;renderMarketNews()}
 if(e.target.closest('#marketNewsMore')){marketNewsShowAll=!marketNewsShowAll;renderMarketNews()}
 if(e.target.closest('#marketTreasuryMore')){marketTreasuryShowAll=!marketTreasuryShowAll;if(marketTreasuryData)renderTreasury(marketTreasuryData)}
});
document.addEventListener('change',e=>{if(e.target.id==='marketNewsFilter'){marketNewsShowAll=false;renderMarketNews();}if(e.target.id==='marketTreasuryFilter'){marketTreasuryShowAll=false;if(marketTreasuryData)renderTreasury(marketTreasuryData)}});
document.addEventListener('error',e=>{const img=e.target;if(!img?.matches?.('.market-news-photo'))return;const placeholder=document.createElement('div');placeholder.className='market-news-placeholder';placeholder.setAttribute('aria-hidden','true');placeholder.innerHTML='<span>📰</span><small>Imagem indisponível</small>';img.closest('.market-news-card')?.classList.add('without-photo');img.replaceWith(placeholder)},true);
document.addEventListener('input',e=>{if(e.target.id==='marketNewsSearch'){marketNewsSearch=String(e.target.value||'').trim().slice(0,100);marketNewsShowAll=false;renderMarketNews()}if(['marketCompareAmount','marketCompareMonths','marketReferenceRate','marketOfferPct'].includes(e.target.id)){if(e.target.id==='marketReferenceRate')e.target.dataset.userEdited='1';updateMarketComparison()}});
setInterval(()=>{if(document.visibilityState!=='hidden'&&marketElement('view-market')?.classList.contains('active')){loadMarket(true);loadTreasury(false);if(marketNewsMonth===marketNewsToday().slice(0,7))loadNewsMonth(false)}},5*60*1000);
if(typeof module!=='undefined'&&module.exports)module.exports={marketValid,marketHistoryRows,marketDateValue,marketChartSVG,marketTreasuryType,marketNewsMonthShift,marketNewsAllowedMonth,marketNewsCard};
