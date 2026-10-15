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
