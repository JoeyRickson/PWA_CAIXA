// Importação de extratos PDF/OFX/QFX/CSV e categorização inteligente
const IMPORT_DEFAULT_CATEGORIES=[
  'Moradia','Internet','Telefone','Educação','Cartão','Alimentação',
  'Mercado','Transporte','Saúde','Lazer','Assinaturas','Outros'
];

let importDraft={
  fileName:'',
  format:'',
  source:'',
  rawText:'',
  headers:[],
  rawRows:[],
  delimiter:'',
  mapping:{date:-1,description:-1,amount:-1,debit:-1,credit:-1,type:-1,id:-1,category:-1},
  rows:[]
};

function importNormalizeText(value=''){
  return String(value??'')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toUpperCase()
    .replace(/&/g,' E ')
    .replace(/[^A-Z0-9]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function importNormalizeHeader(value=''){
  return importNormalizeText(value).toLowerCase();
}

function importSignedMoney(value){
  const raw=String(value??'').trim();
  if(!raw)return 0;
  const negative=/^\s*\(.*\)\s*$/.test(raw)||/(?:^|R\$\s*)-\s*[\d.]+(?:,\d{2})?/i.test(raw);
  const parsed=Math.abs(money(raw.replace(/[()]/g,'')));
  return negative?-parsed:parsed;
}

function importParseDate(value=''){
  const raw=String(value??'').trim();
  if(!raw)return '';

  const iso=raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if(iso){
    const y=Number(iso[1]),m=Number(iso[2]),d=Number(iso[3]);
    return importValidDate(y,m,d);
  }

  const br=raw.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if(br){
    let y=Number(br[3]);
    if(y<100)y+=y>=70?1900:2000;
    return importValidDate(y,Number(br[2]),Number(br[1]));
  }

  const compact=raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if(compact){
    return importValidDate(Number(compact[1]),Number(compact[2]),Number(compact[3]));
  }

  const parsed=new Date(raw);
  if(!Number.isNaN(parsed.getTime())){
    return `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}`;
  }

  return '';
}

function importValidDate(year,month,day){
  if(!year||month<1||month>12||day<1||day>31)return '';
  const date=new Date(year,month-1,day);
  if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return '';
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function importCsvParse(text,delimiter){
  const rows=[];
  let row=[],cell='',quoted=false;

  for(let i=0;i<text.length;i++){
    const char=text[i];

    if(quoted){
      if(char==='"'&&text[i+1]==='"'){
        cell+='"';
        i++;
      }else if(char==='"'){
        quoted=false;
      }else{
        cell+=char;
      }
      continue;
    }

    if(char==='"'){
      quoted=true;
    }else if(char===delimiter){
      row.push(cell);
      cell='';
    }else if(char==='\r'){
      if(text[i+1]==='\n')i++;
      row.push(cell);
      if(row.some(value=>String(value).trim()!==''))rows.push(row);
      row=[];
      cell='';
    }else if(char==='\n'){
      row.push(cell);
      if(row.some(value=>String(value).trim()!==''))rows.push(row);
      row=[];
      cell='';
    }else{
      cell+=char;
    }
  }

  row.push(cell);
  if(row.some(value=>String(value).trim()!==''))rows.push(row);

  return rows;
}

function importDetectDelimiter(text){
  const cleanCandidates=[';',',','\t','|'];
  let best={delimiter:';',score:-Infinity};

  cleanCandidates.forEach(delimiter=>{
    const rows=importCsvParse(text,delimiter).slice(0,12);
    if(!rows.length)return;

    const widths=rows.map(row=>row.length);
    const headerWidth=widths[0]||0;
    const consistent=widths.filter(width=>width===headerWidth).length;
    const score=(headerWidth>1?100:0)+(headerWidth*4)+consistent;

    if(score>best.score)best={delimiter,score};
  });

  return best.delimiter;
}

const IMPORT_HEADER_ALIASES={
  date:[
    'data','date','data lancamento','data do lancamento','data movimento','data da transacao',
    'transaction date','posted date','dtposted','data operacao','data compra'
  ],
  description:[
    'descricao','description','historico','history','memo','name','estabelecimento','detalhe',
    'detalhes','transaction','lancamento','descricao lancamento','favorecido'
  ],
  amount:[
    'valor','amount','valor lancamento','valor da transacao','transaction amount','montante','total'
  ],
  debit:[
    'debito','debit','saida','valor debito','debitos','withdrawal'
  ],
  credit:[
    'credito','credit','entrada','valor credito','creditos','deposit'
  ],
  type:[
    'tipo','type','natureza','nature','debito credito','d c','tipo lancamento'
  ],
  id:[
    'id','fitid','documento','numero documento','n documento','identificador','transaction id'
  ],
  category:[
    'categoria','category'
  ]
};

function importFindColumn(headers,key){
  const aliases=IMPORT_HEADER_ALIASES[key]||[];
  const normalized=headers.map(importNormalizeHeader);

  for(const alias of aliases){
    const exact=normalized.findIndex(header=>header===alias);
    if(exact>=0)return exact;
  }

  for(const alias of aliases){
    const partial=normalized.findIndex(header=>header.includes(alias)||alias.includes(header));
    if(partial>=0)return partial;
  }

  return -1;
}

function importSelectOptions(select,headers,value,allowEmpty=true){
  if(!select)return;
  select.innerHTML=[
    ...(allowEmpty
      ?['<option value="-1">Não usar</option>']
      :['<option value="-1">Selecione...</option>']),
    ...headers.map((header,index)=>`<option value="${index}">${escapeHtml(header||`Coluna ${index+1}`)}</option>`)
  ].join('');
  select.value=String(value>=0?value:-1);
}

function importPopulateMapping(){
  const mapping=importDraft.mapping;
  const headers=importDraft.headers;

  importSelectOptions(document.querySelector('#importDateColumn'),headers,mapping.date,false);
  importSelectOptions(document.querySelector('#importDescriptionColumn'),headers,mapping.description,false);
  importSelectOptions(document.querySelector('#importAmountColumn'),headers,mapping.amount,true);
  importSelectOptions(document.querySelector('#importDebitColumn'),headers,mapping.debit,true);
  importSelectOptions(document.querySelector('#importCreditColumn'),headers,mapping.credit,true);
  importSelectOptions(document.querySelector('#importTypeColumn'),headers,mapping.type,true);

  const badge=document.querySelector('#csvDelimiterBadge');
  if(badge){
    badge.textContent=importDraft.delimiter==='\t'
      ?'TAB'
      :`Separador: ${importDraft.delimiter}`;
  }

  const positive=document.querySelector('#importPositiveKind');
  if(positive){
    positive.value=state.importSettings?.positiveValueKind==='income'?'income':'expense';
  }
}

function importReadMapping(){
  const numberValue=id=>Number(document.querySelector(id)?.value??-1);

  importDraft.mapping={
    ...importDraft.mapping,
    date:numberValue('#importDateColumn'),
    description:numberValue('#importDescriptionColumn'),
    amount:numberValue('#importAmountColumn'),
    debit:numberValue('#importDebitColumn'),
    credit:numberValue('#importCreditColumn'),
    type:numberValue('#importTypeColumn')
  };

  state.importSettings={
    ...state.importSettings,
    positiveValueKind:document.querySelector('#importPositiveKind')?.value==='income'?'income':'expense'
  };
}

function importKindFromType(value=''){
  const type=importNormalizeText(value);

  if(!type)return '';
  if(/(^| )(DEBITO|DEBIT|SAIDA|PAGAMENTO|COMPRA|D)( |$)/.test(type))return 'expense';
  if(/(^| )(CREDITO|CREDIT|ENTRADA|RECEBIMENTO|DEPOSITO|C)( |$)/.test(type))return 'income';

  return '';
}

function importCsvHeaderScore(row){
  const headers=(row||[]).map(importNormalizeHeader);
  const hasAlias=key=>(IMPORT_HEADER_ALIASES[key]||[]).some(alias=>
    headers.some(header=>header===alias||header.includes(alias))
  );

  let score=0;
  if(hasAlias('date'))score+=4;
  if(hasAlias('description'))score+=4;
  if(hasAlias('amount'))score+=3;
  if(hasAlias('debit'))score+=2;
  if(hasAlias('credit'))score+=2;
  if(hasAlias('type'))score+=1;
  return score;
}

function importBuildCsvRows(){
  importReadMapping();

  const {date,description,amount,debit,credit,type,id,category}=importDraft.mapping;
  const positiveDefault=state.importSettings?.positiveValueKind==='income'?'income':'expense';

  if(date<0||description<0){
    throw new Error('Selecione as colunas de Data e Descrição.');
  }

  if(amount<0&&debit<0&&credit<0){
    throw new Error('Selecione uma coluna de Valor ou as colunas de Débito/Crédito.');
  }

  const rows=[];

  importDraft.rawRows.forEach((raw,index)=>{
    const parsedDate=importParseDate(raw[date]);
    const parsedDescription=String(raw[description]??'').trim();

    if(!parsedDate||!parsedDescription)return;

    let kind='';
    let signedAmount=0;

    if(debit>=0||credit>=0){
      const debitValue=debit>=0?Math.abs(importSignedMoney(raw[debit])):0;
      const creditValue=credit>=0?Math.abs(importSignedMoney(raw[credit])):0;

      if(debitValue>0&&!creditValue){
        kind='expense';
        signedAmount=-debitValue;
      }else if(creditValue>0&&!debitValue){
        kind='income';
        signedAmount=creditValue;
      }else if(creditValue||debitValue){
        signedAmount=creditValue-debitValue;
        kind=signedAmount<0?'expense':'income';
      }
    }else{
      signedAmount=importSignedMoney(raw[amount]);

      const typed=type>=0?importKindFromType(raw[type]):'';
      kind=typed||(signedAmount<0?'expense':positiveDefault);
    }

    const absolute=Math.abs(Number(signedAmount||0));
    if(!absolute)return;

    rows.push({
      draftId:`csv-${index}-${uid()}`,
      date:parsedDate,
      description:parsedDescription,
      amount:round2(absolute),
      kind,
      externalId:id>=0?String(raw[id]??'').trim():'',
      importedCategory:category>=0?String(raw[category]??'').trim():'',
      rawIndex:index
    });
  });

  importDraft.rows=rows;
  importPrepareRows();
}

function importOfxField(block,name){
  const regex=new RegExp(`<${name}>\\s*([^<\\r\\n]+)`,'i');
  const match=String(block||'').match(regex);
  return match?match[1].trim():'';
}

function importParseOfx(text){
  const blocks=[];
  const regex=/<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>))/gi;
  let match;

  while((match=regex.exec(text))){
    blocks.push(match[1]);
  }

  const accountId=importOfxField(text,'ACCTID');
  const bankId=importOfxField(text,'BANKID');
  const source=[bankId,accountId].filter(Boolean).join(' · ');

  if(!importDraft.source||importDraft.source===importDraft.fileName){
    importDraft.source=source||importDraft.fileName;

    const account=document.querySelector('#importAccountName');
    if(account&&!account.value.trim()&&source){
      account.value=source;
    }
  }

  importDraft.rows=blocks.map((block,index)=>{
    const rawAmount=Number(importOfxField(block,'TRNAMT').replace(',','.'))||0;
    const date=importParseDate(importOfxField(block,'DTPOSTED'));
    const name=importOfxField(block,'NAME');
    const memo=importOfxField(block,'MEMO');
    const description=[name,memo].filter(Boolean).filter((value,pos,array)=>array.indexOf(value)===pos).join(' · ')||'Movimentação OFX';
    const trnType=importNormalizeText(importOfxField(block,'TRNTYPE'));
    const kind=rawAmount<0
      ?'expense'
      :rawAmount>0
        ?'income'
        :(/DEBIT|CHECK|PAYMENT/.test(trnType)?'expense':'income');

    return {
      draftId:`ofx-${index}-${uid()}`,
      date,
      description,
      amount:round2(Math.abs(rawAmount)),
      kind,
      externalId:importOfxField(block,'FITID'),
      importedCategory:'',
      rawIndex:index
    };
  }).filter(row=>row.date&&row.amount>0);

  importPrepareRows();
}

function importFingerprint(row){
  const source=importNormalizeText(row.source||importDraft.source||importDraft.fileName);
  const external=String(row.externalId||'').trim();

  if(external){
    return `EXT|${source}|${importNormalizeText(external)}`;
  }

  return [
    'ROW',
    row.date||'',
    row.kind||'',
    Number(row.amount||0).toFixed(2),
    importNormalizeText(row.description||'')
  ].join('|');
}

function transactionImportFingerprint(transaction){
  if(transaction.importFingerprint)return transaction.importFingerprint;

  return importFingerprint({
    source:transaction.importSource||'',
    externalId:transaction.importExternalId||'',
    date:transaction.date,
    kind:transaction.kind,
    amount:transaction.amount,
    description:transaction.description
  });
}

function importExistingFingerprints(){
  return new Set((state.transactions||[]).map(transactionImportFingerprint));
}

function importRuleMatches(rule,row){
  if(!rule||!row)return false;

  const kind=rule.kind||'all';
  if(kind!=='all'&&kind!==row.kind)return false;

  const pattern=importNormalizeText(rule.pattern||'');
  if(!pattern)return false;

  return importNormalizeText(row.description||'').includes(pattern);
}

function importSuggestCategory(row){
  if(row.importedCategory){
    return {category:row.importedCategory,rule:null};
  }

  const rules=(state.importRules||[])
    .filter(rule=>importRuleMatches(rule,row))
    .sort((a,b)=>importNormalizeText(b.pattern).length-importNormalizeText(a.pattern).length);

  if(rules.length){
    return {category:rules[0].category||'Outros',rule:rules[0]};
  }

  return {category:'Outros',rule:null};
}

function importPrepareRows(){
  const existing=importExistingFingerprints();
  const seen=new Set();

  importDraft.rows=importDraft.rows.map(row=>{
    const source=importDraft.source||importDraft.fileName;
    const fingerprint=importFingerprint({...row,source});
    const duplicate=existing.has(fingerprint)||seen.has(fingerprint);
    const suggestion=importSuggestCategory(row);

    seen.add(fingerprint);

    return {
      ...row,
      source,
      fingerprint,
      duplicate,
      selected:!duplicate,
      category:suggestion.category||'Outros',
      suggestedByRuleId:suggestion.rule?.id||''
    };
  });

  importRenderPreview();
}

function importMerchantPattern(description=''){
  const ignored=new Set([
    'PAGAMENTO','COMPRA','DEBITO','CREDITO','PIX','TRANSF','TRANSFERENCIA','TED','DOC',
    'CARTAO','VISA','MASTERCARD','ELO','LTDA','EIRELI','BRASIL','BR','SA','S A',
    'ONLINE','PGTO','PAG','RECEBIMENTO','DEPOSITO'
  ]);

  const tokens=importNormalizeText(description)
    .split(' ')
    .filter(token=>token.length>=3&&!/^\d+$/.test(token)&&!ignored.has(token));

  if(!tokens.length)return '';
  if(tokens[0].length>=6)return tokens[0];

  return tokens.slice(0,2).join(' ');
}

function importLearnRule(row){
  if(!state.importSettings?.learnCategories)return;
  if(!row?.category||row.category==='Outros')return;

  const pattern=importMerchantPattern(row.description);
  if(!pattern||pattern.length<3)return;

  const exact=(state.importRules||[]).find(rule=>
    importNormalizeText(rule.pattern)===pattern &&
    (rule.kind||'all')===row.kind
  );

  if(exact){
    exact.category=row.category;
    exact.usageCount=Number(exact.usageCount||0)+1;
    exact.lastUsedAt=new Date().toISOString();
    return;
  }

  state.importRules.push({
    id:uid(),
    pattern,
    category:row.category,
    kind:row.kind,
    usageCount:1,
    createdAt:new Date().toISOString(),
    lastUsedAt:new Date().toISOString(),
    learned:true
  });
}

function importPreviewCategoryValue(row){
  return String(row.category||'Outros');
}

function importRenderPreview(){
  const panel=document.querySelector('#importPreviewPanel');
  const list=document.querySelector('#importPreviewList');
  if(!panel||!list)return;

  const rows=importDraft.rows||[];
  panel.classList.toggle('hidden',!rows.length);

  const found=rows.length;
  const duplicates=rows.filter(row=>row.duplicate).length;
  const selected=rows.filter(row=>row.selected).length;

  document.querySelector('#importFoundCount').textContent=String(found);
  document.querySelector('#importNewCount').textContent=String(found-duplicates);
  document.querySelector('#importDuplicateCount').textContent=String(duplicates);
  document.querySelector('#importSelectedCount').textContent=String(selected);
  document.querySelector('#importPreviewCounter').textContent=`${selected} selecionados`;
  document.querySelector('#importConfirmText').textContent=selected
    ?`${selected} movimentação(ões) serão adicionadas como realizadas.`
    :'Selecione os lançamentos desejados.';

  const confirmButton=document.querySelector('#confirmStatementImport');
  if(confirmButton)confirmButton.disabled=selected===0;

  if(!rows.length){
    list.innerHTML='<div class="import-empty">Nenhuma movimentação válida encontrada.</div>';
    return;
  }

  list.innerHTML=rows.map(row=>`
    <div class="import-row ${row.duplicate?'is-duplicate':''} ${row.selected?'selected':''}" data-import-row="${row.draftId}">
      <label class="import-row-check" title="${row.duplicate?'Possível duplicado. Marque apenas se quiser importar mesmo assim.':'Importar este lançamento'}">
        <input type="checkbox" data-import-select="${row.draftId}" ${row.selected?'checked':''}>
      </label>

      <span class="import-row-date">${formatDate(row.date)}</span>

      <div class="import-row-description">
        <strong title="${escapeHtml(row.description)}">${escapeHtml(row.description)}</strong>
        <small>
          ${row.duplicate?'<span class="import-duplicate-badge">Possível duplicado</span>':''}
          ${row.suggestedByRuleId?'<span class="import-rule-badge">Categoria sugerida</span>':''}
          <span>${escapeHtml(row.source||importDraft.fileName)}</span>
        </small>
      </div>

      <label class="import-row-kind">
        <select data-import-kind="${row.draftId}" aria-label="Natureza">
          <option value="expense" ${row.kind==='expense'?'selected':''}>Gasto</option>
          <option value="income" ${row.kind==='income'?'selected':''}>Entrada</option>
        </select>
      </label>

      <strong class="import-row-amount ${row.kind}">${row.kind==='expense'?'−':'+'} ${fmt.format(row.amount)}</strong>

      <label class="import-row-category">
        <input data-import-category="${row.draftId}" list="categoryOptions" value="${escapeHtml(importPreviewCategoryValue(row))}" aria-label="Categoria">
      </label>
    </div>
  `).join('');
}

function renderImportRules(){
  const list=document.querySelector('#importRulesList');
  const count=document.querySelector('#importRulesCount');
  if(!list)return;

  const rules=(state.importRules||[])
    .slice()
    .sort((a,b)=>importNormalizeText(a.pattern).localeCompare(importNormalizeText(b.pattern),'pt-BR'));

  if(count)count.textContent=`${rules.length} ${rules.length===1?'regra':'regras'}`;

  if(!rules.length){
    list.innerHTML='<div class="import-empty">Nenhuma regra cadastrada ainda. Elas podem ser criadas manualmente ou aprendidas durante uma importação.</div>';
    return;
  }

  list.innerHTML=rules.map(rule=>`
    <div class="import-rule-row">
      <div class="import-rule-copy">
        <strong>${escapeHtml(rule.pattern)} → ${escapeHtml(rule.category||'Outros')}</strong>
        <span>${rule.kind==='income'?'Entradas':rule.kind==='expense'?'Gastos':'Entradas e gastos'} · usada ${Number(rule.usageCount||0)} vez(es)${rule.learned?' · aprendida automaticamente':''}</span>
      </div>
      <button class="btn ghost small" type="button" data-import-rule-delete="${rule.id}">Excluir</button>
    </div>
  `).join('');
}

function renderImportHistory(){
  const host=document.querySelector('#importHistoryList');
  if(!host)return;

  const history=(state.importHistory||[]).slice().reverse().slice(0,20);

  if(!history.length){
    host.innerHTML='<div class="import-empty">Nenhuma importação registrada.</div>';
    return;
  }

  host.innerHTML=history.map(item=>{
    const date=new Date(item.createdAt);
    const when=Number.isNaN(date.getTime())?'Data indisponível':date.toLocaleString('pt-BR');

    return `<div class="import-history-row">
      <div class="import-history-copy">
        <strong>${escapeHtml(item.fileName||item.source||'Extrato')}</strong>
        <span>${when} · ${Number(item.importedCount||0)} importado(s) · ${Number(item.duplicateCount||0)} duplicado(s) detectado(s)</span>
      </div>
      <span class="status-pill">${escapeHtml(String(item.format||'').toUpperCase())}</span>
    </div>`;
  }).join('');
}

function renderImporter(){
  const account=document.querySelector('#importAccountName');
  const learn=document.querySelector('#learnImportRules');

  if(account&&!account.matches(':focus')){
    account.value=state.importSettings?.lastAccount||'';
  }

  if(learn)learn.checked=state.importSettings?.learnCategories!==false;

  renderImportRules();
  renderImportHistory();

  if(importDraft.rows?.length){
    importRenderPreview();
  }
}


const IMPORT_PDFJS_VERSION='4.10.38';
let importPdfJsPromise=null;

async function importLoadPdfJs(){
  if(!importPdfJsPromise){
    const base=`https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${IMPORT_PDFJS_VERSION}`;
    importPdfJsPromise=import(`${base}/pdf.min.mjs`).then(pdfjsLib=>{
      pdfjsLib.GlobalWorkerOptions.workerSrc=`${base}/pdf.worker.min.mjs`;
      return pdfjsLib;
    });
  }

  try{
    return await importPdfJsPromise;
  }catch(error){
    importPdfJsPromise=null;
    throw new Error('Não foi possível carregar o leitor de PDF. Verifique sua conexão e tente novamente.');
  }
}

function importPdfLineGroups(items,pageHeight){
  const words=(items||[])
    .filter(item=>String(item?.str||'').trim())
    .map(item=>({
      text:String(item.str).trim(),
      x:Number(item.transform?.[4]||0),
      top:Number(pageHeight||0)-Number(item.transform?.[5]||0)
    }))
    .sort((a,b)=>a.top-b.top||a.x-b.x);

  const lines=[];
  const tolerance=2.4;

  words.forEach(word=>{
    let line=lines.find(candidate=>Math.abs(candidate.top-word.top)<=tolerance);
    if(!line){
      line={top:word.top,items:[]};
      lines.push(line);
    }
    line.items.push(word);
  });

  lines.sort((a,b)=>a.top-b.top);
  lines.forEach(line=>{
    line.items.sort((a,b)=>a.x-b.x);
    line.text=line.items.map(item=>item.text).join(' ').replace(/\s+/g,' ').trim();
  });

  return lines;
}

function importPdfHeaderColumns(lines){
  const header=(lines||[]).find(line=>{
    const text=importNormalizeText(line.text);
    const hasDescription=text.includes('DESCRICAO')||text.includes('LANCAMENTOS')||text.includes('HISTORICO');
    return text.includes('DATA')&&hasDescription&&text.includes('VALOR');
  });

  if(!header)return null;

  const findX=matcher=>{
    const item=header.items.find(entry=>matcher(importNormalizeText(entry.text)));
    return item?Number(item.x):null;
  };

  return {
    descriptionX:findX(text=>text.startsWith('DESCR')||text.startsWith('LANCAMENT')||text.startsWith('HISTOR')),
    idX:findX(text=>text==='ID'||text.startsWith('ID ')||text.startsWith('IDENTIFIC')),
    amountX:findX(text=>text==='VALOR'||text.startsWith('VALOR')),
    balanceX:findX(text=>text==='SALDO'||text.startsWith('SALDO'))
  };
}

function importPdfMoneyMatches(text=''){
  return Array.from(String(text).matchAll(/(?:R\$\s*)?[-+]?\s*[\d.]+,\d{2}/g))
    .map(match=>match[0].trim());
}

function importPdfMovementAmount(line,columns){
  const normalized=importNormalizeText(line?.text||'');
  if(normalized.includes('SALDO DO DIA'))return 0;

  const amountX=Number(columns?.amountX);
  const balanceX=Number(columns?.balanceX);

  if(Number.isFinite(amountX)){
    const amountText=(line?.items||[])
      .filter(item=>{
        const x=Number(item.x);
        if(!Number.isFinite(x)||x<amountX-12)return false;
        if(Number.isFinite(balanceX)&&balanceX>amountX&&x>=balanceX-10)return false;
        return true;
      })
      .map(item=>item.text)
      .join(' ')
      .replace(/\s+/g,' ')
      .trim();

    const matches=importPdfMoneyMatches(amountText);
    if(matches.length){
      return importSignedMoney(matches[0]);
    }
  }

  const fallbackMatches=importPdfMoneyMatches(line?.text||'');
  if(!fallbackMatches.length)return 0;
  return importSignedMoney(fallbackMatches[0]);
}

function importPdfDescriptionForAnchor(lines,anchors,index,columns){
  const anchor=anchors[index];
  const prev=anchors[index-1];
  const next=anchors[index+1];
  const lower=prev?(prev.line.top+anchor.line.top)/2:anchor.line.top-38;
  const upper=next?(anchor.line.top+next.line.top)/2:anchor.line.top+38;
  const startX=Number(columns?.descriptionX);
  const endX=Number(columns?.idX??columns?.amountX);

  if(Number.isFinite(startX)&&Number.isFinite(endX)&&endX>startX){
    const parts=[];

    lines.forEach(line=>{
      if(line.top<lower||line.top>=upper)return;

      const text=line.items
        .filter(item=>item.x>=startX-4&&item.x<endX-3)
        .map(item=>item.text)
        .join(' ')
        .replace(/\s+/g,' ')
        .trim();

      if(!text)return;
      const normalized=importNormalizeText(text);
      if(normalized==='DESCRICAO'||normalized==='DESCRICAO ID DA OPERACAO')return;
      parts.push({top:line.top,text});
    });

    const description=parts
      .sort((a,b)=>a.top-b.top)
      .map(part=>part.text)
      .join(' ')
      .replace(/\s+/g,' ')
      .trim();

    if(description)return description;
  }

  let fallback=anchor.line.text
    .replace(/\b\d{2}[-/.]\d{2}[-/.]\d{4}\b/g,' ')
    .replace(/(?:R\$\s*)?[-+]?\s*[\d.]+,\d{2}/g,' ')
    .replace(/\b\d{8,}\b/g,' ')
    .replace(/\s+/g,' ')
    .trim();

  return fallback||'Movimentação PDF';
}

async function importParsePdf(file){
  const pdfjsLib=await importLoadPdfJs();
  const bytes=new Uint8Array(await file.arrayBuffer());
  const loadingTask=pdfjsLib.getDocument({data:bytes});
  const pdf=await loadingTask.promise;
  const pages=[];
  let totalText='';

  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
    const page=await pdf.getPage(pageNumber);
    const viewport=page.getViewport({scale:1});
    const content=await page.getTextContent();
    const lines=importPdfLineGroups(content.items,viewport.height);
    pages.push(lines);
    totalText+=`\n${lines.map(line=>line.text).join('\n')}`;
  }

  if(importNormalizeText(totalText).length<80){
    throw new Error('Este PDF não possui texto pesquisável suficiente. Se ele for escaneado/imagem, exporte o extrato em OFX ou CSV.');
  }

  const normalizedAll=importNormalizeText(totalText);
  let detectedSource='';
  if(normalizedAll.includes('MERCADO PAGO'))detectedSource='Mercado Pago';
  else if(normalizedAll.includes('NUBANK'))detectedSource='Nubank';
  else if(normalizedAll.includes('BRADESCO'))detectedSource='Bradesco';
  else if(normalizedAll.includes('ITAU'))detectedSource='Itaú';
  else if(normalizedAll.includes('SANTANDER'))detectedSource='Santander';

  if(detectedSource&&(!importDraft.source||importDraft.source===importDraft.fileName)){
    importDraft.source=detectedSource;
    const account=document.querySelector('#importAccountName');
    if(account&&!account.value.trim())account.value=detectedSource;
  }

  const rows=[];

  pages.forEach((lines,pageIndex)=>{
    const columns=importPdfHeaderColumns(lines);
    const anchors=[];

    lines.forEach(line=>{
      const dateMatch=line.text.match(/\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/);
      if(!dateMatch)return;

      const parsedDate=importParseDate(dateMatch[1]);
      if(!parsedDate)return;

      const signedAmount=importPdfMovementAmount(line,columns);
      if(!signedAmount)return;

      const externalMatch=line.text
        .replace(dateMatch[0],' ')
        .match(/\b\d{8,}\b/);

      anchors.push({
        line,
        date:parsedDate,
        signedAmount,
        externalId:externalMatch?.[0]||''
      });
    });

    anchors.forEach((anchor,index)=>{
      rows.push({
        draftId:`pdf-${pageIndex}-${index}-${uid()}`,
        date:anchor.date,
        description:importPdfDescriptionForAnchor(lines,anchors,index,columns),
        amount:round2(Math.abs(anchor.signedAmount)),
        kind:anchor.signedAmount<0?'expense':'income',
        externalId:anchor.externalId,
        importedCategory:'',
        rawIndex:rows.length
      });
    });
  });

  if(!rows.length){
    throw new Error('O PDF foi lido, mas não consegui reconhecer uma tabela de movimentações. Prefira OFX/CSV ou envie um exemplo desse banco para adicionarmos o formato.');
  }

  importDraft.rows=rows;
  importPrepareRows();
}

