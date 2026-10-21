## v5.1.4 — Apresentação da sincronização

`views/data.html`, `css/v51-live.css` e textos de `js/v51-live-sync.js` foram atualizados sem mudar a lógica de sincronização. Os elementos e IDs de `sp51Live*`, `sp3Sync*` e `sp31*` permanecem para não romper os handlers do Live Sync e do backup criptografado anterior. O painel `sp3SyncPanel` foi colocado sob um `<details>` inicialmente fechado (a lógica continua montada no DOM). A PWA recebe novo cache e strings `5.1.4` para atualização. O status público evita detalhes do Firestore; erros técnicos continuam disponíveis no console.

## v5.1.3 — Guarda semantica do primeiro login

`js/v51-live-engine.js` passou a validar `isGeneratedFreshProfile()` contra `blankProfileTemplate()`; so aceita estruturas exatas de renderizacao automatica para `payrollMonths`, `thirteenthByYear`, `fgtsByYear` e um unico `netWorthSnapshots` zerado do dia atual. Qualquer outra divergencia requer conciliacao, preservando os dados locais. `js/v51-live-sync.js` consulta essa funcao apenas na ativacao inicial e reafirma a condicao antes de baixar os dados. Nao altera a sincronizacao apos vinculo.

## v5.1.2 — Vinculação inicial segura

O motor Live Sync usa uma leitura confirmada pelo servidor (não snapshot em cache) para permitir auto-link em dois casos: perfil novo sem dados próprios ou perfil cujo mapa achatado de registros locais é subconjunto idêntico do mapa remoto ativo. Falha fechada em caso de tombstone, valor divergente, registro local exclusivo, fase `initializing` ou fila pendente. Não vincula automaticamente contas com dados discrepantes, mesmo se o UID corresponder.

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

## Backup simplificado e acessibilidade v3.1.1

A tela `views/data.html` diferencia o **salvamento automático local** (não é backup externo), o **backup manual (.json)**, o **backup em arquivos na nuvem** (Google Drive ou serviço configurado) e o **backup entre aparelhos** (cópia cifrada no Firestore). As operações continuam independentes.

- A interface utiliza nomes acessíveis, descrições curtas e ajuda técnica recolhida em `<details>`, com controles de senha identificados e avisos `aria-live`. IDs de elementos, fluxos e chaves de armazenamento não mudaram.
- O mínimo da senha de proteção passa de 12 para **8 caracteres** tanto no atributo HTML quanto na validação de `js/sp3-sync.js`, inclusive na recuperação de segredo local lembrado. Senhas já existentes de 12+ caracteres permanecem válidas; os documentos remotos AES-GCM/PBKDF2 continuam compatíveis e não são migrados ou descriptografados automaticamente.
- O mínimo de 8 reduz a resistência a adivinhação offline caso o documento criptografado seja obtido; o usuário recebe orientação para escolher uma frase maior. A criptografia não substitui um backup JSON/Drive e continua opcional.
- O PWA atualiza seu cache para `v3.1.1`, evitando exibir formulários obsoletos.
- A cópia remota continua sendo um snapshot completo por conta: **sem mesclagem de alterações concorrentes**, com verificação e confirmação antes da substituição. A opção Lembrar segue voluntária, somente para dispositivos pessoais, com chave não exportável no IndexedDB.

## v3.1.2 — Backup e acesso simplificados

- A seção de backup em serviços externos passa a chamar-se **Backup na nuvem** e mantém as opções Google Drive, OneDrive e Dropbox. A restauração integrada permanece disponível apenas para Google Drive; nos outros dois provedores, a recuperação usa o JSON exportado.
- O histórico local de restauração continua armazenado em `meuCaixa.undoHistory.v3` com o limite existente. A interface mostra as três versões mais recentes, agrupadas por dia, e permite expandir todas. A configuração e limpeza do histórico ficam recolhidas.
- O login mantém `browserLocalPersistence` no Firebase Auth. Após um login bem-sucedido, o aplicativo guarda **apenas nome e e-mail** da última conta no `localStorage` (`saldoplan.lastGoogleAccount.v1`) para exibir um atalho naquele navegador. Não armazena senha, token ou lista de contas Android. O usuário pode remover o atalho, e o login sempre passa pelos fluxos oficiais do Google (popup/redirecionamento).
- O botão **Escolher outra conta Google** utiliza `prompt: select_account`; o atalho da última conta utiliza `login_hint` e pode continuar exigindo autenticação por decisão do provedor.
- Não há alteração nos formatos financeiros, na criptografia Firestore, nas rotinas de backup nem nas regras do banco de dados.

