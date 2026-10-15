/* SaldoPlan v4.0.0 — abas acessíveis da tela Dados e backup.
   Não altera armazenamento, cálculos, autenticação ou eventos de formulários. */
(function () {
  'use strict';
  function activate(button, moveFocus) {
    const nav = button.closest('#sp4SettingsTabs');
    if (!nav) return;
    const root = nav.closest('#view-data');
    if (!root) return;
    const buttons = Array.from(nav.querySelectorAll('[role="tab"]'));
    const targetId = button.getAttribute('aria-controls');
    const target = root.querySelector('#' + targetId);
    if (!target) return;
    for (const item of buttons) {
      const selected = item === button;
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      item.tabIndex = selected ? 0 : -1;
      const pane = root.querySelector('#' + item.getAttribute('aria-controls'));
      if (pane) pane.hidden = !selected;
    }
    if (moveFocus) button.focus({preventScroll:true});
    // A aba pode ser trocada após rolar até o fim de um painel longo.
    if (window.scrollY > 0 && nav.getBoundingClientRect().top < 0) {
      nav.scrollIntoView({block:'start',behavior:'auto'});
    }
  }
  document.addEventListener('click', function (ev) {
    const tab = ev.target.closest('#view-data #sp4SettingsTabs [role="tab"]');
    if (tab) activate(tab, false);
  });
  document.addEventListener('keydown', function (ev) {
    const tab = ev.target.closest('#view-data #sp4SettingsTabs [role="tab"]');
    if (!tab) return;
    const tabs = Array.from(tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]'));
    const index = tabs.indexOf(tab);
    let next = index;
    if (ev.key === 'ArrowRight') next = (index+1)%tabs.length;
    else if (ev.key === 'ArrowLeft') next = (index-1+tabs.length)%tabs.length;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = tabs.length-1;
    else return;
    ev.preventDefault();
    activate(tabs[next],true);
  });
})();


/* Navegação secundária da aba Backups. Apenas mostra/oculta grupos HTML;
   não altera nenhum dado ou ação dos formulários existentes. */
(function(){
  'use strict';
  function switchBackupMode(tab,moveFocus){
    const nav=tab.closest('#sp4BackupModes');
    const root=nav && nav.closest('#sp4PaneBackup');
    if(!root)return;
    const tabs=Array.from(nav.querySelectorAll('[role="tab"]'));
    const selected=tab.getAttribute('aria-controls');
    if(!root.querySelector('#'+selected))return;
    for(const item of tabs){
      const isActive=item===tab;
      item.setAttribute('aria-selected',isActive?'true':'false');
      item.tabIndex=isActive?0:-1;
      const panel=root.querySelector('#'+item.getAttribute('aria-controls'));
      if(panel)panel.hidden=!isActive;
    }
    if(moveFocus)tab.focus({preventScroll:true});
  }
  document.addEventListener('click',function(ev){
    const tab=ev.target.closest('#sp4BackupModes [role="tab"]');
    if(tab)switchBackupMode(tab,false);
  });
  document.addEventListener('keydown',function(ev){
    const tab=ev.target.closest('#sp4BackupModes [role="tab"]');
    if(!tab)return;
    const tabs=Array.from(tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]'));
    const idx=tabs.indexOf(tab);
    let next=idx;
    if(ev.key==='ArrowRight')next=(idx+1)%tabs.length;
    else if(ev.key==='ArrowLeft')next=(idx-1+tabs.length)%tabs.length;
    else if(ev.key==='Home')next=0;
    else if(ev.key==='End')next=tabs.length-1;
    else return;
    ev.preventDefault();switchBackupMode(tabs[next],true);
  });
})();