async function importReadFile(file){
  if(!file)return;

  const lower=file.name.toLowerCase();
  const isPdf=/\.pdf$/i.test(lower)||file.type==='application/pdf';
  const status=document.querySelector('#importFileStatus');
  const formatBadge=document.querySelector('#importFormatBadge');
  const mappingPanel=document.querySelector('#csvMappingPanel');

  if(isPdf){
    importDraft={
      fileName:file.name,
      format:'pdf',
      source:document.querySelector('#importAccountName')?.value.trim()||file.name,
      rawText:'',
      headers:[],
      rawRows:[],
      delimiter:'',
      mapping:{date:-1,description:-1,amount:-1,debit:-1,credit:-1,type:-1,id:-1,category:-1},
      rows:[]
    };

    mappingPanel?.classList.add('hidden');
    if(formatBadge)formatBadge.textContent='PDF';
    if(status){
      status.textContent=`${file.name}: lendo texto do PDF...`;
      status.className='helper small-text';
    }

    await importParsePdf(file);

    if(status){
      status.textContent=`${file.name}: ${importDraft.rows.length} movimentação(ões) reconhecida(s). Revise antes de importar.`;
      status.className='helper small-text import-success';
    }
    return;
  }

  const text=await file.text();
  const looksOfx=/\.(ofx|qfx)$/i.test(lower)||/<OFX>|<STMTTRN>/i.test(text);
  const looksCsv=/\.(csv|txt)$/i.test(lower)||file.type==='text/csv'||looksOfx;

  if(!looksCsv){
    throw new Error('Formato não reconhecido. Use PDF, OFX, QFX ou CSV.');
  }

  importDraft={
    fileName:file.name,
    format:looksOfx?'ofx':'csv',
    source:document.querySelector('#importAccountName')?.value.trim()||file.name,
    rawText:text,
    headers:[],
    rawRows:[],
    delimiter:'',
    mapping:{date:-1,description:-1,amount:-1,debit:-1,credit:-1,type:-1,id:-1,category:-1},
    rows:[]
  };

  if(formatBadge)formatBadge.textContent=looksOfx?'OFX/QFX':'CSV';

  if(looksOfx){
    mappingPanel?.classList.add('hidden');
    importParseOfx(text);

    if(status){
      status.textContent=`${file.name}: ${importDraft.rows.length} movimentação(ões) reconhecida(s).`;
      status.className='helper small-text import-success';
    }
    return;
  }

  let csvText=text.replace(/^\uFEFF/,'');
  const sepMatch=csvText.match(/^sep=(.)\s*(?:\r?\n)/i);
  const delimiter=sepMatch?.[1]||importDetectDelimiter(csvText);

  if(sepMatch){
    csvText=csvText.slice(sepMatch[0].length);
  }

  const parsed=importCsvParse(csvText,delimiter);

  if(parsed.length<2){
    throw new Error('O CSV não possui linhas suficientes para importação.');
  }

  let headerIndex=0;
  let bestHeaderScore=-1;

  parsed.slice(0,Math.min(12,parsed.length)).forEach((row,index)=>{
    const score=importCsvHeaderScore(row);
    if(score>bestHeaderScore){
      bestHeaderScore=score;
      headerIndex=index;
    }
  });

  importDraft.delimiter=delimiter;
  importDraft.headers=parsed[headerIndex].map((header,index)=>String(header||`Coluna ${index+1}`).trim()||`Coluna ${index+1}`);
  importDraft.rawRows=parsed.slice(headerIndex+1).filter(row=>row.some(value=>String(value).trim()!==''));
  importDraft.mapping={
    date:importFindColumn(importDraft.headers,'date'),
    description:importFindColumn(importDraft.headers,'description'),
    amount:importFindColumn(importDraft.headers,'amount'),
    debit:importFindColumn(importDraft.headers,'debit'),
    credit:importFindColumn(importDraft.headers,'credit'),
    type:importFindColumn(importDraft.headers,'type'),
    id:importFindColumn(importDraft.headers,'id'),
    category:importFindColumn(importDraft.headers,'category')
  };

  mappingPanel?.classList.remove('hidden');
  importPopulateMapping();

  if(status){
    status.textContent=`${file.name}: ${importDraft.rawRows.length} linha(s) de dados. Confira o mapeamento abaixo.`;
    status.className='helper small-text';
  }

  try{
    importBuildCsvRows();
  }catch(error){
    importDraft.rows=[];
    importRenderPreview();
    if(status){
      status.textContent=String(error?.message||error);
      status.className='helper small-text import-error';
    }
  }
}

