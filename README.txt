SALDOPLAN — CONTROLE FINANCEIRO PESSOAL
Versão 2.5
Desenvolvido por Joey Rickson.

O SaldoPlan é um PWA para acompanhar a vida financeira pessoal em um só lugar. Ele foi criado para registrar entradas e gastos, visualizar o saldo do mês, controlar valores guardados e estimar o recebimento da folha com horas extras. Cada pessoa usa seus próprios dados e sua própria conta de armazenamento em nuvem.

O app funciona no navegador e pode ser instalado no celular ou computador como aplicativo. Os dados do uso normal ficam no navegador. O código é hospedado no GitHub Pages e os backups podem ser enviados para o Google Drive.

PRINCIPAIS RECURSOS
- Resumo mensal com saldo atual, saldo projetado e contas pendentes.
- Lançamentos de entradas, gastos pagos ou previstos e gastos recorrentes.
- Entradas recorrentes, como quinzena e salário no fim do mês.
- Gastos fixos que se repetem automaticamente.
- Controle de aportes e retiradas, com saldo guardado e gráfico de evolução.
- Simulação de folha com horas extras de 50% e 100%, adicional noturno, DSR, INSS e IRRF.
- Calendário de feriados nacionais, do Amazonas e de Manaus no cálculo do DSR.
- Tema claro e escuro.
- Exportação e importação de backup JSON.
- Exportação completa dos dados em CSV.
- Relatório financeiro em PDF.

BACKUP NO GOOGLE DRIVE
O Google Drive é opcional. Cada usuário escolhe a própria conta Google e autoriza somente o seu próprio Drive. O SaldoPlan cria ou localiza automaticamente a pasta configurada nessa conta e salva os backups nela.

Pasta padrão:
SaldoPlan - Backups

Para configurar:
1. No Google Cloud Console, crie ou selecione um projeto.
2. Ative a Google Drive API.
3. Configure a tela de consentimento OAuth.
4. Crie um cliente OAuth do tipo Aplicativo da Web.
5. Em Origens JavaScript autorizadas, adicione: https://joeyrickson.github.io
6. Informe o Client ID em Dados > Google Drive.
7. Salve e clique em Conectar ao Google Drive.

O app usa o escopo limitado drive.file, não armazena senhas e mantém o token somente na sessão atual.

COMPATIBILIDADE COM A VERSÃO ANTERIOR
A identidade visual mudou de Meu Caixa para SaldoPlan, mas as chaves internas de armazenamento local foram mantidas para preservar os dados já existentes no navegador. Backups antigos com o prefixo meu-caixa-backup continuam aceitos durante a migração.

USAR A VERSÃO PUBLICADA
https://joeyrickson.github.io/PWA_CAIXA/

Para usar no celular, abra o endereço em HTTPS e escolha “Adicionar à tela inicial” ou “Instalar aplicativo”.

DESENVOLVIMENTO LOCAL
Na pasta do projeto:

python -m http.server 8080

Depois abra:
http://localhost:8080
