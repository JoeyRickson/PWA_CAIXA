'use strict';
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const market=require(path.join(root,'api','market.js'));
const news=require(path.join(root,'api','news.js'));
const treasury=require(path.join(root,'api','treasury.js'));
let n=0;function check(label,fn){fn();n++;console.log('PASS',label)}
const {normalize,compound,dateKey,numeric}=market._test;
check('SGS DD/MM/AAAA ordenado',()=>assert.deepEqual(normalize([{data:'02/10/2026',valor:'1,3'},{data:'01/10/2026',valor:'1,2'}]).map(x=>x.date),['2026-10-01','2026-10-02']));
check('SGS zero legítimo',()=>assert.equal(numeric('0,00'),0));
check('SGS valor ausente nunca zero',()=>assert.equal(numeric(null),null));
check('IPCA precisa de 12 competências',()=>assert.equal(compound(Array(11).fill({value:0.2})),null));
check('IPCA composição 12 meses',()=>assert.ok(Math.abs(compound(Array(12).fill({value:1}))-12.68250301319697)<.000001));
check('datas inválidas ignoradas',()=>assert.equal(dateKey('2026-10-20'),''));
check('Tesouro números pt-BR',()=>assert.equal(treasury._test.number('1.234,56'),1234.56));
check('Tesouro impede domínio fora da fonte',()=>assert.equal(treasury._test.allowedHost('evil.com'),false));
check('Tesouro parser CSV tem valores válidos',()=>{
 const content='Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;PU Compra Manha\nTesouro Selic;01/03/2029;19/10/2026;0,15;15.123,22\nTesouro IPCA;15/08/2035;20/10/2026;6,40;4.512,77';
 const parsed=treasury._test.parseCsv(content);assert.equal(parsed.referenceDate,'2026-10-20');assert.equal(parsed.items.length,1);assert.equal(parsed.items[0].buyRate,6.4);assert.equal(parsed.items[0].buyPrice,4512.77);
});
check('Tesouro parser linha com ponto e vírgula entre aspas',()=>assert.deepEqual(treasury._test.rowParse('"Tesouro; IPCA";3,44'),['Tesouro; IPCA','3,44']));
check('Notícias categorias',()=>assert.equal(news._test.category('Copom elevou Selic'),'juros'));
check('Notícias RSS válido',()=>assert.equal(news._test.itemsFrom('<rss><item><title>Selic mudou</title><link>https://example.org/t</link><pubDate>Wed, 21 Oct 2026 12:00:00 GMT</pubDate></item></rss>','Teste').length,1));
const code=fs.readFileSync(path.join(root,'js','market.js'),'utf8');
const sandbox={module:{exports:{}},document:{addEventListener:()=>{}},setInterval:()=>0,Intl,console,Number,Date,Math,Array,JSON,localStorage:{getItem:()=>null,setItem:()=>{}}};
vm.runInNewContext(code,sandbox);
const cli=sandbox.module.exports;
check('Frontend null não é valor zero',()=>assert.equal(cli.marketValid(null),false));
check('Frontend zero real é válido',()=>assert.equal(cli.marketValid(0),true));
check('Histórico gráfico ordenado e filtrado',()=>{
 const rows=cli.marketHistoryRows({history:{selic:[{date:'2026-10-01',value:14},{date:'2026-09-20',value:13}]}},'selic','all');assert.equal(rows[0].value,13)
});
check('Gráfico produz SVG e títulos acessíveis',()=>{
 const s=cli.marketChartSVG([{date:'2026-10-01',value:1},{date:'2026-10-02',value:2}],'Dólar',v=>`R$ ${v}`);
 assert.match(s,/<svg/);assert.match(s,/<title>/);assert.match(s,/market-chart-line/)
});
function response(){return {code:0,headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(obj){this.body=obj;return this}}}
(async()=>{
 const old=global.fetch;
 try{
  global.fetch=async url=>{
   if(url.includes('1178'))return {ok:true,json:async()=>[{data:'20/10/2026',valor:'13,5'}]};
   if(url.includes('433'))return {ok:true,json:async()=>Array.from({length:12},(_,i)=>({data:`01/${String(i+1).padStart(2,'0')}/2026`,valor:'0,5'}))};
   throw Error('Serviço do dólar offline');
  };
  const r=response();await market({},r);check('Falha parcial da API não derruba o Mercado',()=>{assert.equal(r.code,200);assert.equal(r.body.status.dollar.ok,false);assert.equal(r.body.indicators.dollar.value,null);assert.ok(r.body.indicators.ipca12m.value>0)});
  global.fetch=async()=>{throw Error('offline')};market._test.store.clear();const no=response();await market({},no);check('Falha total retorna 503 sem cotações falsas',()=>{assert.equal(no.code,503);assert.equal(no.body.indicators.selic.value,null)});
 }finally{global.fetch=old}
 console.log(`${n} verificações Mercado 5.3.1 aprovadas`);
})().catch(e=>{console.error(e);process.exitCode=1});
