'use strict';
// SaldoPlan v5.3.4: calendário RSS + fontes com fotos reais, e prévias Open Graph limitadas.
// Não lê dados pessoais nem utiliza chaves. Os itens são metadados públicos dos feeds.
const TZ='America/Sao_Paulo';
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
const escapeReg=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function decode(text){return String(text||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(_,e)=>{if(e[0]==='#'){const n=e[1]?.toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return Number.isInteger(n)&&n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):''}return entities[e]??`&${e};`})}
function strip(text){
 let value=String(text||'');
 // RSS de agregadores às vezes entrega HTML duplamente escapado (&amp;nbsp;).
 for(let i=0;i<3;i++){const next=decode(value);if(next===value)break;value=next}
 return value.replace(/<[^>]*>/g,' ').replace(/[\u00a0\u200b]/g,' ').replace(/\s+/g,' ').trim();
}
function rawTag(xml,name){return xml.match(new RegExp(`<${escapeReg(name)}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapeReg(name)}>`,'i'))?.[1]||''}
function tag(xml,name){return strip(rawTag(xml,name))}
function attr(open,key){return decode(open.match(new RegExp(`\\b${escapeReg(key)}\\s*=\\s*["']([^"']+)["']`,'i'))?.[1]||'')}
function safeUrl(value){try{const u=new URL(String(value||'').trim());if(u.protocol!=='https:'||u.username||u.password||u.href.length>1900)return '';return u.href}catch{return ''}}
function safeImageUrl(value){const url=safeUrl(value);return url&&!/\.svg(?:[?#]|$)/i.test(url)?url:''}
function imageFrom(xml){
 for(const type of ['media:content','media:thumbnail','enclosure','itunes:image']){
  const re=new RegExp(`<${escapeReg(type)}\\b[^>]*>`,'gi');let match;
  while((match=re.exec(xml))){const open=match[0],url=safeImageUrl(attr(open,'url')||attr(open,'href'));if(!url)continue;const mime=attr(open,'type');if(type==='enclosure'&&mime&&!/^image\//i.test(mime))continue;if(type==='media:content'&&mime&&!/^image\//i.test(mime))continue;return url}
 }
 const desc=decode(rawTag(xml,'description')||rawTag(xml,'content:encoded')||'');
 const im=desc.match(/<img\b[^>]*>/i)?.[0];return im?safeImageUrl(attr(im,'src')):'';
}
function dateBR(value){const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
 const get=k=>parts.find(x=>x.type===k)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`;
}
function monthBounds(raw,now=new Date()){
 const current=dateBR(now).slice(0,7);const min=new Date(`${current}-01T12:00:00Z`);min.setUTCMonth(min.getUTCMonth()-23);
 const oldest=min.toISOString().slice(0,7);
 const month=raw===undefined||raw===null||raw===''?current:String(raw);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<oldest||month>current)return null;
 const next=new Date(`${month}-01T12:00:00Z`);next.setUTCMonth(next.getUTCMonth()+1);
 return {month,start:`${month}-01`,end:next.toISOString().slice(0,10),current,oldest};
}
function category(t){if(/cvm|regula|fraude|golpe|fiscaliza/i.test(t))return 'regulacao';if(/tesouro/i.test(t))return 'tesouro';if(/cdb|lci|lca|renda fixa|cdi/i.test(t))return 'renda-fixa';if(/selic|ipca|infla|juros|copom/i.test(t))return 'juros';if(/banco|fintech/i.test(t))return 'bancos';if(/bolsa|ibovespa|fii|b3|aç(ã|õ)o/i.test(t))return 'bolsa';return 'mercado'}
function extract(xml,source,month,now=new Date()){
 const blocks=[...(String(xml||'').match(/<item\b[\s\S]*?<\/item>/gi)||[]),...(String(xml||'').match(/<entry\b[\s\S]*?<\/entry>/gi)||[])];
 const today=dateBR(now);
 return blocks.slice(0,150).map(block=>{
  const title=tag(block,'title').slice(0,240),sourceTag=tag(block,'source');
  let link=safeUrl(tag(block,'link'));
  if(!link){const opening=block.match(/<link\b[^>]*>/i)?.[0];link=opening?safeUrl(attr(opening,'href')):''}
  const dateRaw=tag(block,'pubDate')||tag(block,'published')||tag(block,'updated')||tag(block,'dc:date');
  const d=new Date(dateRaw),publishedAt=Number.isFinite(d.getTime())?d.toISOString():null;
  const day=publishedAt?dateBR(d):'';
  const rawDescription=rawTag(block,'description')||rawTag(block,'summary')||rawTag(block,'content:encoded');
  const summary=(source==='Economia brasileira'||source==='Investimentos'?'':strip(rawDescription).replace(title,'').trim()).slice(0,360);
  return {title,url:link,source:sourceTag||source,category:category(title+' '+summary),publishedAt,day,summary,imageUrl:imageFrom(block)};
 }).filter(x=>x.title&&x.url&&x.publishedAt&&x.day.startsWith(month)&&x.day<=today&&Date.parse(x.publishedAt)<=now.getTime()+3600000);
}
function googleUrl(query,bounds){const phrase=`${query} after:${bounds.start} before:${bounds.end}`;return `https://news.google.com/rss/search?q=${encodeURIComponent(phrase)}&hl=pt-BR&gl=BR&ceid=BR%3Apt-419`}
function sources(bounds){return [
 {name:'Agência Brasil · Economia',url:'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml'},
 {name:'Banco Central',url:`https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/noticias?ano=${bounds.month.slice(0,4)}`},
 {name:'Banco Central · Focus',url:'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/focus'},
 {name:'CVM',url:'https://www.gov.br/cvm/pt-br/assuntos/noticias/@@rss'},
 {name:'Economia brasileira',url:googleUrl('Selic OR IPCA OR inflação OR Copom OR "Banco Central"',bounds)},
 {name:'Investimentos',url:googleUrl('"Tesouro Direto" OR CDB OR Ibovespa OR "renda fixa"',bounds)}
]}
async function pull(feed,bounds){const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),6500);
 try{const resp=await fetch(feed.url,{signal:ctrl.signal,headers:{Accept:'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*'}});if(!resp.ok)throw Error(`HTTP ${resp.status}`);
 const xml=await resp.text();if(xml.length>2_000_000)throw Error('Feed maior que o limite');return extract(xml,feed.name,bounds.month);
 }finally{clearTimeout(timer)}}
function dedupe(rows){const map=new Map();for(const row of rows){const key=row.title.toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu,' ').trim();if(!key)continue;
 const old=map.get(key);if(!old||(row.imageUrl&&!old.imageUrl)||(!old.summary&&row.summary))map.set(key,row);
 }return [...map.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,90)}
// Uma imagem ausente no Google Notícias não pode ser inferida do RSS:
// só consultamos o HTML original se a URL for de um veículo autorizado.
const PREVIEW_HOSTS=new Set(['agenciabrasil.ebc.com.br','www.bcb.gov.br','www.gov.br']);
function previewHost(url){
 try{const u=new URL(safeUrl(url));return PREVIEW_HOSTS.has(u.hostname.toLowerCase())&&u.port===''?u.href:''}catch{return ''}
}
function ogImage(html,pageUrl){
 const headers=String(html||'').slice(0,180000);
 const tags=headers.match(/<meta\b[^>]*>/gi)||[];
 for(const meta of tags){
  const property=attr(meta,'property')||attr(meta,'name');
  if(!/^(?:og:image(?::secure_url|:url)?|twitter:image(?::src)?)$/i.test(property))continue;
  const raw=attr(meta,'content');if(!raw)continue;
  try{const link=safeImageUrl(new URL(raw,pageUrl).href);if(link)return link}catch{}
 }
 return '';
}
async function tryArticleImage(item){
 const url=previewHost(item.url);if(!url||item.imageUrl)return item;
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),3000);
 try{
  const res=await fetch(url,{signal:abort.signal,redirect:'manual',headers:{Accept:'text/html'}});
  if(!res.ok||!/^text\/html/i.test(res.headers?.get?.('content-type')||''))return item;
  const size=Number(res.headers?.get?.('content-length')||0);
  if(size>400000)return item;
  // Ler somente a seção inicial da página, sem baixar imagens nem corpo inteiro.
  let html='';
  if(res.body?.getReader){
   const reader=res.body.getReader();try{while(html.length<180000){const part=await reader.read();if(part.done)break;html+=new TextDecoder().decode(part.value);if(/<\/head\s*>/i.test(html))break}}finally{await reader.cancel().catch(()=>{})}
  }else html=String(await res.text()).slice(0,180000);
  const img=ogImage(html,url);return img?{...item,imageUrl:img}:item;
 }catch{return item}finally{clearTimeout(timer)}
}
async function enrichImages(items){
 const pending=items.map((item,i)=>({item,i})).filter(x=>!x.item.imageUrl&&previewHost(x.item.url)).slice(0,4);
 if(!pending.length)return items;
 const results=await Promise.all(pending.map(x=>tryArticleImage(x.item)));
 const out=items.slice();pending.forEach((x,i)=>{out[x.i]=results[i]});return out;
}
async function handler(req,res){
 const raw=req?.query?.month;const bounds=monthBounds(Array.isArray(raw)?'invalid':raw);
 if(!bounds){res.setHeader('Cache-Control','no-store');return res.status(400).json({error:'Mês inválido ou fora do intervalo de 24 meses.'})}
 const feeds=sources(bounds);
 const outcomes=await Promise.allSettled(feeds.map(f=>pull(f,bounds)));
 const items=await enrichImages(dedupe(outcomes.flatMap(r=>r.status==='fulfilled'?r.value:[])));
 const sourceStatus=outcomes.map((r,i)=>({name:feeds[i].name,ok:r.status==='fulfilled',count:r.status==='fulfilled'?r.value.length:0}));
 const connected=sourceStatus.some(x=>x.ok);
 const isCurrent=bounds.month===bounds.current;
 res.setHeader('Cache-Control',connected?(isCurrent?'public, s-maxage=600, stale-while-revalidate=1200':'public, s-maxage=3600, stale-while-revalidate=7200'):'no-store');
 return res.status(connected?200:503).json({generatedAt:new Date().toISOString(),month:bounds.month,items,sourceStatus,partial:sourceStatus.some(x=>!x.ok),archiveComplete:false,coverage:'Imagens exibidas quando fornecidas pela fonte ou pela página original; algumas notícias do Google Notícias não incluem foto. O histórico é parcial.',error:connected?null:'Fontes de notícias temporariamente indisponíveis'});
}
module.exports=handler;
module.exports._test={strip,previewHost,ogImage,enrichImages,tryArticleImage,sources,itemsFrom:(xml,source)=>extract(xml,source,dateBR(new Date()).slice(0,7)),decode,strip,tag,safeUrl,safeImageUrl,imageFrom,extract,category,monthBounds,googleUrl,dedupe,dateBR};
