# SaldoPlan v5.0.0 — Configuração e homologação

## Instalação única

1. Exporte um backup JSON antes de iniciar. Não limpe os dados do PWA.
2. Instale `SaldoPlan_v5_CONSOLIDADO_FINAL.zip` com o script `Aplicar-SaldoPlan-v5.0.0-Consolidado.ps1`. O instalador valida hashes normalizados, salva backup dos arquivos e não executa Git.
3. Execute `node --check` nos módulos JS, `npm.cmd test`, `npm.cmd audit --omit=dev` e `git diff --check`.
4. Valide perfis Google e offline, backups, operações de metas, calendário/PDF e assistente em desktop e Android.
5. Publique somente após confirmar a integridade dos dados e resultados do ambiente real.

## Central administrativa de suporte

Variáveis **somente no servidor** (Vercel Production e Development, conforme o caso):

- `SUPPORT_ADMIN_UID`: UID da conta Firebase autorizada. Nunca use e-mail como substituto para autorização. Confira o UID em Firebase Authentication → Users.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON de uma conta de serviço **do projeto `saldoplan`**, com acesso mínimo ao Firestore e verificação de tokens. Guarde somente em Environment Variables Secret. Não inclua no Git, prints ou chats.
- `FIREBASE_PROJECT_ID=saldoplan`, `RESEND_API_KEY` e `SUPPORT_FROM_EMAIL`: já utilizados pelo suporte existente.

Após configurar, cada nova solicitação enviada por e-mail também tenta gravar um documento em `saldoplanSupportTickets/{protocolo}`. **Se o Firestore falhar, o envio do e-mail não é desfeito**; haverá protocolo enviado por e-mail, mas sem entrada administrativa. O painel mostra até 60 chamados recentes. As regras do Firestore devem continuar negando acesso direto ao cliente à coleção administrativa; o backend usa Admin SDK e é protegido por UID.

O envio de respostas para usuários diferentes do titular da conta Resend normalmente exige um **domínio de remetente verificado**. `onboarding@resend.dev` é para testes restritos. Não exponha `SUPPORT_ADMIN_UID` ou credenciais em JS público.

## Push em segundo plano

Consulte `PUSH-SETUP.md` para VAPID público, token FCM e configuração do cron na Vercel (`CRON_SECRET`). A UI da v5 permite aviso no próprio dia ou 1/3/7 dias antes. São enviados **apenas datas, fuso horário e token do dispositivo**. A rotina executa uma vez por dia, às 12:00 UTC. O envio é genérico, sem valor, descrição ou categoria. O servidor examina no máximo 250 dispositivos por execução; acima disso será necessário paginação. Push não é garantia de entrega. Faça teste real e monitore custos do Firestore/Vercel.

## Assistente, metas e fechamento

O assistente funciona localmente por regras, usa apenas lançamentos realizados e não envia dados a IA externa. Registrar um progresso manual de meta atualiza o campo `currentAmount` com histórico opcional em `contributions`, sem criar transação. O fechamento em PDF usa a caixa de impressão do navegador e não salva modificações automaticamente. Já existiam metas e fechamentos na v4; não foram criados cadastros paralelos.

## Teste obrigatório antes de lançamento

- [ ] Backup JSON preservado, perfil offline/Google e troca de conta sem vazamento entre perfis
- [ ] Backups manuais, Drive, histórico e cópia criptografada funcionando
- [ ] Metas antigas persistem; progresso manual e desfazer testados
- [ ] Assistente responde corretamente com mês selecionado e lançamentos realizados
- [ ] Fechamento e impressão/PDF exibem valores coerentes
- [ ] Suporte por e-mail continua entregando mensagens; painel administrativo validado quando configurado
- [ ] Push testado em HTTPS com instalação e permissão reais, quando configurado
- [ ] Navegação mobile/desktop, foco e contraste dos 14 temas conferidos
- [ ] Auditoria npm sem vulnerabilidades e Git sem segredos

**Não exponha `FIREBASE_SERVICE_ACCOUNT_JSON`, `RESEND_API_KEY` ou tokens OAuth.**


## Base consolidada e correção de datas

Esta compilação incorpora a linha v4.0.0 após o hotfix de datas de lançamentos.
O arquivo `js/transactions.js` é preservado integralmente; lançamentos futuros não recorrentes não devem sofrer restrições pelo início da repetição.
Não aplique o pacote v5 antigo sobre esta versão.

A instalação não importa, converte ou apaga lançamentos locais. Exporte um backup JSON antes dos testes.
Os serviços de push e administração precisam de configuração externa, conforme o guia.