## v3.1.3 — Entrada Google mais estável no Android

- No domínio oficial HTTPS, Android usa **signInWithRedirect** diretamente. O Firebase continua restaurando sessão com `browserLocalPersistence` e `getRedirectResult`, sem reiniciar autenticações por conta própria.
- Desktop mantém **signInWithPopup**; falha por popup bloqueado pode recorrer ao redirecionamento no domínio configurado.
- O atalho de última conta aproveita `auth.currentUser` quando for a mesma conta, mas **um e-mail lembrado não equivale a uma sessão autenticada**. Não há armazenamento local de senhas ou tokens Google adicional.
- O Service Worker não intercepta ` /__/auth/ ` nem ` /__/firebase/ `; o projeto Vercel já possui proxy de autenticação sob o domínio principal.
- Sem alterações na chave financeira `meuCaixa.v1`, histórico, Firestore, Drive, APIs ou criptografia.

## v3.1.4 — Google Login no Android via Google Identity Services

- Cliente OAuth Web usado pelo **Firebase Authentication**: `292722512495-nlagmuoao494du6ve34jlevje0v5cor0.apps.googleusercontent.com`. O projeto Drive `PWACAIXA` e seu cliente `699291733242-...` permanecem inalterados.
- Android: botão oficial Google Identity Services; credencial retornada pelo Google é convertida usando `GoogleAuthProvider.credential(idToken)` e enviada ao Firebase via `signInWithCredential`. Não utiliza mais `signInWithRedirect` e não depende de `sessionStorage` entre domínios para autenticar.
- A seleção depende das contas disponíveis para o navegador Google, não de uma leitura direta das contas do Android. O Google pode solicitar MFA ou validação quando necessário.
- Desktop: mantém `signInWithPopup`. Sessões válidas continuam armazenadas pelo Firebase via `browserLocalPersistence`; nenhum token Google é persistido manualmente.
- Na indisponibilidade da API do Google, a interface instrui o usuário a abrir no Chrome, sem repetir o redirecionamento que causou `missing initial state`.
- Dados financeiros locais continuam compartilhados por navegador (`meuCaixa.v1`) independentemente de qual conta Google esteja autenticada. Não há isolamento de perfis locais nesta versão.
- Backups, Google Drive, Firestore, sincronização criptografada e formatos de dados não são alterados.

## v3.1.5 — Entrada Android sem atalho redundante

- A apresentação de **Última conta usada** permanece exclusiva do desktop. No Android, o elemento `#authLastAccount` mantém a classe `hidden` mesmo se existir e-mail salvo em `saldoplan.lastGoogleAccount.v1`.
- Essa decisão preserva o fluxo funcional de autenticação por Google Identity Services no Android, sem depender de dados de e-mail lembrados ou abrir novamente redirecionamentos Firebase.
- O desktop continua a oferecer o atalho existente. Os dados locais não passam a ser segregados por login Google; essa limitação não foi alterada.
- Versão/cache `3.1.5` com nova URL de `auth.js`. Nenhuma modificação de `meuCaixa.v1`, Drive, Firestore ou regras de autenticação.

## v3.1.6 — Apresentação do botão oficial de login Google

- Para Android, `auth.js` usa `google.accounts.id.renderButton` com `shape: "pill"` e `theme: "filled_black"` ou `"outline"` conforme `body.dataset.theme`. Não envolve alterações nas credenciais ou no método de entrada por `signInWithCredential`.
- Um `MutationObserver` observa apenas a mudança de atributo `body[data-theme]` e solicita a renderização oficial com as cores apropriadas; não altera o iframe do Google e não opera sobre dados financeiros.
- `.sp316-themed-google` em `css/auth.css` ajusta apenas espaço, bordas, fundo e largura do contêiner do botão oficial. O provedor mantém sua própria marca.
- Se o usuário já estiver conectado, o botão oficial é ocultado em **Dados e backup**; reaparece quando não houver sessão Firebase.
- Nenhuma mudança em chaves `localStorage`, dados, Firebase Auth, Google Drive, Firestore ou formatos de backup. `CACHE` e versão `3.1.6`.

## v4.0.0 — Perfis locais, produtividade e push opcional

A v4 mantém os scripts clássicos, UI HTML/CSS, o formato `state.version=2` e os dados originais preservados. Não apaga `meuCaixa.v1` ao habilitar perfis.

