# SaldoPlan v5.3.3 — Central de notícias e calendário

## Resumo

Atualização incremental sobre a v5.3.2 homologada, restrita à área Mercado. Não modifica o motor financeiro, regras de recorrência, autenticação, Firebase, Live Sync ou armazenamento de dados financeiros.

## Interface

- Calendário mensal acessível com navegação de até **24 meses para trás**, a contar do mês atual; dias com resultados são marcados com um ponto.
- Clique em um dia para filtrar. **Mês inteiro** desfaz o filtro; **Mês atual** retorna ao mês vigente.
- Busca local entre as notícias carregadas por título, resumo e fonte; filtro por assunto; paginação simples com **Mostrar mais**.
- Cartões com data, hora, origem, tema, trecho fornecido no RSS e link externo para a notícia original (HTTPS em nova aba).
- Fotografias apenas quando o feed fornece imagem por `media:content`, `media:thumbnail`, `enclosure` de imagem ou `<img>` em sua descrição. Quando não há foto ou há falha ao carregar, exibe um placeholder neutro. Não há geração de imagens nem scraping das páginas dos veículos.
- Design responsivo que preserva temas claro/escuro, sem dependências adicionais.

## API `/api/news?month=AAAA-MM`

- O parâmetro `month` é opcional. Sem ele, retorna o mês atual na zona `America/Sao_Paulo`.
- Valida o mês e aceita do mês atual até 23 meses anteriores; datas futuras ou fora da faixa retornam HTTP 400.
- Consulta cinco feeds públicos em paralelo (Banco Central, Focus, CVM e duas buscas temáticas do Google Notícias). As buscas temáticas incluem `after:` e `before:`; são filtradas novamente pela data de publicação realmente presente no RSS.
- Resposta: `generatedAt`, `month`, `items[]`, `sourceStatus[]`, `partial`, `archiveComplete: false`, `coverage` e `error`.
- Cada item inclui `title`, `url`, `source`, `category`, `publishedAt`, `day` no horário do Brasil, `summary` e `imageUrl` quando encontrada.
- Deduplica títulos normalizados, dá preferência à cópia com foto ou resumo e retorna no máximo 90 notícias por mês. Dados inválidos/futuros e URLs não HTTPS são descartados.
- Timeout controlado de 6,5 segundos por fonte; falha de uma fonte não impede as outras. HTTP 503 quando nenhuma fonte responde. A fonte pode responder sem publicações do mês; nesse caso retorna lista vazia, e não inventa conteúdo.
- Cache público Vercel: 10 minutos no mês atual, 1 hora nos meses anteriores (somente metadados públicos). Respostas de erro não são cacheadas.

## Histórico e limitações

**O calendário não é um arquivo jornalístico completo.** Feeds RSS são rotativos e o Google Notícias pode não recuperar publicações antigas ou retornar poucos itens. A seleção de um dia mostra *apenas publicações encontradas*. A ausência de pontos não comprova que não houve notícias na data. As imagens também dependem dos feeds; muitas fontes não as incluem.

O browser mantém cache local por mês na área pública `saldoplan.market.v531.news.month.AAAA-MM`, com TTL de 15 minutos para o mês vigente e 12 horas para meses anteriores. Caso a fonte fique indisponível, a última consulta local é apresentada com aviso. **Não se cria banco permanente de notícias**, não se sincroniza o cache público com o Live Sync e não se obtém conteúdo integral sujeito a direitos autorais.

## Teste local

```powershell
cd "C:\Users\jrickson\Documents\projetos\PWA_CAIXA"
npm.cmd test
npx.cmd vercel dev --listen 3000
```

No navegador, acessar `http://localhost:3000`, abrir Mercado e testar os meses e os dias.

APIs para inspeção em outro terminal:

```powershell
curl.exe -i "http://localhost:3000/api/news?month=2026-10"
curl.exe -i "http://localhost:3000/api/news?month=2026-09"
curl.exe -i "http://localhost:3000/api/market"
```

`http-server` não executa `api/news` nem outras funções serverless. Para estas rotas, utilizar o `vercel dev` ou Preview. O teste automatizado usa feeds simulados; **a disponibilidade e a quantidade de notícias reais devem ser verificadas na homologação local**.

## Segurança

- Validação de URLs HTTPS e escape HTML antes da renderização; imagens com `loading="lazy"` e `referrerpolicy="no-referrer"`.
- Imagens solicitadas diretamente a sites externos podem revelar a eles o endereço IP de quem acessa. Não carregar dados privados ou tokens nas URLs externas.
- Sem chaves, variáveis privadas ou serviços pagos. `.env.local`, `.vercel`, `node_modules` e backups não integram o patch.
- O Service Worker continua ignorando `/api/*`.
