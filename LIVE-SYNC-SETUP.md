## v5.1.3 — Inicialização silenciosa e proteção de informações

Alem do perfil inteiramente novo e de registros locais ja identicos na nuvem, o app considera novo um perfil com **apenas registros padrao gerados pelas telas** (configuracoes padrao do mes de folha, do 13o, FGTS e um snapshot zerado do dia atual). Todos os campos precisam ser exatamente os defaults. Se um valor for personalizado, antigo, financeiro ou exclusivo, a escolha manual continua obrigatoria. Exporte backups JSON antes dos testes.

## v5.1.2 — Vinculação sem clique quando for comprovadamente segura

Ao entrar com Google, um perfil inicial sem dados financeiros personalizados recupera a nuvem automaticamente. Isso também acontece se **todos os registros já presentes no aparelho** estiverem idênticos aos correspondentes na nuvem (a nuvem pode ter registros adicionais). Nenhum valor distinto é apagado nesse processo.

**Aparelho já utilizado:** se houver qualquer registro local diferente, exclusivo ou anteriormente excluído na nuvem, a interface solicitará conciliação. Essa primeira decisão é intencional, porque um login Google, sozinho, não prova que os dados locais podem ser descartados. Faça backup JSON nos dois aparelhos antes de escolher. Após a associação, edições/criações/exclusões sincronizam automaticamente.

**Homologação:** teste com navegador privado realmente novo, e também um navegador já usado com dados diferentes. Nunca limpe armazenamento para forçar um teste.

# SaldoPlan v5.1.0 — Live Sync entre aparelhos

## Antes de ativar

O Live Sync é **opcional** e diferente do **Backup entre aparelhos** com senha. Ele usa o **mesmo login Google** no celular e no computador para acompanhar inserções, edições e exclusões quase em tempo real enquanto o aplicativo está aberto, e buscar mudanças ao abrir novamente.

**Não apague o armazenamento do navegador.** Salve um backup JSON em cada aparelho que já contenha dados. Na primeira conexão de cada aparelho, compare os dados e escolha como vinculá-lo. Nunca permita que a primeira cópia de um dispositivo sobrescreva dados de outro automaticamente.

Os dados do Live Sync são armazenados no Firestore em registros por item e **não são criptografados ponta a ponta por senha própria**. A infraestrutura Google aplica criptografia em trânsito e em repouso, mas administradores autorizados do projeto Firebase podem ter acesso ao conteúdo. O backup AES-GCM com senha, em `saldoplanSync`, permanece intacto.

## Regras de segurança do Firestore

Abra **Firebase Console → projeto saldoplan → Firestore Database → Regras**. **Insira somente este bloco `match` dentro do `match /databases/{database}/documents` que já existe**, preservando as regras do `saldoplanSync`, do suporte e de notificações. Não duplique os blocos `service cloud.firestore`.

```javascript
match /saldoplanLive/{userId}/records/{recordId} {
  allow read: if request.auth != null && request.auth.uid == userId;

  function owned() {
    return request.auth != null && request.auth.uid == userId;
  }
  function validData() {
    return request.resource.data.keys().hasOnly([
        'section','itemId','payload','deleted','revision','actor','updatedAt'
      ])
      && request.resource.data.keys().hasAll([
        'section','itemId','payload','deleted','revision','actor','updatedAt'
      ])
      && request.resource.data.section is string
      && request.resource.data.section.size() <= 55
      && request.resource.data.itemId is string
      && request.resource.data.itemId.size() <= 240
      && request.resource.data.payload is string
      && request.resource.data.payload.size() < 650000
      && request.resource.data.deleted is bool
      && request.resource.data.actor is string
      && request.resource.data.actor.size() <= 128
      && request.resource.data.revision is int
      && request.resource.data.revision >= 1
      && request.resource.data.updatedAt == request.time;
  }

  allow create: if owned() && validData()
    && request.resource.data.revision == 1;
  allow update: if owned() && validData()
    && request.resource.data.section == resource.data.section
    && request.resource.data.itemId == resource.data.itemId
    && request.resource.data.revision == resource.data.revision + 1;
  allow delete: if false;
}
```

