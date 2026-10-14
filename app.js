const SALDOPLAN_VERSION='2.18.0';

const SALDOPLAN_VIEWS=[
  'dashboard',
  'transactions',
  'cycles',
  'portfolio',
  'patrimony',
  'cards',
  'savings',
  'simulator',
  'thirteenth',
  'fgts',
  'fixed',
  'market',
  'data',
  'about'
];

const SALDOPLAN_SCRIPTS=[
  'core',
  'recurrence',
  'history',
  'cards',
  'market',
  'portfolio',
  'dashboard',
  'payroll',
  'patrimony',
  'ui',
  'transactions',
  'savings',
  'overtime',
  'backup',
  'drive',
  'pwa'
];

async function saldoPlanFetchPartial(path){
  const response=await fetch(`${path}?v=${SALDOPLAN_VERSION}`,{cache:'no-cache'});
  if(!response.ok)throw new Error(`Falha ao carregar ${path} (${response.status})`);
  return response.text();
}

function saldoPlanLoadScript(src,{module=false}={}){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    if(module)script.type='module';
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error(`Falha ao carregar ${src}`));
    document.body.appendChild(script);
  });
}

async function saldoPlanBootstrap(){
  const main=document.querySelector('#appMain');
  const dialogHost=document.querySelector('#dialogHost');

  if(!main||!dialogHost){
    throw new Error('Estrutura principal do SaldoPlan não encontrada.');
  }

  const viewHtml=await Promise.all(
    SALDOPLAN_VIEWS.map(name=>saldoPlanFetchPartial(`views/${name}.html`))
  );

  main.innerHTML=viewHtml.join('\n');

  dialogHost.innerHTML=await saldoPlanFetchPartial('views/dialogs.html');

  for(const name of SALDOPLAN_SCRIPTS){
    await saldoPlanLoadScript(`js/${name}.js?v=${SALDOPLAN_VERSION}`);
  }

  await saldoPlanLoadScript(`auth.js?v=${SALDOPLAN_VERSION}`,{module:true});
}

saldoPlanBootstrap().catch(error=>{
  console.error(error);
  const main=document.querySelector('#appMain');
  if(main){
    main.innerHTML=`
      <section class="panel" style="margin:24px">
        <h2>Não foi possível iniciar o SaldoPlan</h2>
        <p class="helper">${String(error?.message||error)}</p>
        <button class="btn" type="button" onclick="location.reload()">Tentar novamente</button>
      </section>
    `;
  }
});
