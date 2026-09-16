MEU CAIXA — CONTROLE FINANCEIRO PESSOAL
Versão 2.4

O Meu Caixa é um PWA simples para acompanhar a vida financeira pessoal em um só lugar. Ele foi criado para registrar entradas e gastos, visualizar o saldo do mês, controlar valores guardados e estimar o recebimento da folha com horas extras. Cada pessoa usa seus próprios dados e sua própria conta Google.

O app funciona no navegador e pode ser instalado no celular como aplicativo. Os dados do uso normal ficam no navegador. O código é hospedado no GitHub Pages e os backups podem ser enviados para o Google Drive.

PRINCIPAIS RECURSOS
- Resumo mensal com saldo atual, saldo projetado e contas pendentes.
- Lançamentos de entradas, gastos pagos ou previstos e gastos recorrentes.
- Entradas recorrentes, como quinzena e salário no fim do mês.
- Gastos fixos que se repetem automaticamente.
- Controle de aportes e retiradas, com saldo guardado e gráfico de evolução.
- Simulação de folha com horas extras de 50% e 100%, adicional noturno, DSR, INSS e IRRF.
- Calendário de feriados nacionais, do Amazonas e de Manaus no cálculo do DSR.
- Tema claro e escuro.
- Exportação e importação de backup JSON e exportação de lançamentos CSV.

BACKUP NO GOOGLE DRIVE
O Google Drive é opcional. Cada usuário escolhe a própria conta Google e autoriza somente o seu próprio Drive. O app cria ou localiza automaticamente a pasta configurada nessa conta e salva os backups nela. Usuários não compartilham o Drive, e o autor do app não consegue acessar os dados de outras pessoas.

Para configurar o recurso:
1. No Google Cloud Console, crie ou selecione um projeto.
2. Em Biblioteca, ative a Google Drive API.
3. Em Google Auth Platform, configure a tela de consentimento e adicione os usuários de teste, se o app estiver em modo de testes.
4. Em Clientes, crie um cliente OAuth do tipo Aplicativo da Web.
5. Em Origens JavaScript autorizadas, adicione a origem publicada, por exemplo: https://joeyrickson.github.io
6. Copie o Client ID gerado e informe-o em Dados > Google Drive no app.
7. Salve a configuração e clique em Conectar ao Google Drive.

O Client ID identifica o aplicativo. Ele não é a conta do usuário, não é uma senha e pode aparecer no código público. Cada usuário autoriza a própria conta Google durante a conexão. O app usa o escopo limitado drive.file, não armazena senhas e mantém o token somente na sessão atual.

O backup automático cria snapshots datados e permite manter arquivos por 10, 15 ou 30 dias. O arquivo mais recente pode ser restaurado pelo próprio app.

OUTRAS FORMAS DE BACKUP
- Backup JSON manual: exporta todos os dados para guardar no computador, pendrive, OneDrive, Dropbox ou outro serviço.
- Importação JSON: restaura os dados em outro navegador ou aparelho.
- CSV: útil para abrir lançamentos em planilhas, mas não substitui o backup JSON completo.
- Armazenamento local: o app continua funcionando sem nuvem, mas os dados ficam apenas no navegador daquele aparelho.

Na tela de Dados, o usuário pode escolher o provedor que pretende usar: Google Drive, OneDrive, Dropbox ou iCloud Drive. A tela muda os campos necessários conforme a escolha.

Nesta versão, a conexão automática está funcional para Google Drive. OneDrive, Dropbox e iCloud Drive já aparecem como opções e podem ser configurados para uso manual por JSON, mas o botão de conexão automática ficará disponível quando suas integrações OAuth forem implementadas.

Para conectar outro provedor automaticamente, seria necessário adicionar uma integração específica de OAuth e armazenamento para ele. Isso envolve criar credenciais próprias no serviço escolhido e implementar essa opção no app; não existe uma chave única que conecte todos os drives.

USAR A VERSÃO PUBLICADA
https://joeyrickson.github.io/PWA_CAIXA/

Para usar no celular, abra o endereço em HTTPS. Como o projeto é um PWA, escolha "Adicionar à tela inicial" ou "Instalar aplicativo" para criar um ícone e abrir o Meu Caixa como app. Não é necessário baixar um APK nem publicar na loja.

DESENVOLVIMENTO LOCAL
PWA, service worker e Google OAuth funcionam corretamente quando o app é servido por HTTP/HTTPS. Na pasta do projeto:

python -m http.server 8080

Depois abra http://localhost:8080.
