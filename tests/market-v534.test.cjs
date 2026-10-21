'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const news=require('../api/news.js');
const helper=news._test;
let passed=0;
function check(name,fn){fn();passed++;console.log('PASS',name)}
check('Fonte da Agência Brasil Economia está registrada',()=>{
 const names=helper.sources(helper.monthBounds('2026-10',new Date('2026-10-21T16:00:00Z')));
 assert.equal(names.find(x=>x.name==='Agência Brasil · Economia')?.url,'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml');
});
check('Limpa entidades de HTML duplamente escapadas',()=>{
 assert.equal(helper.strip('Mercado &amp;nbsp; &amp;nbsp; sobe &amp;amp; cai'),'Mercado sobe & cai');
});
check('Imagens externas sem HTTPS e SVG não passam pelo filtro',()=>{
 assert.equal(helper.safeImageUrl('http://img.test/a.jpg'),'');
 assert.equal(helper.safeImageUrl('https://img.test/a.svg'),'');
});
check('Prévia não abre links de agregadores, domínios desconhecidos ou URL com credenciais',()=>{
 assert.equal(helper.previewHost('https://news.google.com/rss/articles/ABC'),'');
 assert.equal(helper.previewHost('https://www.gov.br.evil.example/foo'),'');
 assert.equal(helper.previewHost('https://user:secret@www.gov.br/article'),'');
 assert.ok(helper.previewHost('https://agenciabrasil.ebc.com.br/economia/noticia/2026-10/foo'));
});
const xml=`<rss><channel><item><title>Mercado financeiro e inflação</title>
 <link>https://agenciabrasil.ebc.com.br/economia/noticia/2026-10/mercado</link>
 <pubDate>Wed, 21 Oct 2026 13:00:00 GMT</pubDate>
 <description><![CDATA[<p>Juros &amp;nbsp; no Brasil</p>]]></description>
 <media:thumbnail url="https://imagens.ebc.com.br/mercado.jpg" />
 </item><item><title>Outra notícia</title><link>https://news.google.com/rss/articles/ABC</link>
 <pubDate>Wed, 21 Oct 2026 11:00:00 GMT</pubDate>
 <description>&lt;a href=&quot;https://news.google.com/rss/articles/ABC&quot;&gt;Mais&lt;/a&gt;</description>
 </item></channel></rss>`;
const items=helper.extract(xml,'Agência Brasil · Economia','2026-10',new Date('2026-10-21T17:00:00Z'));
check('Captura a fotografia real em media:thumbnail',()=>{assert.equal(items[0].imageUrl,'https://imagens.ebc.com.br/mercado.jpg');assert.match(items[0].summary,/Juros no Brasil/)});
check('Open Graph aceita imagem oficial e ignora links sem https',()=>{
 const doc='<meta name="foo" content="a"><meta property="og:image" content="/files/financeira.jpg"><meta property="og:image" content="http://inseguro.test/a.jpg">';
 assert.equal(helper.ogImage(doc,'https://agenciabrasil.ebc.com.br/economia/noticia/1'),'https://agenciabrasil.ebc.com.br/files/financeira.jpg');
});
check('Open Graph ignora SVG e meta inválida',()=>assert.equal(helper.ogImage('<meta property="og:image" content="/arte.svg">','https://www.gov.br/noticias'),''));
function res(){return {headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(j){this.body=j;return this}}}
(async()=>{
 const origFetch=global.fetch;
 try{
  let fetches=0;
  global.fetch=async(u)=>{
   fetches++;
   if(String(u).includes('/rss/economia/feed.xml'))return {ok:true,text:async()=>xml};
   if(String(u).startsWith('https://agenciabrasil.ebc.com.br/economia/noticia'))return {ok:true,headers:{get:()=> 'text/html'},text:async()=>'<meta property="og:image" content="https://imagens.ebc.com.br/capa2.jpg">'};
   return {ok:true,text:async()=>'<rss></rss>'};
  };
  const answer=res();await news({query:{month:'2026-10'}},answer);
  check('Notícia com imagem RSS aparece na API',()=>{assert.equal(answer.code,200);assert.equal(answer.body.items[0].imageUrl,'https://imagens.ebc.com.br/mercado.jpg');assert.ok(fetches>=5)});
  const previews=[...Array(9)].map((_,i)=>({url:`https://agenciabrasil.ebc.com.br/economia/noticia/2026-10/${i}`,imageUrl:'',title:'title '+i}));
  const before=fetches;const results=await helper.enrichImages(previews);
  check('Prévias HTML limitadas a quatro por consulta',()=>{assert.equal(fetches-before,4);assert.equal(results.slice(0,4).every(x=>x.imageUrl==='https://imagens.ebc.com.br/capa2.jpg'),true);assert.equal(results[4].imageUrl,'')});
 }finally{global.fetch=origFetch}
 const sandbox={module:{exports:{}},document:{addEventListener(){},getElementById(){return null}},localStorage:{getItem:()=>null,setItem(){}},setInterval(){},Intl,Date,Math,Array,Number,JSON,URL,fetch:async()=>null,AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/market.js'),'utf8'),sandbox);
 check('Cartão sem foto mantém link e marcação compacta',()=>{
  const card=sandbox.module.exports.marketNewsCard({...items[1],source:'Google Notícias',imageUrl:''});
  assert.match(card,/without-photo/);assert.match(card,/Imagem não fornecida pela fonte/);assert.match(card,/Ler notícia original/);
 });
 check('Cartão com foto mantém endereço da notícia original',()=>{
  const card=sandbox.module.exports.marketNewsCard(items[0]);assert.match(card,/class="market-news-photo"/);assert.match(card,/imagens.ebc.com.br\/mercado.jpg/);
 });
 check('Cache mensal atualizado para evitar resultado antigo sem imagens',()=>assert.match(fs.readFileSync(path.join(__dirname,'../js/market.js'),'utf8'),/news\.v534\.month/));
 console.log('Notícias v5.3.4:',passed,'testes PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
