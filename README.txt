MEU CAIXA — VERSÃO 2.2

NOVIDADES
- Tema claro e escuro (botão no topo e em Dados)
- Aba Guardado: aportes, retiradas, saldo acumulado e gráfico de evolução
- Preserva os dados da versão anterior usando a mesma chave localStorage
- Cópia local anterior automática antes de alterações
- Aba Simulação de folha focada somente no Joey
- Registro de horas extras por data, início/fim, intervalo e feriado
- HE 50% de segunda a sábado e HE 100% aos domingos/feriados marcados
- Cálculo automático de adicional noturno entre 22:00 e 05:00
- DSR estimado sobre HE/adicional noturno
- INSS e IRRF 2026 no simulador
- Referência de julho/2026 para conferir o cálculo com o contracheque
- Botão para lançar o valor final simulado como entrada prevista
- Backup JSON continua disponível
- Integração direta opcional com Google Drive

GOOGLE DRIVE
A conta preferida vem preenchida como joeyoliveira8@gmail.com, mas nenhuma senha fica no app.

Para autorizar um app web a gravar no seu Google Drive, o Google exige um OAuth Client ID próprio. Portanto:
1. Publique o app em HTTPS (Vercel, Netlify, GitHub Pages etc.).
2. No Google Cloud Console, crie/seleciona um projeto.
3. Ative a Google Drive API.
4. Configure a tela de consentimento OAuth.
5. Crie um OAuth Client ID do tipo "Web application".
6. Adicione o endereço publicado do Meu Caixa em "Authorized JavaScript origins".
7. Copie o Client ID e cole em Dados > Google Drive dentro do app.
8. Clique em Conectar ao Google Drive e autorize a conta.

O app usa o escopo drive.file, que permite trabalhar somente com arquivos criados/abertos pelo próprio app, em vez de pedir acesso amplo ao Drive inteiro.
O arquivo é salvo como "meu-caixa-backup.json" dentro da pasta configurada (padrão: "Meu Caixa - Backups").

IMPORTANTE
- O OAuth Client ID não é senha nem segredo; pode ficar salvo no navegador.
- O token de acesso do Google fica apenas na sessão atual e não é escrito no backup.
- Ao reabrir o app, pode ser necessário clicar em Conectar novamente.
- O backup automático funciona enquanto a sessão do Drive estiver conectada.

SIMULAÇÃO DA FOLHA
Parâmetros padrão:
- Salário base: R$ 5.000,00
- Carga mensal: 220 h
- Adiantamento: R$ 2.000,00
- Adicional noturno: 20%

O botão "Referência jul/26" carrega os totais do contracheque de julho/2026 para validar a conta:
- HE 50%: 39,14 h
- HE 100%: 3 h
- Adicional noturno: 7 h

O cálculo é uma simulação e não substitui o fechamento oficial da empresa.

COMO TESTAR NO PC
Para o app em si, você pode abrir index.html diretamente. Porém PWA, service worker e Google OAuth funcionam corretamente quando o app está servido por HTTP/HTTPS.

Exemplo local simples, dentro da pasta do app:
python -m http.server 8080
Depois abra http://localhost:8080

COMO INSTALAR NO CELULAR
Publique a pasta em HTTPS, abra o endereço no celular e escolha "Adicionar à tela inicial" / "Instalar aplicativo".


CORREÇÃO V2.3
- Corrigido filtro mensal que fazia lançamentos salvos não aparecerem no painel.
- Os dados que já foram salvos no navegador continuam preservados e passam a ser exibidos normalmente.