**Importante:** teste as regras no Rules Playground/Emulator com um UID autenticado e outro UID diferente. Uma conta não pode ler nem alterar `saldoplanLive` de outra. Não use `allow read, write: if true`. Se já houver regras existentes, integre o bloco, não substitua regras de outras coleções.

## Primeiro aparelho

1. Faça login com Google e confira se o perfil financeiro exibido é o correto.
2. Faça **Backups → Arquivo e versões → Baixar arquivo de backup (.json)**.
3. Vá a **Backups → Entre aparelhos → Sincronização automática**.
4. Se a nuvem estiver vazia, selecione **Ativar com os dados deste aparelho**.
5. Aguarde até aparecer **Tudo atualizado** e `0 alterações pendentes`. Não feche a página durante a primeira carga.

## Segundo aparelho

1. Entre com **a mesma conta Google** e exporte um JSON do estado local, caso já tenha dados.
2. Vá para **Sincronização automática**. A cópia da nuvem deve ser identificada.
3. Escolha **Carregar dados da nuvem** (preserva cópia local de segurança) ou **Unir sem sobrescrever**. A mesclagem interrompe se encontrar registros diferentes com a mesma identidade.
4. Depois da vinculação, alterações futuras serão enviadas automaticamente. Não há senha adicional do backup para o Live Sync.
5. Faça testes criando, editando e removendo um lançamento de teste entre os aparelhos. Confirme o resultado antes de cadastrar dados importantes.

## Offline, conflitos e limites

- O navegador mantém o último estado financeiro local e a fila de alterações pendentes por UID. Ao recuperar conexão, a fila tenta transmitir os itens alterados. O uso offline depende do cache PWA e de espaço disponível no navegador.
- Se o mesmo item mudar simultaneamente em dois aparelhos, o Live Sync pausa **aquele** item, preserva ambas as versões e oferece **Usar nuvem** ou **Manter meu**. A resolução também cria uma proteção local.
- Exclusões são propagadas por *tombstones*. Não remova documentos da coleção manualmente.
- Mapas por competência (FGTS, 13º e folha) têm granularidade por competência. Outros objetos de configuração usam granularidade por seção, podendo gerar conflitos ao editar campos diferentes da mesma seção.
- O Firestore pode gerar custos de leituras e gravações. Verifique o uso no Firebase Console e defina alertas de orçamento.
- Não é uma solução de banco relacional ou sincronização criptografada ponta a ponta. Em ambientes com vários usuários, valide escalabilidade, regras e limites antes de liberar amplamente.

## Diagnóstico

- **Permissão negada:** revise regras, UID, autenticação e banco `(default)`.
- **Offline:** reconecte e mantenha a tela aberta até as pendências serem enviadas.
- **Conflito:** não limpe dados; exporte JSON e escolha a versão somente após conferência.
- **Erro de inicialização:** recupere o backup JSON e solicite suporte. Não altere documentos do Firestore manualmente.

## v5.1.1 — Login Google já inicia sincronização em um aparelho novo

- Entre com a **mesma conta Google** no computador e no celular.
- O aplicativo aguarda um retrato **confirmado pelo servidor** do Firestore antes de fazer o primeiro vínculo automático. Não considera cache offline como prova de que a nuvem está vazia.
- Quando o perfil local ainda é exatamente o perfil inicial gerado pelo SaldoPlan (sem edições/importações), a primeira vinculação é automática. Se há dados no Firestore, eles são carregados; se a conta ainda não tem dados, é iniciado o espaço sincronizado.
- Se houver **qualquer diferença local**, mantenha os dados: faça backup JSON e escolha manualmente **Carregar dados da nuvem** ou **Unir sem sobrescrever**. Isso é intencional e protege seus dados.
- Para aparelhos já ativados na v5.1.0, o vínculo é preservado. Nenhuma nova permissão Firebase/Firestore é exigida em relação às regras da v5.1.0.
- Teste no **mesmo deployment/versão** em dois dispositivos; compare criação, atualização e exclusão; não apague dados do navegador para forçar inicialização.
- Os dados da sincronização automática **não possuem criptografia ponta a ponta com senha adicional**, diferentemente do backup criptografado opcional.
