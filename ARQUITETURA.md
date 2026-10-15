# SaldoPlan — Arquitetura modular v2.20.0

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


## Patrimônio e metas v2.18

- `views/patrimony.html`: visão consolidada de patrimônio, dívidas, metas e projeções;
- `js/patrimony.js`: consolida caixa, Guardado, Carteira, FGTS, cartões e dívidas manuais;
- `css/patrimony.css`: layout específico da área;
- `state.patrimonySettings`: origem do saldo em conta (automático ou manual);
- `state.liabilities`: dívidas manuais;
- `state.financialGoals`: metas financeiras;
- `state.netWorthSnapshots`: histórico diário do patrimônio líquido.

A projeção de 30/60/90 dias considera lançamentos futuros, recorrências mensais e movimentações previstas de Guardado. Pagamentos de parcelas reduzem caixa e dívida do cartão simultaneamente, evitando dupla redução do patrimônio.


## Importação e inteligência v2.19

- `views/importer.html`: seleção de PDF/OFX/QFX/CSV, mapeamento de colunas, prévia e auditoria;
- `js/importer.js`: parser de PDF/OFX/CSV, detecção de duplicados, revisão e criação de lançamentos;
- `css/importer.css`: layout responsivo da área de importação;
- `state.importSettings`: preferências de aprendizado e origem da última importação;
- `state.importRules`: regras locais de categorização por texto;
- `state.importHistory`: resumo das últimas importações.

A importação é totalmente local no navegador. Nenhum arquivo de extrato é enviado para uma API do SaldoPlan. Os itens são revisados antes de entrar em `state.transactions`, e duplicados ficam desmarcados por padrão.


## Calendário, alertas e fechamento v2.20

- `views/calendar.html`: agenda mensal, central de alertas e fechamento do mês;
- `js/calendar.js`: consolida lançamentos, Guardado, cartões, metas, dívidas e vencimentos em uma agenda única;
- `css/calendar.css`: calendário desktop, agenda mobile e painéis de fechamento;
- `state.monthlyClosings`: snapshots manuais dos fechamentos mensais, com até 60 registros.

Os alertas são calculados localmente a partir do estado atual. O fechamento mensal não bloqueia o mês: ele salva uma fotografia dos valores realizados e pode ser atualizado ou excluído com rollback normal.

---

## Financial Intelligence — v3.0.0 (candidata à homologação)

A v3 é uma atualização **incremental** construída sobre a base v2.21.x. A estrutura HTML/CSS/JS puro, os scripts clássicos carregados sequencialmente e a chave de armazenamento `meuCaixa.v1` continuam inalterados. `state.version` permanece `2` para evitar romper leitores legados.

### Arquivos acrescentados

| Arquivo | Responsabilidade |
| --- | --- |
| `views/intelligence.html` | Tela única de Orçamento, Insights, Pesquisa e Relatório anual |
| `js/intelligence.js` | Cálculos locais e renderização das quatro áreas |
| `css/intelligence.css` | Layout adaptável e compatível com a paleta de temas |
| `js/sp3-tools.js` | Notificações durante o uso e verificações locais de JSON e SHA-256 |
| `js/sp3-sync.js` | Cópia cifrada opcional no Firestore, confirmação e tratamento de conflitos |
| `js/sp3-tickets.js` | Histórico local dos protocolos emitidos no suporte |
| `FIRESTORE-SETUP.md` | Regras de segurança e procedimentos para ativar a cópia remota |
| `CHANGELOG.md` | Histórico de versões e limitações explícitas |

### Mudanças em arquivos existentes

- `app.js`: `SALDOPLAN_VERSION='3.0.0'`; adição de uma partial e quatro scripts ao carregamento sequencial.
- `js/core.js`: `seed.budgets=[]` e migração defensiva de `raw.budgets`. Outras coleções e backups antigos permanecem intactos; `save()` aciona opcionalmente agendamento de sincronização enquanto desbloqueada.
- `js/ui.js`: `renderAll()` chama renderizador adicional e o roteador reconhece a tela `intelligence`.
- `index.html`, `styles.css`, `sw.js`: navegação e cache de novos arquivos com bump de versão. `/api/*` continua sem cache estático.
- `views/data.html`: painéis adicionais de notificação, conferência de backup e sincronização beta.
- `api/support.js` e `js/support.js`: protocolo gerado pelo servidor somente após autenticação, incluído no e-mail e na resposta HTTP; nenhuma credencial do Resend exposta ao frontend.
- `views/support.html`: histórico local dos protocolos, com status "Enviado" (não status remoto da equipe).

