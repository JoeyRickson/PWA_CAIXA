/* SaldoPlan v2.20.5 — Aparências independentes dos dados financeiros. */
(function(){
  'use strict';
  const KEY='saldoplan.visualTheme.v1';
  const THEMES=[{"id":"light","name":"Claro original","description":"Minimalista e leve","dark":0,"bg":"#f3f4f6","surface":"#ffffff","line":"#e5e7eb","brand":"#111827","brandInk":"#ffffff","accent":"#16a34a"},{"id":"dark","name":"Escuro original","description":"Contraste e conforto","dark":1,"bg":"#070a0f","surface":"#11151d","line":"#29303c","brand":"#e2e8f0","brandInk":"#111827","accent":"#4ade80"},{"id":"graphite","name":"Graphite","description":"Profissional grafite","dark":1,"bg":"#090d12","surface":"#10161f","line":"#263141","brand":"#17202c","brandInk":"#ffffff","accent":"#60a5fa"},{"id":"midnight","name":"Midnight","description":"Noite azul-profundo","dark":1,"bg":"#060813","surface":"#0d1220","line":"#222d48","brand":"#1a2650","brandInk":"#ffffff","accent":"#8b8cff"},{"id":"aero","name":"Frutiger Aero","description":"Céu, água e brilho","dark":0,"bg":"#d0ecf6","surface":"#f5fcff","line":"#89c3da","brand":"#08709e","brandInk":"#ffffff","accent":"#0b866b"},{"id":"luna","name":"Windows XP Luna","description":"Azul, verde e relevo","dark":0,"bg":"#dce7f7","surface":"#ffffff","line":"#87a8d3","brand":"#1357ad","brandInk":"#ffffff","accent":"#27894f"},{"id":"win95","name":"Windows 95","description":"Janelas cinza e cantos retos","dark":0,"bg":"#bdbdbd","surface":"#e1e1e1","line":"#777777","brand":"#080878","brandInk":"#ffffff","accent":"#006b70"},{"id":"vista","name":"Vista Glass","description":"Transparência e brilho","dark":0,"bg":"#d9e8ef","surface":"#f3fbff","line":"#9bc1d0","brand":"#203b61","brandInk":"#ffffff","accent":"#087eaa"},{"id":"winmobile","name":"Windows Mobile","description":"Azul metálico compacto","dark":0,"bg":"#c9dce9","surface":"#f5faff","line":"#94b5ce","brand":"#174977","brandInk":"#ffffff","accent":"#187fb1"},{"id":"symbian","name":"Symbian Belle","description":"Ícones e roxo clássico","dark":0,"bg":"#ede6f6","surface":"#fffbff","line":"#cbb3df","brand":"#5a348e","brandInk":"#ffffff","accent":"#8554bc"},{"id":"lcd","name":"Retro LCD","description":"Verde fosco e pixel","dark":0,"bg":"#d6e0b0","surface":"#f0f3cf","line":"#93a278","brand":"#405c33","brandInk":"#ffffff","accent":"#537c35"},{"id":"y2k","name":"Y2K Chrome","description":"Prata, lavanda e brilho","dark":0,"bg":"#e8ddf4","surface":"#fcfaff","line":"#c5b5dc","brand":"#744baf","brandInk":"#ffffff","accent":"#9a55b0"},{"id":"macclassic","name":"Macintosh Classic","description":"Areia, monocromia e relevo","dark":0,"bg":"#dcdad1","surface":"#fcfaf3","line":"#a4a49b","brand":"#383a40","brandInk":"#ffffff","accent":"#5b685d"},{"id":"neon","name":"Neon Arcade","description":"Ciano e roxo noturnos","dark":1,"bg":"#0d0920","surface":"#1b1233","line":"#49346b","brand":"#7635b2","brandInk":"#ffffff","accent":"#3ed4af"}];
  const THEMES_BY_ID=Object.fromEntries(THEMES.map(t=>[t.id,t]));
  const picker=document.querySelector('#visualThemePicker');
  const modalGrid=document.querySelector('#visualThemePickerGrid');
  const dataGrid=document.querySelector('#visualThemeGrid');
  const desktopSelect=document.querySelector('#desktopThemeSelect');
  const quickBtn=document.querySelector('#themeQuickBtn');
  const mobileBtn=document.querySelector('#mobileThemePickerBtn');
  const modalSheet=picker?.querySelector('.visual-theme-sheet');
  const closeBtn=document.querySelector('#visualThemeClose');
  const backdrop=document.querySelector('#visualThemeBackdrop');
  const status=document.querySelector('#visualThemeStatus');
  let saved=null;
  let returnFocus=null;
  try{
    const value=localStorage.getItem(KEY);
    saved=THEMES_BY_ID[value]?value:null;
  }catch{}

  function legacyTheme(){
    if(document.body.dataset.layoutEffective==='desktop'){
      const desktop=document.body.dataset.desktopTheme;
      if(desktop==='graphite'||desktop==='midnight')return desktop;
    }
    return (typeof state!=='undefined' && state?.settings?.theme==='dark')?'dark':'light';
  }
  function activeTheme(){return saved||legacyTheme();}
  function refreshCards(){
    document.querySelectorAll('.visual-theme-choice').forEach(button=>{
      const selected=button.dataset.palette===activeTheme();
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  function applyVisualTheme(){
    const id=activeTheme();
    const theme=THEMES_BY_ID[id]||THEMES_BY_ID.light;
    document.body.dataset.visualTheme=theme.id;
    document.body.dataset.theme=theme.dark?'dark':'light';
    document.documentElement.style.colorScheme=theme.dark?'dark':'light';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',theme.bg);
    if(desktopSelect && desktopSelect.value!==id)desktopSelect.value=id;
    if(status)status.textContent='Tema selecionado: '+theme.name+'. Preferência salva neste navegador.';
    refreshCards();
  }
  function chooseTheme(id){
    if(!THEMES_BY_ID[id])return;
    saved=id;
    try{localStorage.setItem(KEY,id)}catch{
      if(status)status.textContent='Tema aplicado, mas este navegador não permitiu salvar a preferência.';
    }
    applyVisualTheme();
    // A aplicação financeira e o snapshot continuam intactos.
  }
  function buildCard(t){
    const button=document.createElement('button');
    button.type='button';
    button.className='visual-theme-choice';
    button.dataset.palette=t.id;
    button.setAttribute('aria-label','Aplicar tema '+t.name);
    button.setAttribute('aria-pressed','false');
    button.style.cssText=`--preview-bg:${t.bg};--preview-surface:${t.surface};--preview-brand:${t.brand};--preview-ink:${t.brandInk};--preview-accent:${t.accent};--preview-line:${t.line};`;
    const preview=document.createElement('div');preview.className='visual-theme-preview';preview.setAttribute('aria-hidden','true');
    preview.innerHTML='<div class="visual-theme-preview-aside"><i></i><i></i><i></i></div><div class="visual-theme-preview-main"><div class="visual-theme-preview-bar"></div><div class="visual-theme-preview-cards"><i></i><i></i></div><div class="visual-theme-preview-foot"></div></div>';
    const name=document.createElement('span');name.className='visual-theme-name';
    name.textContent=t.name;
    const mark=document.createElement('span');mark.className='visual-theme-check';mark.textContent='✓';mark.setAttribute('aria-hidden','true');name.appendChild(mark);
    const meta=document.createElement('span');meta.className='visual-theme-meta';meta.textContent=t.description;
    button.append(preview,name,meta);
    button.addEventListener('click',()=>chooseTheme(t.id));
    return button;
  }
  function renderChoices(container){
    if(!container)return;
    const fragment=document.createDocumentFragment();
    THEMES.forEach(t=>fragment.appendChild(buildCard(t)));
    container.replaceChildren(fragment);
  }
  function setupDesktopSelect(){
    if(!desktopSelect)return;
    desktopSelect.replaceChildren(...THEMES.map(t=>{
      const option=document.createElement('option');option.value=t.id;option.textContent=t.name;return option;
    }));
    desktopSelect.setAttribute('aria-label','Escolher tema visual');
  }
  function openPicker(){
    if(!picker)return;
    // O menu "Mais" é fechado sem navegar para outro destino.
    if(document.body.classList.contains('mobile-menu-open')){
      document.querySelector('#mobileMenuClose')?.click();
    }
    returnFocus=document.activeElement;
    picker.hidden=false;
    document.body.classList.add('visual-theme-open');
    refreshCards();
    modalSheet?.focus();
  }
  function closePicker(){
    if(!picker||picker.hidden)return;
    picker.hidden=true;
    document.body.classList.remove('visual-theme-open');
    if(returnFocus?.isConnected)returnFocus.focus();
    returnFocus=null;
  }
  function focusables(){
    return Array.from(picker?.querySelectorAll('button:not([disabled])')||[])
      .filter(el=>el.getClientRects().length>0);
  }
  document.addEventListener('keydown',event=>{
    if(!picker||picker.hidden)return;
    if(event.key==='Escape'){event.preventDefault();closePicker();return;}
    if(event.key!=='Tab')return;
    const items=focusables();if(!items.length)return;
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  quickBtn?.addEventListener('click',openPicker);
  if(quickBtn){quickBtn.onclick=null;quickBtn.textContent='🎨';quickBtn.title='Escolher tema visual';quickBtn.setAttribute('aria-label','Escolher tema visual');}
  mobileBtn?.addEventListener('click',openPicker);
  closeBtn?.addEventListener('click',closePicker);
  backdrop?.addEventListener('click',closePicker);
  window.saldoPlanApplyVisualTheme=applyVisualTheme;
  window.saldoPlanSetVisualTheme=chooseTheme;
  window.saldoPlanUpdateThemeSelect=()=>{if(desktopSelect)desktopSelect.value=activeTheme();};
  window.saldoPlanOpenThemePicker=openPicker;
  setupDesktopSelect();
  renderChoices(modalGrid);
  renderChoices(dataGrid);
  applyVisualTheme();
})();
