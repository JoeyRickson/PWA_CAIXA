const PACKAGE_API =
  'https://www.tesourotransparente.gov.br/ckan/api/3/action/package_show?id=taxas-dos-titulos-ofertados-pelo-tesouro-direto';

function timeoutSignal(ms){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);

  return {
    signal:controller.signal,
    clear:()=>clearTimeout(timer)
  };
}

async function fetchText(url,ms=30000){
  const t=timeoutSignal(ms);

  try{
    const response=await fetch(url,{
      signal:t.signal,
      headers:{
        'User-Agent':'SaldoPlan/2.10.2 (+https://saldoplan.vercel.app)',
        'Accept':'application/json,text/csv,text/plain,*/*'
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

async function fetchJson(url,ms=10000){
  return JSON.parse(await fetchText(url,ms));
}

function csvLine(line){
  const out=[];
  let value='';
  let quoted=false;

  for(let i=0;i<line.length;i++){
    const ch=line[i];

    if(ch==='"'){
      if(quoted && line[i+1]==='"'){
        value+='"';
        i++;
      }else{
        quoted=!quoted;
      }
    }else if(ch===';' && !quoted){
      out.push(value);
      value='';
    }else{
      value+=ch;
    }
  }

  out.push(value);
  return out;
}

function cleanKey(value){
  return String(value||'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}

function brNumber(value){
  const text=String(value??'').trim();
  if(!text)return null;

  const normalized=text.includes(',')
    ?text.replace(/\./g,'').replace(',','.')
    :text;

  const n=Number(normalized);
  return Number.isFinite(n)?n:null;
}

function dateScore(value){
  const m=String(value||'').match(
    /(\d{2})\/(\d{2})\/(\d{4})/
  );

  if(!m)return 0;

  return Number(`${m[3]}${m[2]}${m[1]}`);
}

async function discoverCsv(){
  const payload=await fetchJson(PACKAGE_API,10000);

  if(!payload?.success || !Array.isArray(payload?.result?.resources)){
    throw new Error('Metadados do Tesouro não retornaram recursos');
  }

  const resource=payload.result.resources.find(r=>
    String(r.format||'').toUpperCase()==='CSV' &&
    /taxas|titulos|títulos|tesouro/i.test(
      `${r.name||''} ${r.description||''}`
    )
  ) || payload.result.resources.find(r=>
    String(r.format||'').toUpperCase()==='CSV'
  );

  if(!resource?.url){
    throw new Error('CSV oficial do Tesouro não encontrado');
  }

  return {
    url:resource.url,
    modified:resource.last_modified||
      resource.created||
      payload.result.metadata_modified||
      null
  };
}

async function treasuryData(){
  const resource=await discoverCsv();
  const text=await fetchText(resource.url,30000);
  const lines=text.split(/\r?\n/).filter(Boolean);

  if(lines.length<2){
    throw new Error('CSV oficial vazio');
  }

  const headers=csvLine(lines[0]).map(cleanKey);

  const idx=(...needles)=>{
    for(const needle of needles){
      const found=headers.findIndex(h=>h.includes(needle));
      if(found>=0)return found;
    }
    return -1;
  };

  const nameIndex=idx('tipo titulo','titulo');
  const maturityIndex=idx('data vencimento','vencimento');
  const dateIndex=idx('data base','data');
  const rateIndex=idx('taxa compra manha','taxa compra');
  const priceIndex=idx('pu compra manha','pu compra');

  if(nameIndex<0 || dateIndex<0){
    throw new Error('Formato do CSV do Tesouro não reconhecido');
  }

  let latestScore=0;
  let latestDate=null;
  const parsed=[];

  for(let i=1;i<lines.length;i++){
    const row=csvLine(lines[i]);
    const baseDate=row[dateIndex];
    const score=dateScore(baseDate);

    if(score>latestScore){
      latestScore=score;
      latestDate=baseDate;
    }

    parsed.push({row,score});
  }

  const items=parsed
    .filter(x=>x.score===latestScore)
    .map(({row})=>({
      name:String(row[nameIndex]||'').trim(),
      maturity:maturityIndex>=0
        ?String(row[maturityIndex]||'').trim()
        :'',
      buyRate:rateIndex>=0
        ?brNumber(row[rateIndex])
        :null,
      buyPrice:priceIndex>=0
        ?brNumber(row[priceIndex])
        :null
    }))
    .filter(x=>x.name)
    .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
    .slice(0,20);

  return {
    generatedAt:new Date().toISOString(),
    referenceDate:latestDate,
    resourceModifiedAt:resource.modified,
    source:'Tesouro Transparente',
    items
  };
}

module.exports=async function handler(req,res){
  res.setHeader(
    'Cache-Control',
    's-maxage=21600, stale-while-revalidate=86400'
  );

  try{
    const data=await treasuryData();
    res.status(200).json(data);
  }catch(error){
    console.error(
      'Falha ao consultar Tesouro:',
      error?.message||error
    );

    res.status(503).json({
      generatedAt:new Date().toISOString(),
      referenceDate:null,
      source:'Tesouro Transparente',
      items:[],
      error:'Fonte oficial temporariamente indisponível'
    });
  }
};