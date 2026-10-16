## 5.1.4 — Dados e backup mais simples (16/10/2026)

- Reorganizada a aba **Entre aparelhos**: primeiro o estado da conta e a ação necessária; cópia com senha ficou opcional e recolhida.
- Mensagens de sincronização em linguagem comum, sem termos de infraestrutura. Os detalhes de segurança continuam acessíveis em **Privacidade e proteção dos dados**.
- A primeira conexão mostra só a ação aplicável: **Usar dados da minha conta** quando já existe histórico salvo, ou **Salvar dados deste aparelho** quando a conta está vazia. A opção de juntar aparece como alternativa quando aplicável.
- Mantidos os identificadores e eventos das funções anteriores; não houve alteração do motor de dados, mesclagem, exclusão, permissões ou armazenamento.
- Atualizado o cache da PWA para entregar o novo visual.

## v5.1.3 — Correção da primeira conexão do Auto Sync (homologação)

- Perfil novo nao fica falsamente classificado como usado por defaults de folha, 13o, FGTS e snapshot patrimonial do proprio app.
- Comparacao estrita dos campos gerados: qualquer valor preenchido/alterado ou snapshot historico impede substituicao automatica.
- Nao modifica backups, regras Firebase, credenciais nem a logica de resolucao de conflitos.
- Testes unitarios e simulacao de recebimento do Firestore para o caso real.

## v5.1.2 — Auto Link seguro (homologação)

- Auto recuperação ao entrar com Google em um perfil novo **ou** com todos os registros locais idênticos aos do Firestore.
- Se houver dados exclusivos, excluídos na nuvem ou diferentes, o aplicativo pede conciliação inicial e explica o motivo.
- Revalidação antes da ativação para impedir sobrescrita automática após mudança local.
- Nova bateria de testes para login, registros extras na nuvem e conflitos; bump do cache PWA e versão.
- A sincronização em dois sentidos continua automática após a primeira associação.

## v5.1.1 — Auto Sync por login Google (homologação)

- Aparelhos com perfil financeiro novo/padrão vinculam-se à conta Google automaticamente ao receber o primeiro snapshot **confirmado pelo servidor** do Firestore.
- Nuvem com registros: dados da conta são carregados sem pedir clique em configurações; nuvem ainda não inicializada: envia a base padrão e habilita futuras alterações.
- Se há dados locais diferentes, alterações pendentes ou conflitos, a primeira vinculação continua manual; **nunca sobrescreve históricos automaticamente**.
- Mantidos: backup JSON/críptografado, segregação por UID, histórico de segurança, sincronização offline, revisões/tombstones e resolução explícita de conflitos.
- Corrigido o rótulo fixo v5.0.0 no cabeçalho e ajustado o texto do onboarding.
- Atualizado o cache PWA para `saldoplan-v5.1.1-auto-sync`.

## [5.1.0] — Live Sync (candidato à homologação)

- Sincronização bidirecional por registro, vinculada à mesma conta Google e às regras privadas do Firestore.
- Atualizações em tempo real com `onSnapshot`, fila persistida para edições offline e envio ao reconectar.
- Inclusão, edição e exclusão propagadas individualmente; registros excluídos usam tombstones.
- Controle otimista de revisões em transações para impedir sobrescrita silenciosa de alterações simultâneas.
- Primeira associação assistida, snapshot de segurança e bloqueio de recuperação parcial enquanto a cópia inicial está sendo enviada.
- Interface em Backups → Entre aparelhos; backup criptografado tradicional preservado e separado.
- Motor determinístico e testes de regressão para mescla, exclusões, diferenças e dados legados.
- Atualizações de README, arquitetura, guia Firestore e cache PWA.
- **Limite:** o Live Sync com somente login Google não oferece criptografia ponta a ponta; necessita ativação das regras Firestore e homologação em dispositivos reais.

## v5.0.0 — Evolução integrada (candidata à homologação)

- Push opt-in: antecipação de 0, 1, 3 ou 7 dias. Rotina diária envia somente lembretes genéricos; exige Firebase Cloud Messaging, service account, VAPID e CRON_SECRET.
- Segurança: central de suporte protegida por UID no servidor, isolamento de perfis mantido e novos testes locais de análise.
- Metas: registrar progresso em objetivos com acompanhamento manual (não gera automaticamente despesa/receita).
- Assistente local: perguntas predefinidas e regras para despesas, entradas, categorias, meses e metas. Não é uma IA conectada.
- Suporte administrativo: lista de protocolos, status e resposta via Resend; requer configuração adicional de Firebase Admin/Firestore e remetente verificado para e-mail externo.
- Fechamento mensal: exportação local por impressão para PDF a partir do calendário, sem modificar o fechamento salvo.
- Acessibilidade: foco visível, salto para conteúdo e controles adaptáveis; cache PWA versionado.
- README.md e documentação de configuração, segurança e testes atualizados.
- Limitações: não inclui mesclagem automática de snapshots, garantia de entrega push nem login biométrico universal.

