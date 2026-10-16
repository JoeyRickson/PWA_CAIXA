const SALDOPLAN_VERSION='5.1.4';

const SALDOPLAN_VIEWS=[
  'dashboard',
  'transactions',
  'importer',
  'calendar',
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
  'about',
  'support',
  'intelligence'
];

const SALDOPLAN_SCRIPTS=[
  'core',
  'recurrence',
  'history',
  'importer',
  'cards',
  'market',
  'portfolio',
  'dashboard',
  'payroll',
  'patrimony',
  'calendar',
  'ui',
  'transactions',
  'savings',
  'overtime',
  'backup',
  'drive',
  'pwa',
  'mobile-nav',
  'themes',
  'motion',
  'support',
  'intelligence',
  'sp3-tools',
  'sp3-sync',
  'sp3-tickets',
  'v4-features',
  'v4-push',
  'v5-engine',
  'v5-features',
  'v5-admin',
  'v51-live-engine',
  'v51-live-sync'
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

  // Rótulos da aba Sobre acompanham a versão sem cadastro manual.
  main.querySelectorAll('[data-saldoplan-version]').forEach(label=>{
    label.textContent=`v${SALDOPLAN_VERSION}`;
  });

  dialogHost.innerHTML=await saldoPlanFetchPartial('views/dialogs.html');

  for(const name of SALDOPLAN_SCRIPTS){
    await saldoPlanLoadScript(`js/${name}.js?v=${SALDOPLAN_VERSION}`);
  }

  await saldoPlanLoadScript(`auth.js?v=${SALDOPLAN_VERSION}`,{module:true});
  window.saldoPlanMotion?.finishStartup();
}

saldoPlanBootstrap().catch(error=>{
  console.error(error);
  window.saldoPlanMotion?.finishStartup();
  document.getElementById('spStartup')?.remove();
  document.getElementById('appMain')?.removeAttribute('aria-busy');
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

// Um carregamento travado nunca deixa o usuário sem saída.
const spStartupTimeout=setTimeout(()=>{
  const splash=document.getElementById('spStartup');
  if(!splash||splash.classList.contains('sp-startup-leaving'))return;
  const status=splash.querySelector('#spStartupStatus');
  if(status)status.textContent='O carregamento está demorando. Verifique sua conexão.';
  const retry=splash.querySelector('#spStartupRetry');
  if(retry)retry.hidden=false;
},12000);
document.getElementById('spStartupRetry')?.addEventListener('click',()=>location.reload());
