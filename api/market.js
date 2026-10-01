const TREASURY_CSV =
  'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv';

function timeoutSignal(ms){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);
  return {signal:controller.signal,clear:()=>clearTimeout(timer)};
}

async function fetchText(url,ms=12000){
  const t=timeoutSignal(ms);
  try{
    const response=await fetch(url,{
      signal:t.signal,
      headers:{
        'User-Agent':'SaldoPlan/2.9 (+https://saldoplan.vercel.app)',
        'Accept':'application/json,text/plain,text/csv,application/xml,text/xml,*/*'
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

async function bcbSeries(code,count=1){
  const url=`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/${count}?formato=json`;
  const data=await fetchJson(url);
  return Array.isArray(data)?data:[];
}

function numeric(value){
  const n=Number(String(value??'').trim().replace(',','.'));
  return Number.isFinite(n)?n:null;
}

function compoundPercent(values){
  if(!values.length)return null;
  const factor=values.reduce((acc,value)=>acc*(1+Number(value)/100),1);
  return (factor-1)*100;
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
  const m=String(value||'').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if(!m)return 0;
  return Number(`${m[3]}${m[2]}${m[1]}`);
}

async function treasuryData(){
  const text=await fetchText(TREASURY_CSV,15000);
  const lines=text.split(/\r?\n/).filter(Boolean);

  if(lines.length<2)return {date:null,items:[]};

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
    return {date:null,items:[]};
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

  const rows=parsed
    .filter(x=>x.score===latestScore)
    .map(({row})=>({
      name:String(row[nameIndex]||'').trim(),
      maturity:maturityIndex>=0?String(row[maturityIndex]||'').trim():'',
      buyRate:rateIndex>=0?brNumber(row[rateIndex]):null,
      buyPrice:priceIndex>=0?brNumber(row[priceIndex]):null
    }))
    .filter(x=>x.name)
    .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'))
    .slice(0,14);

  return {date:latestDate,items:rows};
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=300, stale-while-revalidate=900');

  const [selicResult,dollarResult,ipcaResult,treasuryResult]=await Promise.allSettled([
    bcbSeries(1178,1),
    bcbSeries(1,1),
    bcbSeries(433,13),
    treasuryData()
  ]);

  const selicRows=selicResult.status==='fulfilled'?selicResult.value:[];
  const dollarRows=dollarResult.status==='fulfilled'?dollarResult.value:[];
  const ipcaRows=ipcaResult.status==='fulfilled'?ipcaResult.value:[];
  const treasury=treasuryResult.status==='fulfilled'
    ?treasuryResult.value
    :{date:null,items:[]};

  const lastSelic=selicRows[selicRows.length-1]||null;
  const lastDollar=dollarRows[dollarRows.length-1]||null;

  const ipcaLast12=ipcaRows
    .map(x=>numeric(x.valor))
    .filter(Number.isFinite)
    .slice(-12);

  const lastIpcaRow=ipcaRows[ipcaRows.length-1]||null;

  res.status(200).json({
    generatedAt:new Date().toISOString(),
    indicators:{
      selic:{
        value:lastSelic?numeric(lastSelic.valor):null,
        date:lastSelic?.data||null,
        source:'Banco Central do Brasil - SGS 1178'
      },
      dollar:{
        value:lastDollar?numeric(lastDollar.valor):null,
        date:lastDollar?.data||null,
        source:'Banco Central do Brasil - SGS 1'
      },
      ipca12m:{
        value:compoundPercent(ipcaLast12),
        reference:lastIpcaRow?.data||null,
        source:'Banco Central do Brasil / IBGE - SGS 433'
      }
    },
    treasuryDate:treasury.date,
    treasury:treasury.items,
    sources:[
      {
        name:'Banco Central do Brasil',
        url:'https://dadosabertos.bcb.gov.br/'
      },
      {
        name:'Tesouro Transparente',
        url:'https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto'
      }
    ]
  });
};