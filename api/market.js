function timeoutSignal(ms){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),ms);

  return {
    signal:controller.signal,
    clear:()=>clearTimeout(timer)
  };
}

async function fetchText(url,ms=10000){
  const t=timeoutSignal(ms);

  try{
    const response=await fetch(url,{
      signal:t.signal,
      headers:{
        'User-Agent':'SaldoPlan/2.10.2 (+https://saldoplan.vercel.app)',
        'Accept':'application/json,text/plain,*/*'
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
  const text=String(value??'').trim();
  if(!text)return null;

  const n=Number(text.replace(',','.'));
  return Number.isFinite(n)?n:null;
}

function lastValidRow(rows){
  for(let i=rows.length-1;i>=0;i--){
    if(numeric(rows[i]?.valor)!==null){
      return rows[i];
    }
  }
  return null;
}

function historyRows(rows){
  return rows
    .map(row=>({
      date:String(row.data||''),
      value:numeric(row.valor)
    }))
    .filter(row=>row.date&&row.value!==null);
}

function compoundPercent(values){
  const valid=values
    .map(numeric)
    .filter(value=>value!==null);

  if(!valid.length)return null;

  const factor=valid.reduce(
    (acc,value)=>acc*(1+Number(value)/100),
    1
  );

  return (factor-1)*100;
}

module.exports=async function handler(req,res){
  res.setHeader(
    'Cache-Control',
    's-maxage=300, stale-while-revalidate=900'
  );

  const [
    selicResult,
    dollarResult,
    ipcaResult
  ]=await Promise.allSettled([
    bcbSeries(1178,31),
    bcbSeries(1,31),
    bcbSeries(433,13)
  ]);

  const selicRows=
    selicResult.status==='fulfilled'
      ?selicResult.value
      :[];

  const dollarRows=
    dollarResult.status==='fulfilled'
      ?dollarResult.value
      :[];

  const ipcaRows=
    ipcaResult.status==='fulfilled'
      ?ipcaResult.value
      :[];

  const lastSelic=lastValidRow(selicRows);
  const lastDollar=lastValidRow(dollarRows);

  const validIpcaRows=ipcaRows.filter(
    row=>numeric(row?.valor)!==null
  );

  const lastIpcaRow=
    validIpcaRows[validIpcaRows.length-1]||null;

  const ipcaLast12=validIpcaRows
    .slice(-12)
    .map(x=>numeric(x.valor));

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
    history:{
      selic:historyRows(selicRows),
      dollar:historyRows(dollarRows),
      ipca:historyRows(validIpcaRows)
    }
  });
};