# Histórico de versões — SaldoPlan

## 3.1.0 — Desbloqueio por dispositivo e sincronização com proteção de conflito

- Opção **Lembrar desbloqueio neste aparelho**, associada ao UID do login Google: chave AES-GCM **não exportável** criada pelo Web Crypto e guardada no IndexedDB com a senha encapsulada em forma cifrada. A senha **não** é gravada em texto no `localStorage`, enviada ao Firestore ou compartilhada entre aparelhos.
- Após primeiro desbloqueio com sucesso, aparelhos pessoais autorizados podem enviar e verificar cópias sem redigitar a senha, inclusive após recarregar e autenticar novamente na mesma conta.
- Ação **Esquecer desbloqueio deste aparelho**: remove a chave local, bloqueia a sessão e desativa a sincronização automática sem apagar backups ou dados.
- Abertura de sessão automática confere a impressão digital remota antes do primeiro envio e **pausa em divergência**, preservando alterações locais e remotas. Atualizações usam a pré-condição `updateTime` do Firestore.
- Antes de sobrescrever um snapshot existente, valida que a senha usada realmente consegue descriptografar a cópia atual. A restauração continua pedindo confirmação e criando uma proteção local anterior.
- Documentação `ARQUITETURA.md` e `FIRESTORE-SETUP.md` atualizadas; PWA e cache passam à v3.1.0.

**Limites de segurança:** lembrar a senha não equivale a cofre de hardware ou autenticação biométrica: JavaScript executado sob a mesma origem pode usar a chave enquanto este perfil do navegador estiver desbloqueado. Use apenas em dispositivo pessoal. Se apagar os dados do navegador, será necessário informar a senha original. Ao entrar pela primeira vez em outro dispositivo, também é necessário informá-la. **Não há mesclagem automática** de edições concorrentes e o envio automático funciona somente enquanto a aplicação está aberta.

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