function importCreateTransactions(selectedRows){
  const batchId=uid();
  const importedAt=new Date().toISOString();

  return selectedRows.map(row=>({
    id:uid(),
    kind:row.kind,
    incomeType:row.kind==='income'?'extra':undefined,
    expenseType:row.kind==='expense'?'variable':undefined,
    paySource:row.kind==='expense'?'cash':undefined,
    category:row.kind==='expense'?(row.category||'Outros'):undefined,
    description:row.description||'Movimentação importada',
    amount:round2(Math.abs(Number(row.amount||0))),
    date:row.date,
    status:'realized',
    imported:true,
    importBatchId:batchId,
    importSource:row.source||importDraft.source||importDraft.fileName,
    importFile:importDraft.fileName,
    importFormat:importDraft.format,
    importFingerprint:row.fingerprint,
    importExternalId:row.externalId||'',
    importedAt
  }));
}

function importCommit(){
  const selected=(importDraft.rows||[]).filter(row=>row.selected);

  if(!selected.length){
    alert('Selecione pelo menos uma movimentação.');
    return;
  }

  const duplicates=selected.filter(row=>row.duplicate).length;

  if(duplicates&&!confirm(
    `${duplicates} item(ns) selecionado(s) parecem duplicados. Deseja importar mesmo assim?`
  )){
    return;
  }

  const tx=importCreateTransactions(selected);

  if(!tx.length)return;

  createSafetySnapshot(`Antes de importar extrato: ${importDraft.fileName}`);

  state.transactions.push(...tx);

  if(state.importSettings?.learnCategories!==false){
    selected.forEach(importLearnRule);
  }

  state.importHistory.push({
    id:uid(),
    fileName:importDraft.fileName,
    source:importDraft.source||importDraft.fileName,
    format:importDraft.format,
    importedCount:tx.length,
    duplicateCount:(importDraft.rows||[]).filter(row=>row.duplicate).length,
    createdAt:new Date().toISOString()
  });

  state.importHistory=state.importHistory.slice(-50);
  state.importSettings.lastAccount=document.querySelector('#importAccountName')?.value.trim()||state.importSettings.lastAccount||'';

  const latest=selected.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(latest?.date){
    const [year,month]=latest.date.slice(0,7).split('-').map(Number);
    cursor=new Date(year,month-1,1);
    rememberViewMonth();
  }

  save({undoLabel:`Extrato importado: ${importDraft.fileName}`});

  importDraft.rows=importDraft.rows.map(row=>({
    ...row,
    duplicate:true,
    selected:false
  }));

  renderAll();
  renderImporter();

  alert(`${tx.length} movimentação(ões) importada(s) com sucesso.`);
}