### Separação de dados

- Sem associação: chave original `meuCaixa.v1` (`legacy`).
- Conta autenticada: `meuCaixa.profile.user_<uid>.v4` (somente depois da cópia/novo perfil expressamente escolhido na primeira associação).
- Offline após criar perfil: `meuCaixa.guest.v4`, separado das contas autenticadas.
- Seleção ativa persistida em `saldoplan.profile.active.v4`. A mudança de conta dispara recarga antes de operar com os dados do outro perfil.
- `PREVIOUS_KEY`, histórico de undo e preferências automáticas de backup passam a usar sufixo do perfil. Outras preferências visuais e caches gerais podem continuar compartilhadas no navegador.
- `auth.js` consulta `window.saldoPlanV4ProfileAuth(user)` antes de renderizar a sessão. A UI é ocultada temporariamente durante a verificação se o navegador estava em perfil Google.
- **Limites:** localStorage não é cofre criptografado e não substitui perfis isolados do sistema operacional; segurança depende do navegador/dispositivo. UID autenticado delimita a seleção lógica, mas um usuário com acesso físico ao perfil do navegador pode inspecionar armazenamento local. A migração não remove a base antiga nem mescla contas.

### Módulos novos

- `js/v4-features.js`: gerenciamento de seleção de perfil, FAB mobile e diagnóstico local.
- `css/v4.css`: estilos adaptáveis dos novos recursos.
- `js/v4-push.js` e `push-config.js`: ativação do push com Firebase Messaging, sem credenciais privadas no navegador.
- `api/_push-common.js`, `api/push-subscription.js` e `api/push-daily.js`: validação de ID token, dispositivos por UID, agendamento autenticado e envio genérico de lembrete.
- `PUSH-SETUP.md`: ativação opcional, limites e manutenção.

O backend push não é ativo até configurar `FIREBASE_SERVICE_ACCOUNT_JSON`, `CRON_SECRET` e a VAPID pública. São guardadas apenas datas futuras de compromissos e tokens FCM, sem descrições ou valores. A tarefa Vercel é diária e limitada a 250 dispositivos por execução.

### Importação e backup

- Os fingerprints exatos continuam prioritários. Um segundo detector sugere revisar transações por `kind`, valor, estabelecimento normalizado e data adjacente, sem apagá-las nem selecioná-las automaticamente.
- A cópia cifrada do Firestore permanece em `saldoplanSync/{uid}`, usa o mesmo formato de quatro campos, e continua protegida por condições de atualização e confirmação de restauração. Não há merge bidirecional de lançamentos.
- Recomenda-se backup JSON antes de ativar um perfil novo; o app **não** converte automaticamente dados da conta anterior.

As mensagens de conflito mostram a última data local e o `updateTime` remoto. Essas datas são apenas pistas e não comprovam uma mesclagem ou completude do histórico.


### v4.0.0 — organização visual de Dados e backup (layout2)

A view `views/data.html` usa grupos de apresentação sem estado (`sp4-preferences-layout`, `sp4-storage-layout`, `sp4-security-layout`), com colunas independentes definidas em `css/v4.css`. As seções internas mantêm os respectivos IDs, controles e listeners. No desktop largo, galeria de temas fica junto de Meta/Bônus; nuvem fica junto de backups locais; diagnóstico e notificações usam duas colunas de altura natural. Em telas estreitas, os grupos são empilhados. Nenhuma migração de dados nem alteração de autenticação ocorre nesse layout.

### Navegação de Dados e backup (v4.0.0 — ajuste visual)
A página foi dividida em quatro abas acessíveis: Backups, Aparência, Segurança e Minha conta. A grade antiga de 12 colunas não é aplicada a essa tela. `views/data.html` preserva os identificadores dos formulários; `js/v4-settings-tabs.js` controla apenas a exibição das abas e suas teclas de navegação, sem modificar dados. `css/v4.css` usa as variáveis dos temas existentes.


## v4.0.0 — Finanças separadas da aparência (ajuste de usabilidade)

- A tela `views/data.html` usa cinco abas acessíveis: Backups, Aparência, Finanças, Segurança e Minha conta.
- **Aparência** mantém apenas a seleção de temas; **Finanças** agrupa `savingGoal`, `saveGoalBtn`, `bonusEnabled`, `bonusName` e `saveBonusConfig`.
- Os IDs originais, eventos de formulário, objetos de estado e formatos de backup foram preservados; os campos foram realocados somente no HTML.
- `css/v4.css` organiza as duas preferências financeiras em duas colunas no desktop e uma no mobile. A navegação apresenta as cinco abas visíveis em até duas linhas no celular.
- `js/v4-settings-tabs.js` já descobre abas por seus atributos ARIA, sem alterações de lógica. O Service Worker incrementa o nome do cache para atualizar a interface.


