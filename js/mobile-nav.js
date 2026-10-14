/* SaldoPlan Mobile Experience v2.20.2: apenas navegação e layout. */
(function(){
  'use strict';
  const layer=document.getElementById('mobileMenuLayer');
  const trigger=document.getElementById('mobileMoreBtn');
  const closeButton=document.getElementById('mobileMenuClose');
  const backdrop=document.getElementById('mobileMenuBackdrop');
  const sheet=layer?.querySelector('.mobile-menu-sheet');
  const mobileClockSlot=document.getElementById('mobileClockSlot');
  const clock=document.querySelector('.live-clock');
  if(!layer||!trigger||!sheet||!clock||!mobileClockSlot)return;

  // Movimentar o relogio existente preserva o mesmo seletor, valores e eventos.
  const clockAnchor=document.createComment('Posicao original do relogio');
  clock.parentNode.insertBefore(clockAnchor,clock);
  const phoneMedia=window.matchMedia('(max-width: 899px)');
  const primary=new Set(['dashboard','transactions','cards','calendar']);
  let lastFocused=null;

  function syncClock(){
    if(phoneMedia.matches){
      if(clock.parentNode!==mobileClockSlot)mobileClockSlot.appendChild(clock);
    }else if(clock.parentNode!==clockAnchor.parentNode && clockAnchor.parentNode){
      clockAnchor.parentNode.insertBefore(clock,clockAnchor.nextSibling);
    }
    if(document.body.dataset.layoutEffective==='desktop' && !layer.hidden)closeMenu(false);
  }
  function visibleFocusables(){
    return Array.from(sheet.querySelectorAll('button:not([disabled]), select:not([disabled]), input:not([disabled])'))
      .filter(el=>el.getClientRects().length>0);
  }
  function openMenu(){
    if(document.body.dataset.layoutEffective==='desktop')return;
    lastFocused=document.activeElement;
    layer.hidden=false;
    document.body.classList.add('mobile-menu-open');
    trigger.setAttribute('aria-expanded','true');
    syncClock();
    closeButton.focus();
  }
  function closeMenu(restoreFocus=true){
    if(layer.hidden)return;
    layer.hidden=true;
    document.body.classList.remove('mobile-menu-open');
    trigger.setAttribute('aria-expanded','false');
    if(restoreFocus && lastFocused && lastFocused.isConnected)lastFocused.focus();
    lastFocused=null;
  }
  window.syncMobileNavigation=function(view){
    const secondary=!primary.has(view);
    trigger.classList.toggle('active',secondary);
    if(secondary)trigger.setAttribute('aria-current','page');
    else trigger.removeAttribute('aria-current');
    layer.querySelectorAll('[data-nav]').forEach(btn=>{
      if(btn.dataset.nav===view)btn.setAttribute('aria-current','page');
      else btn.removeAttribute('aria-current');
    });
    closeMenu(false);
  };
  trigger.addEventListener('click',()=>layer.hidden?openMenu():closeMenu());
  closeButton.addEventListener('click',()=>closeMenu());
  backdrop.addEventListener('click',()=>closeMenu());
  // O click em [data-nav] continua atendido pelo roteador atual (js/ui.js).
  layer.addEventListener('click',event=>{
    if(event.target.closest('[data-nav]'))closeMenu(false);
  });
  document.addEventListener('keydown',event=>{
    if(layer.hidden)return;
    if(event.key==='Escape'){
      event.preventDefault();closeMenu();return;
    }
    if(event.key==='Tab'){
      const items=visibleFocusables();
      if(items.length===0)return;
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  // Ao alternar desktop/mobile, nao criar um segundo seletor de fuso.
  window.addEventListener('resize',syncClock,{passive:true});
  new MutationObserver(()=>{
    if(document.body.dataset.layoutEffective==='desktop')closeMenu(false);
  }).observe(document.body,{attributes:true,attributeFilter:['data-layout-effective']});
  syncClock();
  const active=document.querySelector('.view.active');
  if(active)window.syncMobileNavigation(active.id.replace(/^view-/,''));
})();
