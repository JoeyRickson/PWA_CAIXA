/* SaldoPlan 2.20.8 — Animação só em transições, não durante edição de valores. */
(function(){
  'use strict';
  let started=false;
  let refreshing=null;
  let refreshTimer=null;
  const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)');

  function finishStartup(){
    if(started)return;
    started=true;
    document.getElementById('appMain')?.removeAttribute('aria-busy');
    document.body.classList.add('sp-motion-ready');
    const splash=document.getElementById('spStartup');
    if(!splash)return;
    if(reduceMotion?.matches){splash.remove();return;}
    splash.classList.add('sp-startup-leaving');
    splash.addEventListener('transitionend',()=>splash.remove(),{once:true});
    setTimeout(()=>splash.remove(),550);
  }

  // Reanima apenas áreas de consulta quando a pessoa troca mês, ano ou filtro.
  function refreshActiveView(){
    if(reduceMotion?.matches)return;
    requestAnimationFrame(()=>{
      const view=document.querySelector('.view.active');
      if(!view)return;
      if(refreshing&&refreshing!==view)refreshing.classList.remove('sp-content-swap');
      view.classList.remove('sp-content-swap');
      void view.offsetWidth;
      view.classList.add('sp-content-swap');
      refreshing=view;
      clearTimeout(refreshTimer);
      refreshTimer=setTimeout(()=>view.classList.remove('sp-content-swap'),360);
    });
  }
  const timeNavigation=/^(?:prev|next)(?:Month|TransactionMonth|CalendarMonth|CardsMonth|CycleMonth|SimMonth|ThirteenthYear|FgtsYear)$/;
  document.addEventListener('click',event=>{
    const el=event.target.closest('button');
    if(!el)return;
    if(timeNavigation.test(el.id)||el.classList.contains('chip')||el.hasAttribute('data-filter')){
      refreshActiveView();
    }
  });

  window.saldoPlanMotion={finishStartup};
})();