## v4.0.0 — Acessibilidade de temas nos módulos v4

- `css/v4.css` reutiliza exclusivamente os tokens de tema existentes (`--surface`, `--surface-2`, `--ink`, `--muted`, `--line`, `--brand`, `--brand-ink`, `--accent`), definidos em `css/themes.css` para os 14 temas.
- Corrigidos `#sp4Diagnostics`, `.sp4-profile-note`, `.sp4-fast-menu`, `.sp4-shortcut` e `.sp4-tag`, eliminando fallbacks fixos escuros de tokens inexistentes (`--panel`, `--text`, `--border`).
- Os botões de diagnóstico secundários e de contorno preservam contraste entre fundo e rótulo, inclusive nos temas claros, e componentes interativos exibem foco visível.
- A atualização não modifica estado, IDs, dados financeiros, Firestore, login, servidor ou lógica de backup. Novas revisões exigem cache renovado do Service Worker para o CSS.


## v4.0.0 — Backups agrupados na mesma aba (ajuste de homologação)

- A aba **Backups**, em `views/data.html`, reúne agora: backup na nuvem, salvamento local, arquivo JSON/manual, histórico, **Backup entre aparelhos** (`#sp3SyncPanel`) e **Verificar dados e backups** (`#sp3IntegrityPanel`).
- Os dois últimos painéis antes estavam em **Segurança**. Foram movidos como elementos HTML existentes; nenhum `id`, formulário, tipo de input, ação de botão ou comportamento do JavaScript foi alterado.
- A aba **Segurança** concentra diagnóstico local, notificações (com app aberto ou fechado, conforme configuração) e limpeza dos dados do dispositivo.
- `css/v4.css` define `.sp4-backup-tools-grid` com dois cartões em desktop e um em telas menores, com altura natural e usando apenas variáveis dos 14 temas.
- `styles.css`, `index.html` e `sw.js` renovam a versão do CSS/cache sem apagar dados ou alterar os formatos de backup, Firestore ou Google Drive.
- A sincronização criptografada segue baseada em cópias completas; conflitos permanecem sujeitos à escolha explícita do usuário.


## v4.0.0 — Fluxo guiado de backups (refinamento de usabilidade)

- A aba Backups passa a ter **três modos** mutuamente exclusivos: **Na nuvem**, **Arquivo e versões**, **Entre aparelhos**. A interface começa no modo Nuvem, com os demais formulários ocultos visualmente até a escolha do usuário.
- A navegação aninhada é tratada pelo `js/v4-settings-tabs.js` usando delegação de eventos, `role=tab`, `aria-controls`, `aria-selected`, seta esquerda/direita e Home/End, sem modificar as funções dos botões existentes.
- **Na nuvem** mantém `cloud-panel` e todos os provedores. **Arquivo e versões** reúne `saveLocalData`, exportações, restauração de JSON, desfazer, histórico (`undoHistory`) e verificação (`sp3IntegrityPanel`). **Entre aparelhos** mantém a cópia criptografada (`sp3SyncPanel`) com a senha lembrada por conta.
- A aba Segurança permanece apenas para diagnósticos, alertas e limpeza; a troca de modos **não altera** `meuCaixa.v1`, dados financeiros, Firestore, senhas, credenciais, mecanismos de backup ou política de conflitos.
- `css/v4.css`, `styles.css`, `index.html` e `sw.js` versionados para evitar visualização de CSS antigo no PWA. Layout usa `--surface`, `--surface-2`, `--ink`, `--line`, `--muted` e `--accent` dos temas oficiais.


## v5.0.0 — Extensões incrementais

