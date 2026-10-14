# SaldoPlan — Arquitetura modular v2.14.0

Esta versão inicia a modularização estrutural do projeto sem trocar framework e sem alterar o formato dos dados.

## Estrutura

- `index.html`: shell do aplicativo (login, sidebar, topo, navegação e hosts de conteúdo).
- `views/`: uma parcial HTML por tela.
- `views/dialogs.html`: diálogos globais carregados antes da lógica do app.
- `styles.css`: manifesto pequeno que importa os arquivos CSS separados.
- `css/`: estilos divididos por domínio visual.
- `app.js`: bootstrap pequeno; carrega views e scripts na ordem correta.
- `js/`: lógica antiga dividida por domínio, ainda como scripts clássicos para preservar o escopo global atual.
- `api/`: continua inalterada.

## Ordem de carregamento

1. `index.html`
2. `drive-config.js`
3. `app.js`
4. `app.js` carrega todas as views e dialogs
5. scripts em `js/` são carregados sequencialmente
6. `auth.js` é carregado por último como módulo

Essa estratégia permite reduzir os arquivos gigantes sem reescrever toda a aplicação de uma vez.

## Próxima fase

Na fase seguinte os arquivos em `js/` podem ser convertidos gradualmente para módulos ES (`import`/`export`) com `init()` por tela, e os estilos ainda compartilhados podem ser movidos de `css/base.css` para CSS específico de cada view.

## Compatibilidade

- localStorage preservado;
- backups preservados;
- Google Login e Drive preservados;
- PWA preservada;
- APIs preservadas;
- mobile e desktop preservados;
- nenhum dado financeiro é migrado ou apagado por esta etapa.