document.querySelector('#statementFile')?.addEventListener('change',async event=>{
  const file=event.target.files?.[0];
  if(!file)return;

  try{
    await importReadFile(file);
  }catch(error){
    console.error(error);
    const status=document.querySelector('#importFileStatus');
    if(status){
      status.textContent=`Não foi possível ler o arquivo: ${String(error?.message||error)}`;
      status.className='helper small-text import-error';
    }
    document.querySelector('#importPreviewPanel')?.classList.add('hidden');
  }
});

document.querySelector('#importAccountName')?.addEventListener('change',event=>{
  state.importSettings.lastAccount=event.target.value.trim();
  save({backupOld:false,cloud:false,history:false});
  if(importDraft.fileName){
    importDraft.source=event.target.value.trim()||importDraft.fileName;
    importPrepareRows();
  }
});

document.querySelector('#rebuildImportPreview')?.addEventListener('click',()=>{
  try{
    importBuildCsvRows();
    const status=document.querySelector('#importFileStatus');
    if(status){
      status.textContent=`Prévia atualizada: ${importDraft.rows.length} movimentação(ões) válida(s).`;
      status.className='helper small-text import-success';
    }
    save({backupOld:false,cloud:false,history:false});
  }catch(error){
    const status=document.querySelector('#importFileStatus');
    if(status){
      status.textContent=String(error?.message||error);
      status.className='helper small-text import-error';
    }
  }
});

