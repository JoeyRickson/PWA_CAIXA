# SaldoPlan v3.0.0 — Configuração opcional do Firestore

O SaldoPlan continua **100% utilizável sem Firestore**. O Firestore é necessário somente para enviar e recuperar a **cópia criptografada entre aparelhos**. O Google Drive mantém seu próprio sistema de backup e não depende desta configuração.

## Ativar

1. Acesse o projeto Firebase **saldoplan** no [Firebase Console](https://console.firebase.google.com/).
2. Abra **Firestore Database** e crie o banco `(default)` (Native mode). Confira região, cotas e regras de faturamento antes de criar.
3. Em **Regras**, substitua apenas após revisar e publicar as regras apropriadas para o seu projeto. Exemplo mínimo para o recurso desta versão:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /saldoplanSync/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create, update: if request.auth != null && request.auth.uid == userId
        && request.resource.data.keys().hasOnly(['data','salt','iv','hash'])
        && request.resource.data.keys().hasAll(['data','salt','iv','hash'])
        && request.resource.data.data is string
        && request.resource.data.data.size() < 850000
        && request.resource.data.salt is string
        && request.resource.data.iv is string
        && request.resource.data.hash is string;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

**Atenção:** se já existem coleções e regras próprias no projeto, **combine** essas regras com as existentes. Não publique um `match /{document=**}` que libere acesso público.

## Como usar

1. Em ambos os aparelhos, entre na mesma conta Google no SaldoPlan.
2. Abra **Dados e backup → Sincronização protegida**.
3. Defina a **mesma senha longa (12+ caracteres)** nos aparelhos. Ela nunca é enviada ao Firebase. Uma senha perdida torna a cópia remota ilegível.
4. No aparelho com dados, faça uma exportação JSON local e toque em **Enviar cópia criptografada**.
5. No segundo aparelho, exporte um JSON local antes, digite a senha e toque em **Verificar / restaurar**. Confirme somente se a cópia está correta.
6. O modo automático é opt-in e funciona **somente com a guia aberta e senha presente em memória**. Não há sincronização de segundo plano com o app fechado.

### Conflitos e limites

- Se outro aparelho alterou a cópia remota, o envio automático é interrompido. O envio manual exige confirmação explícita.
- A cópia é um **snapshot completo**, e não uma mesclagem de lançamentos concorrentes. Alterações locais feitas em dois aparelhos não são mescladas automaticamente.
- O limite prático por documento é de aproximadamente **530 KB de JSON antes da criptografia**. Para históricos maiores use o backup Google Drive.
- Os dados ficam em Firestore como texto criptografado com AES-GCM 256 e chave derivada por PBKDF2-SHA256, mas ainda existem riscos próprios da custódia de senhas e do armazenamento remoto.
- A ausência de um retorno de sucesso **não** comprova envio ou restauração.

## Suporte e notificações

- Os protocolos de suporte da v3 são armazenados **no aparelho** que enviou a solicitação. O e-mail recebido pelo desenvolvedor contém o mesmo protocolo. Não há painel de alterações de status remoto nesta versão.
- Notificações desta versão são notificações de navegador **enquanto o app estiver aberto**. Notificações push com o app fechado exigem subscriptions, armazenamento seguro no backend e serviço de disparo, não inclusos neste pacote.

## Atualização v3.1.0 — desbloqueio por dispositivo

### Segurança da opção Lembrar desbloqueio

- **Somente por aparelho/navegador e conta Firebase (UID)**. Mesma conta em aparelho novo não libera a senha sem cadastrá-la naquele dispositivo.
- O `CryptoKey` AES-GCM persistido no IndexedDB é **não exportável**; a senha é armazenada como dado criptografado com IV aleatório e `additionalData` vinculado ao UID e ao projeto. Não há armazenamento em texto puro em `localStorage`/Firestore.
- A proteção é voltada a evitar exposição casual dos segredos salvos. **Não protege contra código malicioso ou XSS executado no mesmo domínio**, invasão do navegador ou acesso a um perfil desbloqueado. Não é biometria, não equivale a keystore de sistema operacional.
- Ao sair da conta, o segredo em memória é invalidado; o registro local persistente permanece até o usuário escolher **Esquecer** ou limpar dados do navegador, para facilitar novo login autorizado.
- Não ative Lembrar em computadores compartilhados. Mantenha o arquivo JSON/backup Drive e uma cópia da senha segura fora do navegador.

### Estratégia de conflito

A v3.1 continua usando **um documento por UID** (`data`, `salt`, `iv`, `hash`). Na abertura de uma sessão automática, se o hash remoto divergir dos dados locais, **não existe envio automático**. O usuário deve abrir **Verificar / restaurar** para aceitar a cópia remota, ou iniciar um envio **manual** e confirmar a substituição. Cada PATCH valida a revisão `updateTime` do Firestore; alterações concorrentes resultam em bloqueio. Não existe mesclagem de alterações entre aparelhos.

## Atualização v3.1.1 — Backup entre aparelhos

Na interface, a sincronização cifrada do Firestore passou a ser apresentada como **Backup entre aparelhos**; a tecnologia, o caminho `saldoplanSync/{uid}` e as regras não mudaram. A senha de proteção aceita no mínimo **8 caracteres** (antes 12), sem alterar AES-GCM, PBKDF2 ou os campos remotos. Senhas existentes continuam funcionando. Recomendamos senhas longas e exclusivas; oito caracteres são apenas o mínimo de usabilidade, não uma garantia de robustez.

A opção Lembrar a senha continua explícita, vinculada à conta Google e a este navegador pessoal. O backup automático só envia cópias enquanto a página estiver aberta e segura, com bloqueio de conflito. Para cópias independentes, utilize também o backup manual em arquivo ou o Google Drive.

## v3.1.2 — Login e backup na nuvem

Esta atualização não exige mudanças no Firestore. O atalho da última conta usa somente metadados locais (nome e e-mail), não consulta contas cadastradas no Android e não modifica o UID usado em `saldoplanSync`. A proteção por senha de 8 ou mais caracteres e as regras anteriores permanecem iguais. O histórico local continua separado da cópia criptografada do Firestore.


## v5.1.0 — Live Sync (opcional)

A sincronização automática usa outra coleção, **`saldoplanLive`**, sem alterar o backup AES-GCM existente em `saldoplanSync`. Veja [LIVE-SYNC-SETUP.md](LIVE-SYNC-SETUP.md) e **adicione** as regras da nova coleção às regras já existentes. Não substitua toda a política por um exemplo isolado.


> v5.1.1 Auto Sync mantém o mesmo modelo de acesso da v5.1.0 em `saldoplanLive/{uid}/records`; não exige republicar regras para funcionar. O login Google não dispensa a primeira decisão em aparelhos que já contenham dados financeiros diferentes.