- `js/v5-engine.js`: funções puras de consolidação de lançamentos realizados e respostas locais simples; **nenhum endpoint externo**.
- `js/v5-features.js`: progresso manual de metas com `goal.contributions`, impressão mensal, assistente e preferências push por perfil. Não cria transações financeiras de modo implícito.
- `api/_support-store.js` e `api/support-admin.js`: armazenamento opcional da solicitação após entrega do e-mail; acesso administrativo exclusivamente por token Firebase verificado e UID `SUPPORT_ADMIN_UID`.
- `js/v5-admin.js`: exibição condicional da central; a checagem de interface não substitui a autorização do backend.
- `api/push-daily.js`: lembrete diário genérico no dia ou com a antecedência escolhida; limitações de 250 inscrições por rotina, sem dados de lançamentos.
- Contratos legados `meuCaixa.v1` e `meuCaixa.profile.*.v4` **mantidos**; não há migração de chaves.
- Usuário deve preservar backup JSON e homologar fluxos reais. `V5-SETUP.md` apresenta implantação opcional e variáveis secretas.


## v5.1 — Sincronização ao vivo por conta Google

- Arquivos: `js/v51-live-engine.js` (diferenças e aplicação de mudanças), `js/v51-live-sync.js` (autenticação, fila, transações e observação em tempo real), `css/v51-live.css` e `LIVE-SYNC-SETUP.md`.
- Fonte local: `state` e `STORAGE_KEY`, vinculados ao perfil `user_<UID>` da v4. Hook **após** `save()` captura diferenças do JSON anterior, sem substituir o código financeiro. Mudanças remotas são aplicadas ao estado e gravadas sem chamar novamente o hook de envio.
- Firestore: `saldoplanLive/{uid}/records/{recordId}`; cada documento guarda `{section,itemId,payload,deleted,revision,actor,updatedAt}`. Alterações em registros com IDs preservam identidade; mapas por competência usam documentos por chave; seções de configurações usam um documento por campo. `cloud` e `version` não são sincronizados para proteger configurações de backup locais.
- Exclusões: `deleted:true` em vez de remover o documento. Não há política automática de expurgo de tombstones.
- Simultaneidade: uma transação verifica a revisão anterior antes da escrita. Divergências viram conflitos pontuais que exigem escolha; não há last-write-wins silencioso. Não há fusão automática de campos de um **mesmo** registro.
- Offline: fila de alterações por UID e perfil em `localStorage`, persistida após cada `save()`. O Firebase transmite eventos quando conectado. A fila pode ser limitada pelo espaço do navegador; um backup externo continua obrigatório.
- Inicialização: confirmação explícita por aparelho e marcador de progresso remoto para não restaurar uma primeira carga incompleta. Senha adicional não é exigida após login, porém **não é E2EE**; o conteúdo é acessível a administradores autorizados do Firebase.
- O backup AES-GCM em `saldoplanSync/{uid}` e os backups externos continuam independentes. Regras de segurança dessa coleção não devem ser removidas.
- Eventos de autenticação: `auth.js` invoca `saldoPlanLiveAuthChanged(uid|null)`; a troca de perfil interrompe a conexão anterior.
- Regressão: `tests/v51-live-sync.test.cjs` testa operações do motor sem acessar serviços externos. A integração Firestore necessita teste real após instalar as regras.


### v5.1.1 — Auto Sync seguro

O detector puro `isPristineProfile` (`js/v51-live-engine.js`) compara o estado local com a versão migrada do perfil vazio construído por `v4-features.js`. A reconciliação é estrita e não ignora lançamentos, configurações alteradas ou históricos. No snapshot inicial de `saldoplanLive/{uid}/records` (somente com `fromCache=false`), `js/v51-live-sync.js` conecta automaticamente apenas o perfil intocado. Os demais perfis continuam no fluxo assistido. O modo automático também valida o escopo UID e a época da sessão antes de persistir dados, evita reinicialização concorrente com o documento `__meta/init` e preserva os mecanismos de backup e conflitos v5.1.0. Sem alteração de regras Firestore.

### Conferência salarial v5.2.0

`js/v52-paycheck-engine.js` é um motor puro, sem dependências de DOM. `js/v52-paycheck.js` integra-se à tela `views/simulator.html`, já renderizada e carregada pelo `app.js`. `css/v52-paycheck.css` mantém a apresentação responsiva.

Os dados de comparação são gravados somente após clicar em **Salvar conferência do mês**, no objeto `state.payrollMonths[AAAA-MM].paycheckAudit`: `data` (horas, formato, DSR), `actual` (rubricas reais opcionais), `reference` (cálculo no momento) e `savedAt`. Usa o mecanismo já existente de `save()`/Live Sync e exportação de backup. O cálculo da conferência chama `inss2026` e `irrf2026` existentes, mas nunca grava alterações em `payrollConfig`, `referenceHours`, `overtimeLogs`, `importedPayroll`, `transactions` ou `fgtsByYear`.