document.querySelector('#learnImportRules')?.addEventListener('change',event=>{
  state.importSettings.learnCategories=event.target.checked;
  save({backupOld:false,cloud:false,history:false});
});

document.querySelector('#selectNewImportRows')?.addEventListener('click',()=>{
  importDraft.rows.forEach(row=>row.selected=!row.duplicate);
  importRenderPreview();
});

document.querySelector('#selectAllImportRows')?.addEventListener('click',()=>{
  importDraft.rows.forEach(row=>row.selected=true);
  importRenderPreview();
});

document.querySelector('#clearImportRows')?.addEventListener('click',()=>{
  importDraft.rows.forEach(row=>row.selected=false);
  importRenderPreview();
});

document.querySelector('#confirmStatementImport')?.addEventListener('click',importCommit);

document.querySelector('#addImportRule')?.addEventListener('click',()=>{
  const pattern=document.querySelector('#importRulePattern')?.value.trim()||'';
  const category=document.querySelector('#importRuleCategory')?.value.trim()||'';
  const kind=document.querySelector('#importRuleKind')?.value||'all';

  if(pattern.length<2){
    alert('Informe um texto para identificar a movimentação.');
    return;
  }

  if(!category){
    alert('Informe a categoria da regra.');
    return;
  }

  const normalized=importNormalizeText(pattern);
  const duplicate=(state.importRules||[]).find(rule=>
    importNormalizeText(rule.pattern)===normalized &&
    (rule.kind||'all')===kind
  );

  if(duplicate){
    duplicate.category=category;
    duplicate.learned=false;
    duplicate.lastUsedAt=new Date().toISOString();
  }else{
    state.importRules.push({
      id:uid(),
      pattern:pattern.trim(),
      category,
      kind:['income','expense'].includes(kind)?kind:'all',
      usageCount:0,
      createdAt:new Date().toISOString(),
      lastUsedAt:'',
      learned:false
    });
  }

  save({undoLabel:`Regra de importação salva: ${pattern.trim()}`});

  document.querySelector('#importRulePattern').value='';
  document.querySelector('#importRuleCategory').value='';
  document.querySelector('#importRuleKind').value='all';

  if(importDraft.rows?.length)importPrepareRows();
  renderImportRules();
});

