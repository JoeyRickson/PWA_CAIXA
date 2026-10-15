# Histórico de versões — SaldoPlan

## 3.0.0 — Financial Intelligence (candidato para homologação)

- Área **Inteligência financeira**, com limites mensais de orçamento por categoria, progresso e indicadores de excesso.
- Insights descritivos de entradas e despesas realizadas e comparativo com o mês anterior.
- Busca global em lançamentos, Guardado, Carteira, cartões, dívidas e metas.
- Relatório anual: série de doze meses, CSV e impressão/salvamento como PDF.
- Preferências de notificações e avisos do navegador enquanto o app está em uso. Sem push no navegador fechado.
- Painel de verificação da estrutura de backups JSON e SHA-256 no aparelho, sem restaurar automaticamente.
- Sincronização protegida opcional (beta) por snapshot AES-GCM em Firestore, com senha não persistida, conflito e confirmação de restauração. Depende de configurar Firestore e regras.
- Protocolos de suporte no e-mail e histórico local por usuário. Acompanhamento remoto de status ainda não implementado.
- Documentação `ARQUITETURA.md` e `FIRESTORE-SETUP.md` atualizadas.
- Homologação do layout: cartões de sincronização, notificações e integridade recebem largura responsiva; botões não se sobrepõem e o menu lateral mantém legibilidade.
- Nenhuma mudança de framework ou chave `meuCaixa.v1`.

### Limitações deliberadas

- Não foi implementada mesclagem de edições concorrentes entre aparelhos.
- Não há envio push por servidor nem persistência remota dos status de suporte.
- Relatórios consideram os lançamentos realizados e podem incluir duplicidade de faturas registradas como pagamentos e parcelas.

## 2.21.x — Suporte e sugestões

- Canal autenticado por Google e e-mail Resend.
- Correção das dependências Firebase Admin e template de e-mail HTML.

## 2.20.x — Calendário, mobile, temas e animações

- Calendário financeiro, alertas, fechamento do mês, onboarding, temas, responsividade e loading.

## 2.14–2.19 — Modularização e domínios financeiros

- Módulos separados, rollback, recorrências completas, cartões, patrimônio, metas e importação.
