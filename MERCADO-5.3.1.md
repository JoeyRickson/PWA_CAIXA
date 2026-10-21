# Mercado reformulado — SaldoPlan v5.3.1

## O que mudou

- Painel reformulado e responsivo, com fontes e datas de referência explícitas.
- Indicadores Selic anualizada (BCB/SGS 1178), dólar venda (SGS 1) e IPCA mensal (SGS 433, acumulado composto de **12 meses completos**).
- Gráfico SVG próprio sem dependência de biblioteca externa, filtro por indicador e janela de 30/90 dias ou histórico disponível, pontos com títulos e datas ordenadas.
- Notícias, Tesouro e indicadores carregam **separadamente**. Falha de um feed não derruba as outras informações.
- Valores `null`, erros HTTP e respostas vazias não são exibidos como taxa zero. Estado com cache antigo é identificado como tal.
- Tesouro: consulta o catálogo CKAN oficial e seu CSV de taxas; não usa o antigo endpoint `treasurybondsinfo.json` (410).
- Simulador de comparação preservado com aviso de que é estimativa bruta e Selic não é equivalente exato ao CDI.
- Nenhum dado bancário, financeiro ou perfil do usuário é transmitido a APIs externas pela aba Mercado.

## Limitações e fontes

**Fontes oficiais:**

- https://dadosabertos.bcb.gov.br/ (SGS)
- https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto
- Feeds públicos de Banco Central, CVM e Google Notícias para links editoriais.

As bases externas podem estar indisponíveis, mudar formato, impor limites de rede ou demorar. O CSV do Tesouro é grande e pode exceder o limite de tempo de execução da Vercel; nessa situação a seção indicará indisponibilidade e oferecerá o site oficial. A lista de títulos representa a data de referência do CSV, não um book de negociação instantâneo.

A API de indicadores devolve `status` por fonte e HTTP 503 quando todas falham. A API de notícias devolve `sourceStatus` por feed. Nenhuma cotação sintética é gerada para preencher falhas.

**Sem validação de rede ao vivo nesta entrega:** execute a Preview da Vercel e confira os endpoints `/api/market`, `/api/news`, `/api/treasury` e a aba Mercado. Os testes locais usam respostas simuladas e verificam parser, cálculos, gráfico, falhas parciais e erro total.

## Passo a passo de homologação

1. Faça um backup JSON do SaldoPlan, mesmo que a atualização não modifique dados financeiros.
2. Instale o patch sobre a **v5.3.0**. Execute `npm.cmd test`, `npm.cmd audit --omit=dev` e `git diff --check`.
3. Rode `npx.cmd vercel dev` ou publique uma Preview com `npx.cmd vercel deploy`; um servidor estático sozinho **não executa** os endpoints `/api/*`.
4. Confira indicadores, datas, gráfico nos 3 indicadores e períodos, simulação, Tesouro e notícias em desktop/mobile.
5. Simule erro desligando a internet e veja a mensagem de dados salvos. Restabeleça a rede e atualize.
6. Antes do commit, valide login Google, Live Sync, FGTS, folha e Planejamento.

## Implantação

O patch atualiza `app.js`, `index.html`, `sw.js`, `views/market.html`, `js/market.js`, `css/market.css`, `api/market.js`, `api/news.js`, `api/treasury.js`, `package.json` e `package-lock.json`, inclui os testes e registra a versão. O instalador gera backup e confere SHA-256. Não modifica localStorage, Firebase, Live Sync, nem suas credenciais.
