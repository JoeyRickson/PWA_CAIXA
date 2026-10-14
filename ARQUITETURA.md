# SaldoPlan — Arquitetura modular v2.17.0

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

## Recorrência v2.16

- `js/recurrence.js`: concentra migração, limites por data completa, geração mensal e compatibilidade com os campos antigos `startMonth`/`endMonth`.
- Intervalos novos usam `startDate`/`endDate` em ISO (`YYYY-MM-DD`).
- Séries antigas são migradas em memória e persistidas sem criar histórico/backup desnecessário.

## Cartões v2.17

A área de cartões foi adicionada sem misturar sua lógica com Lançamentos:

- `views/cards.html`: tela de cartões, faturas e compras parceladas;
- `js/cards.js`: cartões, limites, fechamento, vencimento, faturas e geração das parcelas;
- `css/cards.css`: layout da área de crédito;
- `state.creditCards`: cadastro dos cartões;
- `state.cardPurchases`: compras e parcelamentos.

Cada parcela é materializada também em `state.transactions`, com metadados `cardId`, `cardPurchaseId`, `cardInstallmentIndex`, `cardInstallmentCount` e `cardStatementMonth`. Assim as faturas entram naturalmente nas projeções, ciclos de caixa, exportações e rollback sem criar um segundo sistema financeiro paralelo.
