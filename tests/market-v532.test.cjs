'use strict';
// Regressões do Mercado v5.3.2: limites SGS, fallback, dados antigos, séries e UI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const market = require('../api/market.js');
const treasury = require('../api/treasury.js');
const { urls, store, dateKey, compound } = market._test;
let cases = 0;
function check(message, fn) { fn(); cases++; console.log('PASS', message); }
function response() { return { code: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.code = v; return this; }, json(v) { this.body = v; return this; } }; }
check('31/02 não é uma data SGS válida', () => assert.equal(dateKey('31/02/2026'), ''));
check('Consulta principal usa datas e fallback respeita limite de 20', () => {
  for (const n of [1178, 1, 433]) {
    const paths = urls(n, 450, new Date('2026-10-21T12:00:00Z'));
    assert.match(paths[0], /\/dados\?formato=json&dataInicial=/);
    assert.match(paths[0], /dataFinal=21\/10\/2026/);
    assert.match(paths[1], /\/dados\/ultimos\/20\?formato=json$/);
  }
});
check('IPCA calculado com últimas 12 observações', () => {
  const values = Array.from({ length: 13 }, (_, i) => ({ date: `2026-${String(i + 1).padStart(2, '0')}-01`, value: i === 0 ? 30 : 0 }));
  assert.equal(compound(values), 0);
});
check('Tesouro preserva a variedade de títulos, não só Educa+', () => {
  const text = 'Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;PU Compra Manha\n' +
    [...Array.from({length: 40}, (_,i) => `Tesouro Educa+;15/12/${2040+i};20/10/2026;6,40;2.000,00`),
      'Tesouro Selic;01/03/2031;20/10/2026;0,13;15.000,00',
      'Tesouro Prefixado;01/01/2029;20/10/2026;11,00;800,00',
      'Tesouro IPCA+;15/05/2035;20/10/2026;6,35;2.500,00'].join('\n');
  const rows = treasury._test.parseCsv(text).items;
  assert.equal(rows[0].name, 'Tesouro Selic');
  assert.ok(rows.find(x => /Prefixado/.test(x.name)));
  assert.ok(rows.find(x => /IPCA/.test(x.name)));
});
(async () => {
  const nativeFetch = global.fetch;
  try {
    const requests = [];
    global.fetch = async uri => {
      requests.push(uri);
      if (uri.includes('/dados?')) {
        if (uri.includes('.433/')) return {ok: true, json: async () => Array.from({length: 13}, (_,i) => ({data: `01/${String((i%12)+1).padStart(2,'0')}/${i===0?2025:2026}`,valor:'0.5'}))};
        return {ok: true, json: async () => [{data:'19/10/2026',valor:'13,50'},{data:'20/10/2026',valor:'13.65'}]};
      }
      throw Error('Fallback não deveria ser necessário');
    };
    store.clear();const r=response();await market({},r);
    check('Mercado usa períodos por datas e não ultrapassa o limite do SGS', () => {
      assert.equal(r.code,200);assert.equal(r.body.indicators.selic.value,13.65);
      assert.equal(r.body.indicators.dollar.value,13.65);
      assert.ok(r.body.history.selic.length>=2);
      assert.ok(requests.every(x=>x.includes('/dados?')));
      assert.equal(r.body.status.selic.mode,'intervalo');
    });
    requests.length=0;const r2=response();await market({},r2);
    check('Cache de backend evita consultas repetidas imediatamente',()=>assert.equal(requests.length,0));
    global.fetch=async uri => {
      if (uri.includes('/dados?')) return {ok:false,status:400,json:async()=>({erro:'máximo de 20'})};
      if (uri.includes('/ultimos/20')) return {ok:true,json:async()=>[{data:'20/10/2026',valor:'5,0140'}]};
      throw Error('Rota inesperada');
    };
    store.clear();const r3=response();await market({},r3);
    check('Fallback usa até 20 observações após HTTP 400 e segue funcionando',()=>{
      assert.equal(r3.code,200);assert.equal(r3.body.indicators.dollar.value,5.014);
      assert.equal(r3.body.status.dollar.mode,'últimas 20 observações');
    });
    global.fetch=async()=>{throw Error('Internet indisponível')};
    // Força revalidação simulando cache vencido, sem apagar observações.
    for(const [key,value] of store)store.set(key,{...value,fetchedAt:Date.now()-14*60*60_000});
    const r4=response();await market({},r4);
    check('Queda do BCB preserva último dado marcado como antigo',()=>{
      assert.equal(r4.code,200);assert.equal(r4.body.status.selic.stale,true);
      assert.equal(r4.body.status.dollar.ok,false);
      assert.match(r4.body.status.selic.message,/Últimos dados/);
    });
    store.clear();const r5=response();await market({},r5);
    check('Sem cache e sem rede: HTTP 503, sem cotações inventadas',()=>{
      assert.equal(r5.code,503);assert.equal(r5.body.indicators.selic.value,null);
      assert.equal(r5.headers['Cache-Control'],'no-store');
    });
  } finally {global.fetch=nativeFetch;store.clear()}

  const events = new Map(), elements = new Map();
  function node(id) {
    if (!elements.has(id)) elements.set(id,{id,dataset:{},textContent:'',innerHTML:'',value:'',hidden:false,disabled:false,
      classList:{toggle(){},contains(){return true}},setAttribute(){},replaceChildren(){}});
    return elements.get(id);
  }
  const chartButtons = ['selic','dollar','ipca'].map(x=>({dataset:{marketChart:x},classList:{toggle(){}},setAttribute(){}}));
  const rangeButtons = ['7','30','90','365','all'].map(x=>({dataset:{marketRange:x},classList:{toggle(){}},setAttribute(){}}));
  const sandbox={module:{exports:{}},document:{getElementById:node,addEventListener:(name,fn)=>events.set(name,fn),querySelectorAll:selector=>selector.includes('market-range')?rangeButtons:chartButtons,visibilityState:'visible'},
    localStorage:{getItem:()=>null,setItem:()=>{}},setInterval:()=>0,Intl,console,Number,Date,Math,Array,JSON,fetch:async()=>{throw Error('indisponível')},AbortController,setTimeout,clearTimeout};
  const code=fs.readFileSync(path.resolve(__dirname,'../js/market.js'),'utf8');vm.runInNewContext(code,sandbox);
  const cli=sandbox.module.exports;
  const timeRows=[{date:'2026-10-01',value:1},{date:'2026-10-02',value:2},{date:'2026-10-12',value:3}];
  check('Escala horizontal reflete intervalo real das datas',()=>{
    const svg=cli.marketChartSVG(timeRows,'Teste',String);
    const xs=[...svg.matchAll(/class="market-chart-point" cx="([\d.]+)"/g)].map(m=>Number(m[1]));
    assert.ok(xs[1]-xs[0] < (xs[2]-xs[1])/5);
  });
  check('Filtro descarta datas inválidas, mas mantém zero legítimo',()=>{
    const rows=cli.marketHistoryRows({history:{selic:[{date:'2026-02-31',value:1},{date:'2026-02-27',value:0}]}},'selic','all');
    assert.equal(rows.length,1);assert.equal(rows[0].value,0);
  });
  check('Filtro Tesouro classifica Selic, IPCA, Prefixado, Renda+ e Educa+',()=>{
    assert.equal(cli.marketTreasuryType('Tesouro Selic 2031'),'selic');
    assert.equal(cli.marketTreasuryType('Tesouro Renda+ 2050'),'renda');
    assert.equal(cli.marketTreasuryType('Tesouro Educa+ 2040'),'educa');
  });
  events.get('click')({target:{closest:selector=>selector==='[data-market-chart]'?{dataset:{marketChart:'dollar'}}:null}});
  check('Troca de indicador sem rede substitui o gráfico preso',()=>{
    assert.match(node('marketHistoryChart').innerHTML,/Não há dados suficientes/);
    assert.equal(node('marketChartDataStatus').textContent,'Sem dados para o gráfico');
  });
  events.get('click')({target:{closest:selector=>selector==='[data-market-chart]'?{dataset:{marketChart:'ipca'}}:null}});
  check('IPCA mensal desabilita períodos curtos não aplicáveis',()=>{
    assert.equal(rangeButtons[0].disabled,true);assert.equal(rangeButtons[1].disabled,true);
    assert.equal(rangeButtons[3].disabled,false);
  });
  const originals={planning:'views/planning.html',sync:'js/v51-live-sync.js',backup:'js/backup.js'};
  for(const f of Object.values(originals))assert.ok(fs.existsSync(path.resolve(__dirname,'..',f)));
  check('Arquivos principais de Planejamento, Sync e Backup preservados',()=>assert.equal(Object.keys(originals).length,3));
  console.log(`Mercado v5.3.2: ${cases} verificações adicionais PASS`);
})().catch(err=>{console.error(err);process.exitCode=1});
