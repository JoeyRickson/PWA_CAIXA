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
Na aba Dados, informe o Client ID OAuth, salve a configuração e conecte a sua própria conta Google. O app cria ou localiza automaticamente a pasta configurada dentro do Drive dessa conta e salva o arquivo de backup nela. Usuários não compartilham o Drive entre si, e o autor do app não consegue acessar os dados de outras pessoas.

Também é possível ativar o backup automático e escolher uma retenção de 10, 15 ou 30 dias. Backups automáticos antigos são removidos conforme o prazo escolhido.

O app usa o escopo limitado drive.file. O Client ID pode aparecer no código público, mas senhas e tokens não são armazenados no projeto nem no backup.

USAR A VERSÃO PUBLICADA
https://joeyrickson.github.io/PWA_CAIXA/

Para usar no celular, abra o endereço em HTTPS. Como o projeto é um PWA, escolha "Adicionar à tela inicial" ou "Instalar aplicativo" para criar um ícone e abrir o Meu Caixa como app. Não é necessário baixar um APK nem publicar na loja.

DESENVOLVIMENTO LOCAL
PWA, service worker e Google OAuth funcionam corretamente quando o app é servido por HTTP/HTTPS. Na pasta do projeto:

python -m http.server 8080

Depois abra http://localhost:8080.
