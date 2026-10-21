# Mercado v5.3.2 — recuperação de indicadores, históricos e títulos

**Base exigida:** código local v5.3.1 coletado em 21/10/2026, e não a branch pública v5.2.1. O instalador valida SHA-256 de cada arquivo de origem antes de copiar qualquer coisa.

## Causa confirmada

A versão anterior fazia requisições `/dados/ultimos/90` para as séries 1178 e 1, e `/dados/ultimos/25` para a série 433. A API SGS retornou HTTP 400 informando **limite máximo de 20 valores**. Os indicadores ficaram nulos e o gráfico sem séries, embora chamadas diretas com 5/13 registros tenham retornado HTTP 200.

## Correção

- `api/market.js`: usa primariamente `/dados?formato=json&dataInicial=DD/MM/AAAA&dataFinal=DD/MM/AAAA` em janelas de aproximadamente 410 dias (Selic e dólar) e 610 dias (IPCA), todas inferiores a 10 anos. Se a consulta histórica falhar, faz uma única tentativa por série usando `/dados/ultimos/20?formato=json`. Nunca solicita mais de 20 últimos registros.
- Valida datas reais, formatos numéricos e ausência de valor. Mantém uma cópia em memória por indicador; durante falha, usa o último retorno válido com `status.*.stale=true`, quando disponível. A cópia em memória não sobrevive a reinício/cold start da função Vercel.
- Frequência: séries 1178 e 1 diárias; SGS 433 mensal. IPCA em 12 meses é composto de 12 competências; não preenche meses/dias ausentes com valores inventados.
- `js/market.js`: identifica status parcial; notícias e indicadores são renderizados independentemente; erro de rede não mantém o gráfico preso em "Preparando gráfico". Filtros de indicador continuam respondendo sem dados. Os pontos SVG usam coordenadas baseadas nas datas reais. 7/30/90/365 dias/histórico para dados diários; opções curtas desabilitadas no IPCA mensal.
- `api/treasury.js`: antes, limitava a lista após ordenar alfabeticamente (32 primeiros), ocultando alguns títulos Selic/Prefixado/Renda+. Agora preserva até 120 títulos da última referência, remove duplicados e dá prioridade às categorias. Frontend mostra 12 inicialmente, com filtro e "Mostrar mais". Valores exibidos são divulgados pela fonte, não cotações negociáveis.
- `api/news.js`: notícias sem data ou de referência fora dos 45 dias recentes não são apresentadas como novas. Se nenhum feed retornar itens válidos, responde erro explícito sem cache HTTP de falha.
- `sw.js`: chave nova de cache estático; `/api/*` continua excluído do cache do Service Worker. **Não há limpeza de storage nem migração de perfis.**

## Contratos HTTP e cache

`GET /api/market` retorna `indicators`, `history`, `status`, `partial`, `generatedAt` e `error`. `history` é ordenado por data ascendente, com objetos `{date:'YYYY-MM-DD', value:number}`. `status.{selic,dollar,ipca}` expõe `ok`, `stale`, `observations`, `source`, `period`, `mode` e mensagem. `mode='intervalo'` é histórico maior; `mode='últimas 20 observações'` indica fallback. `503` ocorre apenas se não houver dado atual **nem em memória** para qualquer fonte. Erros não são cacheados (`no-store`). Respostas úteis recebem cache compartilhado de 5 min; TTL em memória Selic/Dólar 20 min, IPCA 12 h.

`GET /api/treasury` mantém contrato de v5.3.1 (`referenceDate`, `items`, `source`, `generatedAt`, `stale`). Cache no servidor por 6 h; 503 quando não é possível consultar e não há cópia válida em memória. Cache de navegador mantém a última consulta identificada como salva (não como preço atual).

`GET /api/news` mantém `items`, `sourceStatus`, `generatedAt` e `error`, cache compartilhado 10 min, erro sem cache; cada fonte é independente. O frontend usa cache próprio por 15 min para notícias e 5 min para indicadores. `Atualizar dados` força nova consulta no frontend; o cache da função Vercel ou do próprio SGS pode retornar informação recente já armazenada, e isso não altera a data oficial do indicador.

## Limitações e verificações ao homologar

- A consulta **direta** ao SGS com 5/13 observações e os retornos HTTP 400 com 90/31 estão comprovados pelos testes do usuário. A nova consulta **por datas** e a publicação Vercel ainda precisam ser validadas na máquina do usuário com `vercel dev` ou Preview real. Os testes Node utilizam *mocks*, sem alegar validação de API ao vivo.
- A fonte de Tesouro usa CSV de dados públicos e catálogo CKAN; ela pode estar indisponível ou desatualizada. A própria data de referência deve ser conferida.
- Notícias dependem de feeds externos e podem aparecer em menor quantidade após o filtro de datas. Isso é preferível a apresentar matérias sem data como recentes.
- O comparador permanece **estimativa bruta educativa**; não inclui IR, IOF, custos, taxa de custódia ou tributação específica de cada produto. Selic não equivale automaticamente ao CDI.
- A rota `support-admin` com HTTP 503 é independente da reforma do Mercado. Investigar separadamente variáveis e credenciais do backend, sem anexar `.env.local`.
- Testar telas responsivas e temas no navegador Android e desktop. Os testes locais em Node não substituem teste visual real.

## Ambiente local

```powershell
cd "C:\Users\jrickson\Documents\projetos\PWA_CAIXA"
npm.cmd ci
npx.cmd vercel link
npx.cmd vercel pull --environment=development
npx.cmd vercel env pull .env.local --environment=development
npx.cmd vercel dev --listen 3000
```

O `http-server` não executa `api/*.js`; para APIs serverless utilize Vercel Dev ou Preview. `.vercel/`, `.env.local`, `node_modules` e dados financeiros **não devem entrar no ZIP nem no commit**.

## Testes sugeridos

```powershell
npm.cmd test
node --check .\api\market.js
node --check .\js\market.js
curl.exe -i http://localhost:3000/api/market
curl.exe -i http://localhost:3000/api/news
curl.exe -i http://localhost:3000/api/treasury
```

Validar no navegador: trocar Selic/Dólar/IPCA, alterar períodos, retornar à aba, atualizar manualmente, simular ausência de rede, filtrar Tesouro Selic e IPCA, conferir fontes/notícias e verificar cache sem limpeza de dados. Só publicar após homologação e autorização para commit/push.
