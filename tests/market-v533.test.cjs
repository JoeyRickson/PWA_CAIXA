'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../api/news.js');const t=api._test;let n=0;
function check(title,fn){fn();console.log('PASS',title);n++}
const now=new Date('2026-10-21T15:00:00Z');
check('Calendário aceita mês atual e histórico de até 24 meses',()=>{assert.equal(t.monthBounds('2026-10',now).start,'2026-10-01');assert.equal(t.monthBounds('2024-10',now),null);assert.equal(t.monthBounds('2026-11',now),null)});
check('Consulta de período usa after/before, sem interpolar parâmetro do usuário',()=>{const url=t.googleUrl('Selic',t.monthBounds('2026-10',now));assert.match(decodeURIComponent(url),/after:2026-10-01 before:2026-11-01/)});
check('Endereço perigoso e URL com credenciais são rejeitados',()=>{assert.equal(t.safeUrl('javascript:alert(1)'),'');assert.equal(t.safeUrl('https://login:senha@site.com/a'),'');assert.equal(t.safeImageUrl('https://site.com/arte.svg'),'')});
check('Data de publicação respeita calendário brasileiro',()=>{assert.equal(t.dateBR('2026-10-21T02:20:00Z'),'2026-10-20');assert.equal(t.dateBR('2026-10-21T16:00:00Z'),'2026-10-21')});
const xml=`<?xml version="1.0"?><rss xmlns:media="http://search.yahoo.com/mrss/"><channel>
<item><title><![CDATA[Selic muda &amp; mercado avança]]></title><link>https://noticias.example.org/1</link><source>Jornal Exemplo</source><pubDate>Tue, 20 Oct 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>Resumo sobre <b>juros</b> no Brasil.</p>]]></description><media:content url="https://noticias.example.org/capa.jpg" type="image/jpeg"/></item>
<item><title>IPCA &lt; 5% e economia</title><link>https://noticias.example.org/2</link><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<img src="https://noticias.example.org/indice.webp"><script>alert('no')</script><p>Veja os detalhes.</p>]]></description></item>
<item><title>Antiga</title><link>https://noticias.example.org/3</link><pubDate>Mon, 01 Sep 2025 12:00:00 GMT</pubDate></item>
</channel></rss>`;
const rows=t.extract(xml,'RSS Exemplo','2026-10',now);
check('RSS por mês inclui apenas datas válidas do intervalo solicitado',()=>{assert.equal(rows.length,2);assert.equal(rows[0].day,'2026-10-20')});
check('Extrai imagem real de mídia RSS e resumo sem HTML',()=>{assert.equal(rows[0].imageUrl,'https://noticias.example.org/capa.jpg');assert.match(rows[0].summary,/Resumo sobre juros no Brasil/);assert.doesNotMatch(rows[0].summary,/<b>/)});
check('Imagem em descrição RSS é opcional e utilizada quando válida',()=>assert.equal(rows[1].imageUrl,'https://noticias.example.org/indice.webp'));
check('Deduplicação prefere cópia com imagem',()=>{const duplicate={...rows[0],imageUrl:''};assert.equal(t.dedupe([duplicate,rows[0]]).length,1);assert.equal(t.dedupe([duplicate,rows[0]])[0].imageUrl,rows[0].imageUrl)});
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(s){this.code=s;return this},json(j){this.body=j;return this}}}
(async()=>{
 const originalFetch=global.fetch;
 try{
  let feeds=0;
  global.fetch=async()=>{feeds++;return {ok:true,text:async()=>xml}};
  const success=res();await api({query:{month:'2026-10'}},success);
  check('Endpoint retorna notícias, mês, cobertura e status das fontes',()=>{assert.equal(success.code,200);assert.equal(success.body.month,'2026-10');assert.equal(success.body.items.length,2);assert.equal(success.body.archiveComplete,false);assert.ok(feeds>=4)});
  const invalid=res();await api({query:{month:'../../private'}},invalid);
  check('API rejeita mês inválido antes de tentar buscar feeds',()=>{assert.equal(invalid.code,400);assert.equal(invalid.headers['Cache-Control'],'no-store')});
  global.fetch=async()=>{throw Error('offline')};
  const offline=res();await api({query:{month:'2026-10'}},offline);
  check('Sem fonte, HTTP 503 não inventa notícias',()=>{assert.equal(offline.code,503);assert.equal(offline.body.items.length,0);assert.equal(offline.headers['Cache-Control'],'no-store')});
 }finally{global.fetch=originalFetch}
 const elements=new Map();const events=new Map();
 function node(id){if(!elements.has(id))elements.set(id,{id,value:'all',textContent:'',innerHTML:'',hidden:false,disabled:false,dataset:{},classList:{toggle(){},contains(){return true}},setAttribute(){},replaceChildren(){}});return elements.get(id)}
 const sandbox={module:{exports:{}},document:{getElementById:node,addEventListener:(key,fn)=>events.set(key,fn),querySelectorAll:()=>[],visibilityState:'visible'},localStorage:{getItem:()=>null,setItem(){}},setInterval:()=>0,Intl,console,Number,Date,Math,Array,JSON,fetch:async()=>{throw Error('offline')},AbortController,setTimeout,clearTimeout,URL};
 const context=vm.createContext(sandbox);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/market.js'),'utf8'),context);
 const helper=sandbox.module.exports;
 check('Navegação de meses respeita ano bissexto',()=>{assert.equal(helper.marketNewsMonthShift('2026-01',1),'2026-02');assert.equal(helper.marketNewsMonthShift('2024-12',1),'2025-01')});
 check('Cartão HTML escapa scripts e possui link seguro',()=>{const card=helper.marketNewsCard({...rows[0],title:'<img src=x onerror=alert(1)>',summary:'<script>alert(1)</script>'});assert.doesNotMatch(card,/<script>/);assert.match(card,/&lt;script&gt;/);assert.match(card,/rel="noopener noreferrer"/);assert.match(card,/loading="lazy"/)});
 check('Imagem ausente gera marcador visual, sem imagem inventada',()=>{const card=helper.marketNewsCard({...rows[0],imageUrl:''});assert.match(card,/market-news-placeholder/);assert.doesNotMatch(card,/<img class="market-news-photo"/)});
 vm.runInContext(`marketNewsMonth='2026-10';marketNews=${JSON.stringify(rows)};marketNewsDay='2026-10-20';renderMarketNews()`,context);
 check('Seleção do dia filtra resultados e marca calendário',()=>{assert.match(node('marketNewsResults').textContent,/1 resultado/);assert.match(node('marketNewsCalendar').innerHTML,/data-market-news-day="2026-10-20" aria-pressed="true"/);assert.doesNotMatch(node('marketNewsList').innerHTML,/IPCA &lt; 5%/)});
 vm.runInContext(`marketNewsDay='';marketNewsSearch='ipca';renderMarketNews()`,context);
 check('Busca textual filtra matérias no mês',()=>{assert.match(node('marketNewsResults').textContent,/1 resultado/);assert.match(node('marketNewsList').innerHTML,/IPCA/)});
 check('Indicadores e comparador permanecem no HTML',()=>{const view=fs.readFileSync(path.join(__dirname,'../views/market.html'),'utf8');assert.match(view,/marketHistoryChart/);assert.match(view,/marketTreasuryList/);assert.match(view,/marketReferenceResult/);assert.match(view,/marketNewsCalendar/)});
 console.log('Mercado v5.3.3:',n,'testes adicionais PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