# Histórico de versões — SaldoPlan

## v4.0.0 — Hotfix de datas preservado na migração para v5

- Lançamentos únicos futuros (previstos ou realizados) podem ser gravados sem acionar validações de recorrência.
- Datas de início/fim continuam sendo verificadas nos casos recorrentes.
- Testes `tests/transaction-dates.test.cjs` continuam obrigatórios antes de publicar.


## v4.0.0 — Backup organizado por modo (ajuste de homologação)

- Reformulada a aba Backups em três modos de escolha: **Na nuvem**, **Arquivo e versões**, **Entre aparelhos**.
- Separados dados locais, backup em arquivo, histórico restaurável e verificação de integridade, evitando cartões repetidos em uma mesma tela.
- Mantidas ações de backup, exportação, importação, sincronização criptografada, controles de conta e 101 IDs originais da página.
- Melhoradas navegação por teclado e responsividade em desktop e mobile. Sem mudanças financeiras, de criptografia, Firebase ou Google Drive.



## v4.0.0 — Reorganização da aba Backups (homologação)

- Movidos **Backup entre aparelhos** e **Verificar dados e backups** da aba Segurança para **Backups**.
- Criada a seção **Recuperação e verificação**, exibida após os backups na nuvem e os backups manuais, com cartões responsivos e altura natural.
- A aba **Segurança** permanece dedicada a diagnóstico, notificações e limpeza dos dados.
- Preservados IDs, botões, senha lembrada, backups, dados financeiros, autenticação, Firestore e todas as funções existentes.
- Atualizado o cache PWA e a arquitetura documentada; nenhuma mudança de lógica de sincronização.



## v4.0.0 — Correção de contraste entre temas (homologação)

- Corrigidos fundo, borda e texto do painel **Segurança e diagnóstico** em temas claros e escuros.
- **Perfis financeiros**, menu de lançamento rápido e indicadores agora utilizam os tokens dos 14 temas, sem cores de fallback escuras fixas.
- Botões de diagnóstico e controles interativos exibem contraste e foco de teclado adequados aos temas.
- Cache da PWA versionado novamente, sem qualquer mudança nos dados ou no JavaScript funcional.



## v4.0.0 — Ajuste de organização: aba Finanças (homologação)

- A página **Dados e backup** passa a ter cinco abas: Backups, Aparência, Finanças, Segurança e Minha conta.
- Remove Meta mensal para guardar/investir e Bônus opcional de Aparência e organiza ambos em **Finanças**.
- Mantém integralmente os campos, IDs e os botões, sem migrar dados ou alterar regras financeiras.
- Melhorias responsivas: cinco abas acessíveis no mobile e cartões financeiros sem estiramento no desktop.
- Atualiza CSS e versão de cache da PWA; nenhum commit automático.


## v4.0.0 — Homologação: reorganização de Dados e backup (layout2)

- Agrupa as preferências em galeria de temas e coluna independente com Meta/Bônus.
- Coloca backup em nuvem e backups locais em colunas independentes, sem esticar painéis curtos.
- Reorganiza diagnóstico, sincronização, notificações e limpeza em colunas de altura natural.
- Mantém todos os IDs e ações existentes, sem modificar cálculos, contas, JSON, APIs ou integração Firebase.
- Ajusta responsividade e cache da PWA para a revisão visual `4.0.0-layout2`.


## 3.1.6 — Botão Google integrado aos temas

- Ajuste exclusivamente visual no Android: mantém o botão oficial Google Identity Services, agora com variante `filled_black` nos temas escuros e `outline` nos claros, formato arredondado e contorno alinhado ao tema ativo.
- O botão acompanha alterações de tema durante a sessão; o visual é renderizado pelo SDK oficial do Google, sem editar o conteúdo do iframe.
- Em **Dados e backup**, oculta o botão de **Entrar com Google** quando a conta já está conectada, evitando uma ação redundante. Ao sair, o botão volta a aparecer.
- Preserva o fluxo de autenticação, IDs OAuth, backups, Firestore, chaves, armazenamento financeiro e login desktop.
- Atualiza versão e cache PWA para `3.1.6`.

## 3.1.5 — Entrada simplificada no Android

