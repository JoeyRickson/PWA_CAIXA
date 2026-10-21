'use strict';
// Dataset oficial Tesouro Transparente. Não usa API aposentada que devolve 410.
const PACKAGE='https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id=taxas-dos-titulos-ofertados-pelo-tesouro-direto';
const allowedHost=host=>host==='tesourotransparente.gov.br'||host.endsWith('.tesourotransparente.gov.br');
async function get(url,timeout=18000){
  const u=new URL(url);if(u.protocol!=='https:'||!allowedHost(u.hostname))throw Error('Fonte fora do Tesouro Transparente');
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
  try{const r=await fetch(u.toString(),{signal:ctl.signal,headers:{Accept:'text/csv,application/json,text/plain,*/*'}});
    if(!r.ok)throw Error(`HTTP ${r.status}`);const length=Number(r.headers?.get?.('content-length')||0);
    if(length>24000000)throw Error('Arquivo acima do limite');const text=await r.text();if(text.length>24000000)throw Error('Arquivo acima do limite');return text;
  }finally{clearTimeout(timer)}
}
function rowParse(line,delimiter=';'){
  const out=[];let cur='',quoted=false;
  for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++}else quoted=!quoted}else if(c===delimiter&&!quoted){out.push(cur);cur=''}else cur+=c}out.push(cur);return out;
}
function norm(s){return String(s||'').replace(/^\uFEFF/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function number(s){if(s==null||String(s).trim()==='')return null;const v=String(s).trim();const normalized=v.includes(',')?v.replace(/\./g,'').replace(',','.'):v;const n=Number(normalized);return Number.isFinite(n)?n:null}
function date(s){const m=/(\d{2})\/(\d{2})\/(\d{4})/.exec(String(s||''));return m?`${m[3]}-${m[2]}-${m[1]}`:''}
function parseCsv(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(x=>x.trim());if(lines.length<2)throw Error('CSV sem registros');
  const delimiter=lines[0].includes(';')?';':',';const header=rowParse(lines[0],delimiter).map(norm);
  const idx=(...aliases)=>header.findIndex(h=>aliases.some(a=>h.includes(a)));
  const title=idx('tipo titulo','titulo'),base=idx('data base'),maturity=idx('data vencimento'),rate=idx('taxa compra manha','taxa compra'),price=idx('pu compra manha','pu compra');
  if(title<0||base<0)throw Error('Colunas esperadas não encontradas');
  let latest='',items=[];
  for(let i=1;i<lines.length;i++){
    const row=rowParse(lines[i],delimiter),stamp=date(row[base]);if(!stamp||stamp<latest)continue;
    if(stamp>latest){latest=stamp;items=[]}
    const name=String(row[title]||'').trim();if(!name)continue;
    items.push({name,maturity:maturity>=0?String(row[maturity]||'').trim():'',buyRate:rate>=0?number(row[rate]):null,buyPrice:price>=0?number(row[price]):null});
  }
  if(!items.length)throw Error('Nenhum título encontrado');
  // Não truncar alfabeticamente: isso ocultava os títulos Selic, Prefixado e Renda+.
  const rank=x=>/selic/i.test(x.name)?0:/ipca/i.test(x.name)?1:/prefixado/i.test(x.name)?2:/renda\+/i.test(x.name)?3:/educa\+/i.test(x.name)?4:5;
  const dedup=new Map();for(const item of items){const key=`${item.name}|${item.maturity}`;if(!dedup.has(key))dedup.set(key,item)}
  return {referenceDate:latest,items:[...dedup.values()].sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name,'pt-BR')||a.maturity.localeCompare(b.maturity)).slice(0,120)};
}
let memory=null;
async function retrieve(){
  const packageData=JSON.parse(await get(PACKAGE,8000));const resources=packageData?.result?.resources;
  if(!packageData?.success||!Array.isArray(resources))throw Error('Metadados de títulos indisponíveis');
  const resource=resources.find(x=>String(x.format||'').toUpperCase()==='CSV'&&/taxas|t[ií]tulos|pre[cç]os/i.test(`${x.name} ${x.description}`))||resources.find(x=>String(x.format||'').toUpperCase()==='CSV');
  if(!resource?.url)throw Error('Arquivo de taxas não encontrado');
  const data=parseCsv(await get(resource.url,21000));return {...data,generatedAt:new Date().toISOString(),source:'Tesouro Transparente',resourceModifiedAt:resource.last_modified||null};
}
async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=21600, stale-while-revalidate=86400');
  if(memory&&Date.now()-memory.time<21600000)return res.status(200).json(memory.data);
  try{const data=await retrieve();memory={time:Date.now(),data};return res.status(200).json(data)}catch(err){
    console.warn('Tesouro Transparente indisponível:',err?.message||err);
    if(memory)return res.status(200).json({...memory.data,stale:true});
    return res.status(503).json({generatedAt:new Date().toISOString(),source:'Tesouro Transparente',referenceDate:null,items:[],error:'Base de títulos temporariamente indisponível'});
  }
}
module.exports=handler;
module.exports._test={rowParse,norm,number,date,parseCsv,allowedHost};
