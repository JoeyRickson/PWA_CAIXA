function timeoutSignal(ms){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  return {signal:controller.signal,clear:()=>clearTimeout(timer)};
}

async function fetchText(url,ms=10000){
  const t=timeoutSignal(ms);

  try{
    const response=await fetch(url,{
      signal:t.signal,
      headers:{
        'User-Agent':'SaldoPlan/2.9.1 (+https://saldoplan.vercel.app)',
        'Accept':'application/rss+xml,application/atom+xml,application/xml,text/xml,text/plain,*/*'
      }
    });

    if(!response.ok){
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return await response.text();
  }finally{
    t.clear();
  }
}

function decodeXml(value=''){
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
    .replace(/&amp;/g,'&')
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g,'')
    .trim();
}

function tag(block,name){
  const match=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));
  return match?decodeXml(match[1]):'';
}

function linkFrom(block){
  const rss=tag(block,'link');
  if(/^https?:\/\//i.test(rss))return rss;

  const atom=block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  return atom?decodeXml(atom[1]):'';
}

function category(title,source){
  const text=`${title} ${source}`.toLowerCase();

  if(/cvm|regula|fraude|golpe|sancion|normativ|resolu/.test(text))return 'regulacao';
  if(/tesouro|titulo publico|título público/.test(text))return 'tesouro';
  if(/cdb|lci|lca|renda fixa|cdi|debentur/.test(text))return 'renda-fixa';
  if(/selic|copom|ipca|infla|juros/.test(text))return 'juros';
  if(/banco|fintech|nubank|inter|itau|itaú|bradesco|santander/.test(text))return 'bancos';
  if(/ibovespa|b3|acao|ação|acoes|ações|bolsa|fii|fundo imobili/.test(text))return 'bolsa';

  return 'mercado';
}

function impactFor(category){
  const impacts={
    'renda-fixa':'Pode afetar renda fixa',
    'juros':'Pode afetar juros e CDI',
    'tesouro':'Pode afetar Tesouro',
    'bancos':'Pode afetar produtos bancários',
    'bolsa':'Pode afetar bolsa',
    'regulacao':'Atenção regulatória',
    'mercado':'Acompanhar contexto'
  };

  return impacts[category]||impacts.mercado;
}

function normalizeDate(value){
  const d=new Date(value);
  return Number.isNaN(d.getTime())?null:d;
}

function parseFeed(xml,source){
  const blocks=[
    ...(xml.match(/<item\b[\s\S]*?<\/item>/gi)||[]),
    ...(xml.match(/<entry\b[\s\S]*?<\/entry>/gi)||[])
  ];

  return blocks.map(block=>{
    const title=tag(block,'title');
    const url=linkFrom(block);
    const dateText=tag(block,'pubDate')||tag(block,'published')||tag(block,'updated');
    const published=normalizeDate(dateText);
    const itemCategory=category(title,source);

    return {
      title,
      url,
      source,
      category:itemCategory,
      impact:impactFor(itemCategory),
      publishedAt:published?published.toISOString():null,
      publishedLabel:published
        ?published.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})
        :''
    };
  }).filter(x=>x.title && /^https?:\/\//i.test(x.url));
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');

  const year=new Date().getUTCFullYear();

  const sources=[
    {
      name:'Banco Central',
      url:`https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/noticias?ano=${year}`
    },
    {
      name:'Banco Central - Focus',
      url:'https://www.bcb.gov.br/api/feed/sitebcb/sitefeeds/focus'
    },
    {
      name:'CVM',
      url:'https://www.cvm.gov.br/feed/legislacao.xml'
    },
    {
      name:'Notícias do mercado',
      url:'https://news.google.com/rss/search?q=investimentos%20OR%20Selic%20OR%20CDB%20OR%20%22Tesouro%20Direto%22%20OR%20Ibovespa%20when%3A2d&hl=pt-BR&gl=BR&ceid=BR%3Apt-419'
    }
  ];

  const results=await Promise.allSettled(
    sources.map(async source=>({
      source,
      xml:await fetchText(source.url)
    }))
  );

  const items=[];

  for(const result of results){
    if(result.status!=='fulfilled')continue;
    items.push(...parseFeed(result.value.xml,result.value.source.name));
  }

  const unique=[];
  const seen=new Set();

  for(const item of items.sort((a,b)=>{
    return String(b.publishedAt||'').localeCompare(String(a.publishedAt||''));
  })){
    const key=item.title.toLowerCase().replace(/\s+/g,' ').trim();

    if(seen.has(key))continue;

    seen.add(key);
    unique.push(item);

    if(unique.length>=30)break;
  }

  res.status(200).json({
    generatedAt:new Date().toISOString(),
    items:unique,
    sourceStatus:results.map((result,index)=>({
      name:sources[index].name,
      ok:result.status==='fulfilled'
    }))
  });
};