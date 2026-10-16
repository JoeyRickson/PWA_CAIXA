# SaldoPlan v4 — Ativação opcional das notificações push

**Status após instalar o patch:** código preparado, **não habilitado automaticamente**. O navegador continuará oferecendo os alertas locais com o aplicativo aberto mesmo sem esta configuração. O envio com o aplicativo fechado só será possível depois de configurar o backend e validar um teste real.

## Pré-requisitos

- Projeto Firebase `saldoplan` com Authentication Google habilitado.
- Firebase Cloud Messaging Web configurado e chave **VAPID pública** obtida em Firebase Console → Configurações do projeto → Cloud Messaging → Web Push certificates.
- Conta de serviço do **mesmo projeto** com permissões mínimas necessárias para Firestore e Firebase Cloud Messaging. Armazene o JSON inteiro da conta **somente** em uma variável de ambiente secreta na Vercel `FIREBASE_SERVICE_ACCOUNT_JSON`. Proteja e faça rotação desta credencial. **Nunca suba este JSON ao Git.**
- Configure `CRON_SECRET` como segredo forte da Vercel. A execução agendada da Vercel envia o cabeçalho `Authorization: Bearer <CRON_SECRET>`.
- Insira a VAPID **pública** em `push-config.js`. A chave privada VAPID permanece sob custódia do Firebase e **não deve ser exposta no frontend**.
- Verifique os limites da sua conta Firebase e Vercel antes de ativar a rotina agendada.

## Como funciona

1. Um usuário logado clica **Ativar lembretes push** e concede permissão do navegador.
2. O Google Cloud Messaging gera um token do aparelho; a API autenticada `POST /api/push-subscription` registra esse token num documento privado `saldoplanPush/{uid}/devices/{hashDoToken}` através do Admin SDK.
3. O aplicativo registra **somente as datas** de compromissos previstos dos próximos 45 dias. Não envia nome, valor, descrição ou saldo financeiro.
4. A rotina Vercel `GET /api/push-daily`, configurada para **12:00 UTC diariamente**, envia uma notificação **genérica** no dia de um compromisso. É feita no máximo uma tentativa por aparelho por dia, salvo repetição imprevista da rotina.
5. O Service Worker recebe o push e mostra a notificação, quando o navegador/SO permitir. O clique abre o aplicativo.
6. A desativação remove a inscrição do servidor; o navegador pode continuar mantendo permissão até o usuário revogá-la nas configurações do sistema.

## Observações operacionais

- A API `push-subscription` exige token de ID Firebase válido. Não há endpoint público para enviar notificações arbitrárias.
- A API `push-daily` exige `CRON_SECRET`; **não** o inclua no código do navegador.
- A rotina atual examina até **250 aparelhos por execução**; acima disso será necessário implementar paginação ou filas.
- A entrega não é garantida: o sistema pode atrasar, negar ou suprimir notificações, e celulares podem exigir que o PWA esteja instalado.
- A lista de datas é atualizada quando o usuário opta pelo push e em alterações posteriores enquanto a sessão está ativa; reconexão atualiza a inscrição.
- Teste Android real antes de tratar a funcionalidade como homologada. Não depende de ativar Cloud Firestore direto para dados financeiros; a cópia cifrada anterior permanece em `saldoplanSync`.
- Revise custos, índices do Firestore para `collectionGroup('devices')`, conta de serviço e políticas de retenção de tokens.
- Notificações genéricas no dia do vencimento **não** significam que valores ou descrições de contas são enviados ao servidor.

## Testes manuais mínimos

1. Configurar os serviços, publicar e abrir o app por HTTPS.
2. Entrar com Google e autorizar push; confirmar resposta de sucesso e documento Firestore na coleção `saldoplanPush`.
3. Adicionar uma despesa planejada para a próxima data de execução e conferir a atualização do calendário de datas.
4. Rodar a rotina em ambiente isolado com `CRON_SECRET` e verificar logs/recebimento, **sem** publicar segredos.
5. Desativar a assinatura e confirmar que foi removida.
6. Confirmar que não há transmissão de descrição, valores ou saldo nas notificações.

**Não habilite manualmente o endpoint de cron sem credencial de serviço e sem testes de envio real.**


### Extensão v5.0.0 — Antecedência

O usuário pode selecionar **no dia, 1, 3 ou 7 dias antes**. A API restringe esse parâmetro a valores permitidos e continua recebendo somente datas (sem nomes ou valores). A rotina cron executa **uma vez ao dia**, então a antecedência não representa uma notificação em horário individual ajustável. Consulte `V5-SETUP.md` para configuração e teste real.