- Android: oculta o cartão **Última conta usada** na tela de entrada. O login usa exclusivamente o seletor oficial Google Identity Services ou a opção offline.
- Computador: mantém o cartão e o atalho da última conta, sem alterar o login via Firebase popup.
- A conta ainda pode ser lembrada internamente para o desktop, mas a informação não é usada como autenticação no Android.
- Atualiza o carregamento de `auth.js` e o cache do Service Worker para `3.1.5`. Sem alterações no Drive, Firestore, dados financeiros ou formatos de backup.

## 3.1.4 — Login Google sem redirecionamento no Android
- Corrigido o fluxo Android para usar o botão oficial Google Identity Services e o ID token diretamente no Firebase (`signInWithCredential`), evitando o erro `missing initial state`.
- Sessões Firebase continuam reutilizadas sem login repetido enquanto válidas.
- Desktop mantém login por pop-up; o Google Drive mantém seu cliente OAuth separado.
- Cache PWA atualizado e documentação de OAuth esclarecida.
- Testes simulados e sintaxe validados; login real no Android pendente de homologação.

## 3.1.3 — Correção do login Google no Android
- No Android, autenticação com redirecionamento Google em vez do pop-up suscetível ao erro `popup-closed-by-user`.
- Reaproveitamento da sessão Firebase válida e bloqueio de tentativas simultâneas.
- Tratamento claro de erros de domínio e retorno OAuth, sem loops automáticos de login.
- Evita cache do fluxo OAuth no Service Worker; cache do PWA atualizado para v3.1.3.
- Dados financeiros e backups existentes preservados.

## 3.1.2 — Backup e acesso simplificados
- Nome neutro **Backup na nuvem** para Google Drive, OneDrive e Dropbox; descrições esclarecem diferenças de restauração.
- Histórico local compacto com linha do tempo por data, prévia das 3 últimas versões, expansão e preferências recolhidas.
- Tela de entrada com atalho para a última conta Google utilizada neste navegador, opção de selecionar outra conta e remoção do atalho. Mantém persistência do Firebase e não acessa a lista de contas do Android.
- Sem alterações no armazenamento financeiro, APIs, formatos de backup e sincronização protegida.

## 3.1.1 — Backup simplificado e mensagens acessíveis

- Telas distinguem dados salvos no aparelho, backup manual em arquivo, backup no Drive/outro serviço e backup protegido entre dispositivos.
- Sincronização apresentada como **Backup entre aparelhos**, com ajuda técnica expansível, botões claros e avisos de conflito visíveis.
- Campo agora aceita **senha de proteção a partir de 8 caracteres**, recomendando senhas longas; o formato criptografado do Firestore e a proteção por conta permanecem inalterados.
- Texto de status mais simples e cache PWA atualizado para v3.1.1.
- Nenhuma mudança de dados financeiros, autenticação Google, regras Firestore, Google Drive ou mecanismo de recuperação.

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

## v4.0.0 — Perfis, produtividade, segurança e notificações (candidata à homologação)

- Perfis locais separados por UID do Firebase após **confirmação explícita** de cópia de dados legados; base `meuCaixa.v1` preservada e perfil offline separado após a adesão.
- Lançamento rápido no mobile reutiliza a caixa financeira existente para receitas, gastos e despesas previstas.
- Backup entre aparelhos: comparação de quantidades e datas das cópias antes da restauração e instruções mais claras de conflito; continua sem mesclagem automática.
- Importação: além da chave exata, revisão preventiva de possíveis duplicados pelo mesmo estabelecimento, valor e data em até um dia; seleção de possíveis repetidos continua desmarcada.
- Diagnóstico local de armazenamento, conta e último backup, com exportação de resumo **sem lançar dados financeiros**.
- Notificações em segundo plano: integração Firebase Messaging, APIs protegidas e agendamento Vercel preparado. **Requer configuração externa e teste real, não ativo por padrão**. Veja `PUSH-SETUP.md`.
- Documentação GitHub substituída por `README.md` abrangente, com arquitetura, instalação, privacidade e limitações; `ARQUITETURA.md` revisado.
- Cache PWA atualizado para v4.0.0; sem alterações automáticas de dados no servidor nem commit automático.
- Homologação de desktop: corrigida a grade de 12 colunas em Dados e backup para os seis painéis adicionados na v4.0.0; cartões passam a ocupar metade da linha ou toda a largura em notebooks. Botões e textos deixam de ficar comprimidos. Cache de layout atualizado sem remover dados locais.

### v4.0.0 — Ajuste de usabilidade de Dados e backup
- Organização por quatro abas (Backups, Aparência, Segurança, Minha conta), evitando uma página muito longa e cartões comprimidos.
- Cartões em largura confortável no desktop e uma coluna no celular; 14 temas continuam disponíveis.
- Navegação acessível por teclado, sem alterar formulários, dados financeiros ou backups.
