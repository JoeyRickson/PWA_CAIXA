# Mercado v5.3.4 — Fotos reais e cartões de notícias

- **Causa:** o RSS de busca do Google Notícias contém manchetes e links, mas geralmente não fornece `media:content`, `enclosure` ou outra foto. Não é uma falha de renderização quando a imagem está ausente no dado de origem.
- **Nova fonte:** `https://agenciabrasil.ebc.com.br/rss/economia/feed.xml`, que fornece links diretos e pode incluir imagens da matéria.
- **Extração:** prioridade para metadados RSS e imagens incluídas no próprio feed; até quatro páginas diretas confiáveis sem foto podem ser consultadas para a meta tag `og:image`, sem seguir redirecionamentos. Domínios autorizados: `agenciabrasil.ebc.com.br`, `www.bcb.gov.br`, `www.gov.br`.
- **Limitações:** sites podem bloquear o carregamento da imagem; certas notícias do Google Notícias permanecerão sem fotos. Nunca são usadas imagens inventadas ou não relacionadas à manchete. O histórico dos feeds não é exaustivo.
- **Interface:** a ausência ou falha da imagem usa um placeholder pequeno, com o texto informativo. Resumos de agregadores sem conteúdo real deixam de ser simulados.
- **Segurança:** apenas URL HTTPS sem credenciais; limite de quatro prévias por consulta, timeout de 3 s, leitura parcial da página, sem redirects e sem alterar armazenamento financeiro, Firebase ou Live Sync.
- **Teste local:** `npm.cmd test` e `npx.cmd vercel dev --listen 3000`. Consulte `/api/news?month=2026-10` para verificar quais itens possuem `imageUrl`. Use Ctrl+Shift+R na PWA se preciso, sem apagar storage.