### Contratos financeiros preservados

- Orçamento: `{id, month, category, limit}` em `state.budgets`; `month` ISO `YYYY-MM`. Comparações usam somente `kind='expense'` e `status='realized'` daquela categoria, **sem reclassificar** outros registros.
- Relatório: somas dos lançamentos `realized` por competência da data. Não modifica faturas, recorrências ou históricos.
- Pesquisa: só leitura de coleções existentes; resultados limitados na interface a 80 itens.
- Insights: estatística determinística, sem uploads, anúncios ou API de IA.
- Backup existente: `js/backup.js` e `js/drive.js` seguem inalterados. Nova restauração Firestore faz snapshot local e guarda o estado anterior antes de usar `migrateState()`/`save()`.

### Sincronização e segurança

A comunicação Firestore exige `getIdToken()` de conta Firebase conectada; o backend Firestore precisa de regras com `request.auth.uid == userId`. O documento remoto armazena somente `{data,salt,iv,hash}`, contendo um estado serializado cifrado com AES-GCM. Chave gerada via PBKDF2 com salt aleatório; senha **apenas em memória**. O documento Firestore tem limite de tamanho. Como o armazenamento local não executa transações multi-dispositivo, o modo automático pausa ao notar alteração remota; não há merge automático de concorrência.

### Operação e testes

1. `git status --short`, `git log -1 --oneline`; compare hashes do patch antes de aplicar.
2. Execute o instalador com `-ProjectPath '.'`, que fará backup e abortará em conflito.
3. `node --check app.js`, `node --check sw.js` e valide `js/*.js` / `api/*.js`.
4. `npx.cmd vercel dev` e verifique desktop (80–150% de zoom) e mobile (320/360/390px), navegação, tema, lançamento, recorrência, cartões, rollback e backup antigo.
5. Teste cada uma das quatro áreas de Inteligência com valores reais e previstos, inclusive mês sem dados.
6. Para Firestore: ambiente de teste com duas contas/aparelhos, confirmação de conflitos, restauração cancelada, senha errada e rede indisponível. **Não use dados reais no primeiro teste.**
7. Confirme Resend/Firebase na produção antes de marcar o suporte como homologado.
8. Publique a versão somente após homologação completa. Nenhum instalador automatiza `git commit` ou `git push`.

## Sincronização protegida v3.1.0

A implementação em `js/sp3-sync.js` mantém o modelo `saldoplanSync/{uid}` do Firestore e o formato cifrado v3.0 (`data`, `salt`, `iv`, `hash`), sem migração de dados remotos e sem alterar a chave local `meuCaixa.v1`. A autorização continua sendo Firebase Authentication com regras por UID.

**Memória de chave opt-in:** a pessoa insere a senha de 12+ caracteres pelo menos uma vez em cada navegador. Ao escolher **Lembrar desbloqueio neste aparelho**, o app gera uma chave AES-GCM 256 **não exportável** via `SubtleCrypto.generateKey`, cifra a senha com IV aleatório e vinculação criptográfica ao UID/projeto (AAD), e guarda o registro no IndexedDB `SaldoPlanSyncDeviceV31`, coleção `deviceKeys`. O login confirmado para o mesmo UID permite recuperar a senha cifrada após atualização da página; logout apaga apenas a sessão em memória. A ação **Esquecer** remove o registro e desativa o automático. Não são salvos segredos em texto puro no Firestore ou no `localStorage`.

**Modelo de segurança:** armazenamento local não substitui biometria, TPM nem proteção contra XSS; scripts com acesso à mesma origem podem utilizar chaves do IndexedDB. Destina-se exclusivamente a dispositivos pessoais. A mesma conta em outro aparelho precisa da senha original uma vez. O app não consegue recuperar senha perdida.

**Conflitos:** uploads automáticos só ocorrem com guia aberta, conta correta, credencial desbloqueada e revisão remota reconhecida. Na primeira sessão automática, o hash local é comparado ao remoto; uma divergência pausa o envio. Em PATCH, a pré-condição `currentDocument.updateTime` (ou `exists=false`) impede corridas concorrentes. A restauração requer confirmação, grava snapshot e não mescla alterações de aparelhos distintos. Antes de sobrescrever um documento existente, o app valida a senha descriptografando a cópia remota. O Google Drive segue como backup independente.