addEventListener('click',event=>{
  const select=event.target.closest('[data-import-select]');
  if(select){
    const row=importDraft.rows.find(item=>item.draftId===select.dataset.importSelect);
    if(row){
      row.selected=select.checked;
      importRenderPreview();
    }
    return;
  }

  const removeRule=event.target.closest('[data-import-rule-delete]');
  if(removeRule){
    const rule=state.importRules.find(item=>item.id===removeRule.dataset.importRuleDelete);
    if(!rule)return;

    if(!confirm(`Excluir a regra "${rule.pattern} → ${rule.category}"?`))return;

    state.importRules=state.importRules.filter(item=>item.id!==rule.id);
    save({undoLabel:`Regra de importação excluída: ${rule.pattern}`});

    if(importDraft.rows?.length)importPrepareRows();
    renderImportRules();
  }
});

addEventListener('change',event=>{
  const kind=event.target.closest('[data-import-kind]');
  if(kind){
    const row=importDraft.rows.find(item=>item.draftId===kind.dataset.importKind);
    if(row){
      row.kind=kind.value==='income'?'income':'expense';
      const suggestion=importSuggestCategory(row);
      if(row.category==='Outros'||row.suggestedByRuleId){
        row.category=suggestion.category||row.category;
        row.suggestedByRuleId=suggestion.rule?.id||'';
      }
      row.fingerprint=importFingerprint(row);
      row.duplicate=importExistingFingerprints().has(row.fingerprint);
      importRenderPreview();
    }
    return;
  }

  const category=event.target.closest('[data-import-category]');
  if(category){
    const row=importDraft.rows.find(item=>item.draftId===category.dataset.importCategory);
    if(row){
      row.category=category.value.trim()||'Outros';
      row.suggestedByRuleId='';
      importRenderPreview();
    }
  }
});
