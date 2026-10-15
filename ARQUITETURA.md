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