Limites: cálculo tributário emulando as tabelas do simulador de 2026; regras patronais específicas/DSR podem ser distintas. Diferenças de rubricas não comprovam erro no pagamento. Os dados de contracheque podem ser sincronizados no Firestore não E2E criptografado.

### FGTS — v5.2.1

O estado existente `fgtsAccounts[]` contém cada conta com `currentBalance`, `balanceDate`, `years[].deposits`; `activeFgtsAccountId` indica a empresa escolhida. `fgtsAccountBreakdown()` em `js/payroll.js` calcula saldos com base no último extrato e nas movimentações posteriores até a data atual; operações anteriores ou incluídas no extrato são excluídas da soma. O histórico legado fica fora da consolidação. Nenhuma nova chave de armazenamento ou regra Firebase é necessária.

## v5.3.0 — Planejamento financeiro

- `js/v53-planning-engine.js`: biblioteca pura de datas, fluxo de caixa planejado, simulação de parcelas, metas, reconciliação manual e avisos. Sem rede.
- `js/v53-planning.js`: interface local que usa `state`, `save`, `renderAll`, `creditCards` e `financialGoals` do SaldoPlan. Saídas de texto do usuário codificadas para HTML; nenhuma coleta externa.
- `views/planning.html` e `css/v53-planning.css`: nova aba acessível por navegação desktop/mobile.
- `state.planningSettings` e `state.bankChecks` adicionados ao `seed` e `migrateState`: participam do Live Sync existente por seção. O segundo campo retém no máximo 40 comparações manuais.
- `app.js` carrega a nova view e os scripts após os módulos existentes; `js/ui.js` inclui renderização em `renderAll` e navegação. `sw.js` versionado para v5.3.0.
- Previsão: parte do valor informado pelo usuário, soma entradas e subtrai despesas com `status=planned`, exclui bônus Flash do saldo convencional e nunca volta a somar `realized`. Apenas transações materializadas entram na série; documentos bancários não são consultados.
- Contracheque, FGTS e abas antigas permanecem intactos.

## v5.3.2 — Mercado / SGS

`api/market.js` faz consultas oficiais por datas para as séries BCB SGS 1178 (Selic diária anualizada), 1 (dólar de venda diário) e 433 (IPCA mensal), com fallback limitado a 20 últimos valores por série. Retorna formato normalizado, status granular e dados marcados como antigos se só houver cache em memória. Não acessa Firestore nem dados do usuário. `api/news.js` consolida feeds externos datados. `api/treasury.js` lê o último dia do CSV do Tesouro, preservando variedade de categorias.

`js/market.js` somente renderiza dados públicos e armazena cache de resposta em chaves legadas `saldoplan.market.v531.*`, compatíveis com o cache da v5.3.1; não altera `meuCaixa.v1`, estados de perfil ou Live Sync. `views/market.html` e `css/market.css` permanecem isolados em `#view-market`. O Service Worker não intercepta `/api/*`. Consulte `MERCADO-5.3.2.md`.


## v5.3.3 — Notícias com calendário

`api/news.js` aceita `month=AAAA-MM` (janela de até 24 meses). Agrega RSS públicos e buscas Google Notícias por `after:/before:`, valida datas em `America/Sao_Paulo`, sanitiza URLs, extrai imagens apenas se fornecidas e devolve metadados com cobertura parcial declarada. Não há scraping nem arquivo histórico completo.

`js/market.js` mantém a consulta de indicadores independente das notícias, navega por meses, implementa filtros locais por dia/tema/texto e cache público por mês em `saldoplan.market.v531.news.month.*`. A atualização não toca o banco de dados financeiro, `state`, autenticação nem Live Sync. `views/market.html` e `css/market.css` permanecem isolados em `#view-market`.

`sw.js` atualiza a versão de ativos e ignora requisições `/api/*`. Consulte [MERCADO-5.3.3.md](MERCADO-5.3.3.md).


## v5.3.4 — Fotos opcionais em notícias
`api/news.js`: leitor RSS existente + feed HTTPS da Agência Brasil Economia, extração de `media:*`, `enclosure`, `<img>` de conteúdo e `og:image` somente em links diretos de três domínios autorizados (máximo quatro por resposta; 3 s por solicitação, sem redirects). Não executa links do usuário e não copia nem hospeda imagens externas. `js/market.js` aplica cache por mês com chave v5.3.4, enquanto `css/market.css` mantém placeholders compactos. A falta de foto nunca impede visualizar ou abrir a notícia.
