function timeToMinutes(t){if(!t)return null;const [h,m]=t.split(':').map(Number);return h*60+m}
function overlap(a1,a2,b1,b2){return Math.max(0,Math.min(a2,b2)-Math.max(a1,b1))}
function calculateExtraRecord(r){
  let start=timeToMinutes(r.start),end=timeToMinutes(r.end);if(start===null||end===null)return {minutes:0,nightMinutes:0,hours50:0,hours100:0};
  if(end<=start)end+=1440;
  let lunchStart=null,lunchEnd=null,lunchMinutes=0;
  if(r.deductLunch&&r.lunchStart&&r.lunchEnd){lunchStart=timeToMinutes(r.lunchStart);lunchEnd=timeToMinutes(r.lunchEnd);if(lunchEnd<=lunchStart)lunchEnd+=1440;while(lunchStart<start){lunchStart+=1440;lunchEnd+=1440}lunchMinutes=overlap(start,end,lunchStart,lunchEnd)}
  const total=Math.max(0,end-start-lunchMinutes);
  const windows=[[0,300],[1320,1440],[1440,1740],[2760,3180]];
  let night=windows.reduce((s,[a,b])=>s+overlap(start,end,a,b),0);
  if(lunchStart!==null)night-=windows.reduce((s,[a,b])=>s+overlap(lunchStart,lunchEnd,a,b),0);
  night=Math.max(0,night);
  const d=new Date(`${r.date}T12:00:00`);const is100=!!r.holiday||d.getDay()===0;
  return {minutes:total,nightMinutes:night,hours50:is100?0:total/60,hours100:is100?total/60:0,nightHours:night/60,is100};
}
function getAllHolidays(year){return new Set([...(NATIONAL_HOLIDAYS[year]||[]),...(AMAZONAS_HOLIDAYS[year]||[]),...(MANAUS_HOLIDAYS[year]||[])]);}
function getDSRCalendar(monthKeyValue){
  const [year,month]=monthKeyValue.split('-').map(Number);
  const totalDays=new Date(year,month,0).getDate();
  let sundays=0;
  for(let day=1;day<=totalDays;day++){
    const date=new Date(year,month-1,day);
    if(date.getDay()===0)sundays++;
  }
  const restDays=sundays;
  const workingDays=totalDays-sundays;
  return {totalDays,sundays,holidays:0,restDays,workingDays};
}
function inss2026(base){
  const brackets=[[1621,0.075],[2902.84,0.09],[4354.27,0.12],[8475.55,0.14]];
  let prev=0,total=0;
  for(const [upper,rate] of brackets){
    const part=Math.max(0,Math.min(base,upper)-prev);
    total+=trunc2(part*rate);
    prev=upper;
    if(base<=upper)break;
  }
  return round2(total);
}
function irrf2026(gross,inss){
  const simplified=607.20;const deduction=Math.max(inss,simplified);const base=Math.max(0,gross-deduction);let before=0;
  if(base<=2428.80)before=0;else if(base<=2826.65)before=base*.075-182.16;else if(base<=3751.05)before=base*.15-394.16;else if(base<=4664.68)before=base*.225-675.49;else before=base*.275-908.73;
  before=Math.max(0,round2(before));let reduction=0;
  if(gross<=5000)reduction=Math.min(before,312.89);else if(gross<=7350)reduction=Math.max(0,round2(978.62-0.133145*gross));
  reduction=Math.min(before,reduction);return {base:round2(base),before,reduction:round2(reduction),value:round2(Math.max(0,before-reduction)),deductionUsed:round2(deduction)};
}
function loadPayrollScript(src,globalName){
  if(window[globalName])return Promise.resolve(window[globalName]);
  const existing=document.querySelector(`script[data-payroll-lib="${globalName}"]`);
  if(existing){
    return new Promise((resolve,reject)=>{
      existing.addEventListener('load',()=>window[globalName]?resolve(window[globalName]):reject(new Error(`Biblioteca ${globalName} indisponível.`)),{once:true});
      existing.addEventListener('error',()=>reject(new Error(`Não foi possível carregar a biblioteca ${globalName}.`)),{once:true});
    });
  }
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.async=true;
    script.dataset.payrollLib=globalName;
    script.onload=()=>window[globalName]?resolve(window[globalName]):reject(new Error(`Biblioteca ${globalName} indisponível.`));
    script.onerror=()=>reject(new Error(`Não foi possível carregar a biblioteca ${globalName}. Confira sua conexão e tente novamente.`));
    document.head.appendChild(script);
  });
}
async function createPayrollOcrWorker(statusId='#payrollImportStatus'){
  const Tesseract=await loadPayrollScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js','Tesseract');
  return Tesseract.createWorker('por',1,{
    logger:message=>{
      const status=document.querySelector(statusId);
      if(!status)return;
      if(message.status==='recognizing text'){
        status.textContent=`Lendo imagem da folha no aparelho: ${Math.round((message.progress||0)*100)}%.`;
      }else if(message.status==='loading language traineddata'){
        status.textContent='Preparando idioma português para leitura local...';
      }else if(message.status==='loading tesseract core'||message.status==='initializing tesseract'){
        status.textContent='Preparando leitura local do holerite...';
      }
    },
    workerPath:'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    corePath:'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js',
    langPath:'https://tessdata.projectnaptha.com/4.0.0'
  });
}
async function loadPdfText(file,statusId='#payrollImportStatus'){
  const pdfjs=await loadPayrollScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','pdfjsLib');
  pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  const pages=[];
  for(let pageNumber=1;pageNumber<=Math.min(pdf.numPages,8);pageNumber++){
    const page=await pdf.getPage(pageNumber);
    const content=await page.getTextContent();
    const rows=new Map();
    content.items.forEach(item=>{
      if(!item.str?.trim())return;
      const y=Math.round(item.transform?.[5]||0);
      rows.set(y,`${rows.get(y)||''} ${item.str}`);
    });
    pages.push([...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,line])=>line.trim()).join('\n'));
  }
  let text=pages.join('\n');
  if(text.replace(/\s/g,'').length<60){
    document.querySelector(statusId).textContent='Preparando leitura local do documento...';
    const worker=await createPayrollOcrWorker(statusId);
    try{
      const ocrPages=[];
      for(let pageNumber=1;pageNumber<=Math.min(pdf.numPages,3);pageNumber++){
        const page=await pdf.getPage(pageNumber);
        const viewport=page.getViewport({scale:2});
        const canvas=document.createElement('canvas');
        canvas.width=Math.ceil(viewport.width);
        canvas.height=Math.ceil(viewport.height);
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        const result=await worker.recognize(canvas);
        ocrPages.push(result.data.text);
        canvas.width=0;
        canvas.height=0;
      }
      text=ocrPages.join('\n');
    }finally{
      await worker.terminate();
    }
  }
  return text;
}
async function loadImageText(file,statusId='#payrollImportStatus'){
  const worker=await createPayrollOcrWorker(statusId);
  try{
    const result=await worker.recognize(file);
    return result.data.text;
  }finally{
    await worker.terminate();
  }
}
function normalizePayrollText(value){
  return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function parsePayrollAmount(text,labels){
  const lines=normalizePayrollText(text).split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const amountPattern=/-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}|-?\d+\.\d{2}/g;
  const nextPayrollLabel=/\b(?:salario|vencimento|proventos?|rendimentos?|vantagens?|descontos?|adiant\w*|antecip\w*|inss|previdencia|contribuicao|irrf|dirf|imposto|liquido|valor)\b/i;
  for(let index=0;index<lines.length;index++){
    const label=labels.map(pattern=>({pattern,match:pattern.exec(lines[index])})).find(item=>item.match);
    if(!label)continue;
    const tail=lines[index].slice(label.match.index+label.match[0].length);
    const nextLabel=nextPayrollLabel.exec(tail);
    const fieldText=nextLabel?tail.slice(0,nextLabel.index):tail;
    const sameLine=fieldText.match(amountPattern);
    if(sameLine)return money(sameLine[sameLine.length-1]);
    const nextLine=lines[index+1];
    if(nextLine&&!nextPayrollLabel.test(nextLine)){
      const nextAmounts=nextLine.match(amountPattern);
      if(nextAmounts)return money(nextAmounts[nextAmounts.length-1]);
    }
  }
  return null;
}
function parsePayrollDocument(text){
  const fields={
    baseSalary:parsePayrollAmount(text,[/salario\s+base\b/,/vencimento\s+base\b/,/salario\s+contratual\b/,/^salario\b/,/^vencimento\b/]),
    gross:parsePayrollAmount(text,[/total\s+bruto\b/,/proventos\s+totais\b/,/total\s+(?:(?:de|dos|das)\s+)?proventos\b/,/total\s+(?:(?:de|dos|das)\s+)?vencimentos\b/,/total\s+(?:(?:de|dos|das)\s+)?vantagens\b/,/remuneracao\s+bruta\b/,/valor\s+bruto\b/,/total\s+de\s+rendimentos\b/]),
    advance:parsePayrollAmount(text,[/adiant(?:amento|\.)?(?:\s+salarial)?\b/,/antecipacao\s+salarial\b/]),
    inss:parsePayrollAmount(text,[/\binss\b/,/previdencia\s+social\b/,/contribuicao\s+previdenciaria\b/]),
    irrf:parsePayrollAmount(text,[/\birrf\b/,/\bdirf\b/,/imposto\s+de\s+renda\b/]),
    finalPay:parsePayrollAmount(text,[/liquido\s+a\s+receber\b/,/valor\s+liquido\b/,/liquido\s+receber\b/,/total\s+liquido\b/,/^liquido\b/])
  };
  if(fields.gross!==null){
    if(fields.baseSalary!==null&&fields.baseSalary>fields.gross)fields.baseSalary=null;
    if(fields.advance!==null&&(fields.advance<0||fields.advance>fields.gross))fields.advance=null;
    if(fields.inss!==null&&(fields.inss<0||fields.inss>fields.gross))fields.inss=null;
    if(fields.irrf!==null&&(fields.irrf<0||fields.irrf>fields.gross))fields.irrf=null;
    if(fields.finalPay!==null&&(fields.finalPay<=0||fields.finalPay>fields.gross))fields.finalPay=null;
  }
  return fields;
}
function fgtsStatementCompetence(text){
  const monthNames={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};
  const named=text.match(/\b(jan(?:eiro)?|fev(?:ereiro)?|mar(?:co|ço)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\s*[/-]?\s*(20\d{2})\b/i);
  if(named){
    const month=monthNames[normalizePayrollText(named[1]).slice(0,3)];
    if(month)return `${named[2]}-${String(month).padStart(2,'0')}`;
  }
  const explicit=text.match(/(?:competencia|referencia|ref\.?|mes)\s*:?\s*(0?[1-9]|1[0-2])[\s/-]+(20\d{2})/i);
  if(explicit)return `${explicit[2]}-${String(Number(explicit[1])).padStart(2,'0')}`;
  const withoutDates=text.replace(/\b[0-3]?\d[./-][01]?\d[./-]20\d{2}\b/g,' ');
  const numeric=withoutDates.match(/\b(0?[1-9]|1[0-2])[\s/-]+(20\d{2})\b/);
  if(numeric)return `${numeric[2]}-${String(Number(numeric[1])).padStart(2,'0')}`;
  return '';
}
function parseFgtsAccountMetadata(text){
  const lines=String(text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const employmentLine=lines.find(line=>/\d{2}\/\d{2}\/20\d{2}\s+\d{3}\.\d{5}\.\d{2}-\d/.test(line));
  const employmentMatch=employmentLine?.match(/^(.+?)\s+(\d{2}\/\d{2}\/20\d{2})\s+\d{3}\.\d{5}\.\d{2}-\d/);
  const admissionMatch=employmentMatch?.[2].match(/^(\d{2})\/(\d{2})\/(20\d{2})$/);
  let employer=employmentMatch?.[1].replace(/\s+/g,' ').trim()||'';
  const employmentIndex=employmentLine?lines.indexOf(employmentLine):-1;
  const wrappedName=employmentIndex>=0?lines[employmentIndex+1]||'':'';
  if(!/\b(?:LTDA|EIRELI|S\/A|ME)\b/i.test(employer)&&/^(?:[\p{L}\d.&/-]+\s+)+(?:LTDA|EIRELI|S\/A|ME)$/iu.test(wrappedName)){
    employer=`${employer} ${wrappedName}`.trim();
  }
  const admissionDate=admissionMatch?`${admissionMatch[3]}-${admissionMatch[2]}-${admissionMatch[1]}`:'';
  let terminationDate='';
  const awayHeader=lines.findIndex(line=>{
    const normalized=normalizePayrollText(line);
    return normalized.includes('data de op')&&normalized.includes('afastamento');
  });
  const awayLine=awayHeader>=0?lines[awayHeader+1]:'';
  const awayMatch=awayLine?.match(/^\d{2}\/\d{2}\/20\d{2}\s+(\d{2})\/(\d{2})\/(20\d{2})\s+\d+\s*$/);
  if(awayMatch)terminationDate=`${awayMatch[3]}-${awayMatch[2]}-${awayMatch[1]}`;
  const accountLine=lines.find(line=>/\b\d{8,}\s*\/\s*\d+\s*-\s*FGC\b/i.test(line));
  const accountMatch=accountLine?.match(/\b(\d{8,})\s*\/\s*(\d+)\s*-\s*FGC\b/i);
  const accountNumber=accountMatch?`${accountMatch[1]}/${accountMatch[2]}`:'';
  const balanceRows=[];
  const currencyPattern=/R\$\s*(-\s*)?((?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}))/gi;
  for(const line of lines){
    const date=line.match(/^([0-3]?\d)[./-]([01]?\d)[./-](20\d{2})\b/);
    const amounts=[...line.matchAll(currencyPattern)];
    if(!date||amounts.length<2)continue;
    balanceRows.push({
      date:`${date[3]}-${String(Number(date[2])).padStart(2,'0')}-${String(Number(date[1])).padStart(2,'0')}`,
      balance:money(amounts[amounts.length-1][2])
    });
  }
  balanceRows.sort((a,b)=>a.date.localeCompare(b.date));
  const latestBalance=balanceRows[balanceRows.length-1]||null;
  return {
    employer,
    admissionDate,
    terminationDate,
    accountNumber,
    currentBalance:latestBalance?.balance??null,
    balanceDate:latestBalance?.date||''
  };
}
function parseFgtsStatement(text){
  const rows=[];
  const amountPattern=/-?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)|-?\d+,\d{2}(?!\d)|-?\d{1,3}(?:,\d{3})*\.\d{2}(?!\d)|-?\d+\.\d{2}(?!\d)/g;
  const currencyAmountPattern=/R\$\s*(-\s*)?((?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}))/gi;
  for(const rawLine of String(text||'').split(/\r?\n/)){
    const line=rawLine.trim();
    if(!line)continue;
    const normalized=normalizePayrollText(line);
    const type=/\bsaques?\s+(?:dep(?:osito)?|fgts)\b|\bsaques?\s+dep\b|\bsaque\s+dep[oó]sito\b/.test(normalized)
      ?'withdrawal'
      :/\bsaques?\s+jam\b/.test(normalized)
        ?'jamWithdrawal'
      :/\bdep(?:osito)?\s+(?:de\s+)?verbas?\s+ind(?:emnizatorias?)?\b|\bverbas?\s+ind(?:emnizatorias?)?\b/.test(normalized)
        ?'indemnity'
      :/\bdep(?:osito)?\s+(?:de\s+)?multa\s+rescis[oó]ria\b|\bmulta\s+rescis[oó]ria\b/.test(normalized)
        ?'terminationPenalty'
      :/\b(?:credito\s+(?:de\s+)?jam|cr\s+jam|jam|atualizacao\s+monetaria)\b/.test(normalized)
        ?'jam'
      :/\b(?:deposito|recolhimento)\b/.test(normalized)&&/\b(?:13\s*[ºo°]|decimo\s+terceiro|13\s+salario)\b/.test(normalized)
        ?'thirteenth'
        :/\b(?:deposito|recolhimento)\b/.test(normalized)?'deposit':null;
    if(!type)continue;
    const dateMatch=line.match(/\b([0-3]?\d)[./-]([01]?\d)[./-](20\d{2})\b/);
    const date=dateMatch?`${dateMatch[3]}-${String(Number(dateMatch[2])).padStart(2,'0')}-${String(Number(dateMatch[1])).padStart(2,'0')}`:'';
    const moneyMatches=[...line.matchAll(currencyAmountPattern)];
    const amounts=[...line.matchAll(amountPattern)];
    const amountText=moneyMatches.length?`${moneyMatches[0][1]?' -':''}${moneyMatches[0][2]}`:amounts.length?amounts[0][0]:'';
    const competence=fgtsStatementCompetence(line)||(type==='thirteenth'&&date?`${date.slice(0,4)}-12`:date?date.slice(0,7):'');
    rows.push({
      type,
      competence,
      date,
      amount:amountText?(['withdrawal','jamWithdrawal'].includes(type)?Math.abs(money(amountText)):Math.max(0,money(amountText))):null
    });
  }
  return {rows,account:parseFgtsAccountMetadata(text)};
}
let fgtsImportAccount=null;
let fgtsImportDraft=[];
function addFgtsImportDraftRow(row={type:'deposit',competence:'',date:'',amount:null}){
  fgtsImportDraft.push({...row});
  renderFgtsImportDraft();
}
function renderFgtsImportDraft(){
  const list=document.querySelector('#fgtsImportRows');
  if(!list)return;
  list.replaceChildren();
  fgtsImportDraft.forEach((row,index)=>{
    const line=document.createElement('div');
    line.className='fgts-import-row';
    const competence=document.createElement('input');
    competence.type='month';
    competence.value=row.competence||'';
    competence.setAttribute('aria-label',`Competência do item ${index+1}`);
    competence.addEventListener('input',()=>{row.competence=competence.value});
    const type=document.createElement('select');
    type.setAttribute('aria-label',`Tipo do item ${index+1}`);
    [['deposit','Depósito mensal'],['thirteenth','Depósito do 13º'],['jam','Crédito JAM'],['withdrawal','Saque DEP'],['jamWithdrawal','Saque JAM'],['indemnity','DEP VERBAS IND'],['terminationPenalty','DEP MULTA RESCISÓRIA']].forEach(([value,label])=>{
      const option=document.createElement('option');option.value=value;option.textContent=label;type.append(option);
    });
    type.value=row.type;
    type.addEventListener('change',()=>{row.type=type.value});
    const amount=document.createElement('input');
    amount.type='text';amount.inputMode='decimal';amount.placeholder='0,00';
    amount.value=row.amount===null||row.amount===undefined?'':Number(row.amount).toFixed(2).replace('.',',');
    amount.setAttribute('aria-label',`Valor do item ${index+1}`);
    amount.addEventListener('input',()=>{row.amount=money(amount.value)});
    const date=document.createElement('input');
    date.type='date';date.value=row.date||'';
    date.setAttribute('aria-label',`Data do item ${index+1}`);
    date.addEventListener('input',()=>{row.date=date.value});
    const remove=document.createElement('button');
    remove.type='button';remove.className='btn ghost small';remove.textContent='Remover';
    remove.addEventListener('click',()=>{fgtsImportDraft.splice(index,1);renderFgtsImportDraft()});
    line.append(competence,type,amount,date,remove);
    list.append(line);
  });
  document.querySelector('#fgtsImportReview').classList.toggle('hidden',!fgtsImportDraft.length);
}
async function importFgtsStatement(file){
  const status=document.querySelector('#fgtsImportStatus');
  const review=document.querySelector('#fgtsImportReview');
  review.classList.add('hidden');fgtsImportDraft=[];fgtsImportAccount=null;
  if(!file)return;
  if(file.size>20*1024*1024){
    status.textContent='O arquivo excede o limite de 20 MB. Reduza a imagem ou exporte o extrato em PDF.';
    document.querySelector('#fgtsImportFile').value='';return;
  }
  const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(!file.type.startsWith('image/')&&!isPdf){
    status.textContent='Formato não suportado. Escolha um extrato em PDF ou imagem.';
    document.querySelector('#fgtsImportFile').value='';return;
  }
  status.textContent='Lendo extrato neste aparelho...';
  try{
    const text=isPdf?await loadPdfText(file,'#fgtsImportStatus'):await loadImageText(file,'#fgtsImportStatus');
    const parsed=parseFgtsStatement(text);
    fgtsImportDraft=parsed.rows;
    fgtsImportAccount=parsed.account;
    renderFgtsImportDraft();
    const balance=fgtsImportAccount.currentBalance===null?'':` Saldo final detectado: ${fmt.format(fgtsImportAccount.currentBalance)}${fgtsImportAccount.balanceDate?` em ${formatDate(fgtsImportAccount.balanceDate)}`:''}.`;
    status.textContent=fgtsImportDraft.length
      ?`Extrato de ${fgtsImportAccount.employer||'empregador não identificado'}${fgtsImportAccount.accountNumber?` · conta ${fgtsImportAccount.accountNumber}`:''}.${balance} Confira os lançamentos antes de aplicar.`
      :'Não encontrei movimentações FGTS identificáveis. Adicione as linhas manualmente e confira antes de aplicar.';
  }catch(error){
    console.error('Falha ao importar extrato FGTS:',error);
    status.textContent=error instanceof Error?error.message:'Não foi possível ler o extrato. Tente novamente ou preencha os lançamentos manualmente.';
  }finally{
    document.querySelector('#fgtsImportFile').value='';
  }
}
function applyFgtsImport(){
  let account=activeFgtsAccount();
  const byCompetence=new Map();
  for(const row of fgtsImportDraft){
    const match=/^(20\d{2})-(0[1-9]|1[0-2])$/.exec(row.competence||'');
    if(!match){alert('Escolha a competência de cada depósito/crédito antes de aplicar.');return}
    if(row.amount===null||!Number.isFinite(Number(row.amount))||Number(row.amount)<0){alert('Confira o valor de cada lançamento antes de aplicar.');return}
    const key=row.competence,year=Number(match[1]),month=Number(match[2]);
    const item=byCompetence.get(key)||{year,month,deposits:[],jam:[],thirteenth:[],withdrawals:[],jamWithdrawals:[],indemnities:[],terminationPenalties:[]};
    const group={
      jam:'jam',
      thirteenth:'thirteenth',
      withdrawal:'withdrawals',
      jamWithdrawal:'jamWithdrawals',
      indemnity:'indemnities',
      terminationPenalty:'terminationPenalties'
    }[row.type]||'deposits';
    item[group].push(row);
    byCompetence.set(key,item);
  }
  if(!byCompetence.size){alert('Adicione pelo menos um lançamento do extrato.');return}
  if(fgtsImportAccount?.employer){
    const employerKey=normalizePayrollText(fgtsImportAccount.employer).replace(/\s+/g,' ').trim();
    account=state.fgtsAccounts.find(item=>
      (fgtsImportAccount.accountNumber&&item.accountNumber===fgtsImportAccount.accountNumber)
      ||(normalizePayrollText(item.employer||'').replace(/\s+/g,' ').trim()===employerKey&&item.admissionDate===fgtsImportAccount.admissionDate)
    )||null;
    if(!account){
      account={
        id:uid(),
        employer:fgtsImportAccount.employer,
        accountNumber:fgtsImportAccount.accountNumber,
        admissionDate:fgtsImportAccount.admissionDate,
        terminationDate:fgtsImportAccount.terminationDate,
        currentBalance:null,
        balanceDate:'',
        years:{}
      };
      state.fgtsAccounts.push(account);
    }
    account.employer=fgtsImportAccount.employer||account.employer;
    account.accountNumber=fgtsImportAccount.accountNumber||account.accountNumber;
    account.admissionDate=fgtsImportAccount.admissionDate||account.admissionDate;
    account.terminationDate=fgtsImportAccount.terminationDate||account.terminationDate;
    if(fgtsImportAccount.currentBalance!==null){
      account.currentBalance=fgtsImportAccount.currentBalance;
      account.balanceDate=fgtsImportAccount.balanceDate||account.balanceDate;
    }
    const selectedAccount=activeFgtsAccount();
    if(!selectedAccount||selectedAccount.isLegacy||(selectedAccount.terminationDate&&!account.terminationDate)){
      state.activeFgtsAccountId=account.id;
    }
  }
  for(const {year,month,deposits,jam,thirteenth,withdrawals,jamWithdrawals,indemnities,terminationPenalties} of byCompetence.values()){
    const record=fgtsYearRecord(year,account);
    if(account?.admissionDate&&Number(account.admissionDate.slice(0,4))===year){
      record.startMonth=Math.max(Number(record.startMonth||1),Number(account.admissionDate.slice(5,7)));
    }
    if(account?.terminationDate&&Number(account.terminationDate.slice(0,4))===year){
      record.endMonth=Math.min(Number(record.endMonth||12),Number(account.terminationDate.slice(5,7)));
    }
    if(record.startMonth>record.endMonth)record.startMonth=record.endMonth;
    record.deposits=record.deposits||{};
    const current=record.deposits[String(month)]||{};
    const next={...current};
    if(deposits.length){
      next.paid=true;
      next.amount=round2(deposits.reduce((sum,row)=>sum+Number(row.amount),0));
      const depositDates=deposits.map(row=>row.date).filter(Boolean).sort();
      next.date=depositDates[depositDates.length-1]||current.date||'';
      next.imported=true;
    }
    if(jam.length){
      next.jam=round2(jam.reduce((sum,row)=>sum+Number(row.amount),0));
      const jamDates=jam.map(row=>row.date).filter(Boolean).sort();
      next.jamDate=jamDates[jamDates.length-1]||current.jamDate||'';
      next.jamImported=true;
    }
    if(withdrawals.length){
      next.withdrawal=round2(withdrawals.reduce((sum,row)=>sum+Number(row.amount),0));
      const withdrawalDates=withdrawals.map(row=>row.date).filter(Boolean).sort();
      next.withdrawalDate=withdrawalDates[withdrawalDates.length-1]||current.withdrawalDate||'';
      next.withdrawalImported=true;
    }
    if(jamWithdrawals.length){
      next.jamWithdrawal=round2(jamWithdrawals.reduce((sum,row)=>sum+Number(row.amount),0));
      const dates=jamWithdrawals.map(row=>row.date).filter(Boolean).sort();
      next.jamWithdrawalDate=dates[dates.length-1]||current.jamWithdrawalDate||'';
      next.jamWithdrawalImported=true;
    }
    if(indemnities.length){
      next.indemnity=round2(indemnities.reduce((sum,row)=>sum+Number(row.amount),0));
      const dates=indemnities.map(row=>row.date).filter(Boolean).sort();
      next.indemnityDate=dates[dates.length-1]||current.indemnityDate||'';
      next.indemnityImported=true;
    }
    if(terminationPenalties.length){
      next.terminationPenalty=round2(terminationPenalties.reduce((sum,row)=>sum+Number(row.amount),0));
      const dates=terminationPenalties.map(row=>row.date).filter(Boolean).sort();
      next.terminationPenaltyDate=dates[dates.length-1]||current.terminationPenaltyDate||'';
      next.terminationPenaltyImported=true;
    }
    if(deposits.length||jam.length||withdrawals.length||jamWithdrawals.length||indemnities.length||terminationPenalties.length)record.deposits[String(month)]=next;
    if(thirteenth.length){
      const currentThirteenth=record.deposits.thirteenth||{};
      const dates=thirteenth.map(row=>row.date).filter(Boolean).sort();
      record.deposits.thirteenth={
        ...currentThirteenth,
        paid:true,
        amount:round2(thirteenth.reduce((sum,row)=>sum+Number(row.amount),0)),
        date:dates[dates.length-1]||currentThirteenth.date||'',
        imported:true
      };
    }
  }
  save();renderAll();fgtsImportDraft=[];fgtsImportAccount=null;renderFgtsImportDraft();
  document.querySelector('#fgtsImportStatus').textContent=account?.employer
    ?`Extrato aplicado à conta ${account.employer}. O saldo atual consolidado considera um saldo por empregador, e os lançamentos/projeções anuais permanecem isolados por conta.`
    :'Lançamentos aplicados à projeção anual geral. Para incluir saldo real no total consolidado, importe o extrato completo com identificação do empregador.';
}
function payrollImportField(id,value){
  const input=document.querySelector(`#${id}`);
  input.value=value===null||value===undefined?'':Number(value).toFixed(2).replace('.',',');
}
async function importPayrollFile(file){
  const status=document.querySelector('#payrollImportStatus');
  const review=document.querySelector('#payrollImportReview');
  review.classList.add('hidden');
  if(!file)return;
  if(file.size>20*1024*1024){
    status.textContent='O arquivo excede o limite de 20 MB. Reduza a imagem ou exporte a folha em PDF.';
    document.querySelector('#payrollImportFile').value='';
    return;
  }
  const isPdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
  if(!file.type.startsWith('image/')&&!isPdf){
    status.textContent='Formato não suportado. Escolha um PDF ou uma imagem.';
    document.querySelector('#payrollImportFile').value='';
    return;
  }
  status.textContent='Lendo arquivo neste aparelho...';
  try{
    const text=isPdf?await loadPdfText(file):await loadImageText(file);
    const values=parsePayrollDocument(text);
    payrollImportField('payrollImportBase',values.baseSalary);
    payrollImportField('payrollImportGross',values.gross);
    payrollImportField('payrollImportAdvance',values.advance);
    payrollImportField('payrollImportInss',values.inss);
    payrollImportField('payrollImportIrrf',values.irrf);
    payrollImportField('payrollImportNet',values.finalPay);
    review.classList.remove('hidden');
    const labels={baseSalary:'salário-base',gross:'remuneração bruta',advance:'adiantamento',inss:'INSS',irrf:'IRRF',finalPay:'líquido a receber'};
    const recognized=Object.entries(values).filter(([,value])=>value!==null).map(([key])=>labels[key]);
    status.textContent=recognized.length
      ?`Reconheci: ${recognized.join(', ')}. Competência selecionada: ${MONTHS[simCursor.getMonth()]} de ${simCursor.getFullYear()}. Revise os valores antes de aplicar.`
      :'Não encontrei os valores automaticamente. Os campos de revisão estão abertos para você preencher e conferir antes de aplicar.';
  }catch(error){
    console.error('Falha ao importar folha:',error);
    status.textContent=error instanceof Error?error.message:'Não foi possível ler a folha. Tente novamente ou preencha os valores manualmente.';
  }finally{
    document.querySelector('#payrollImportFile').value='';
  }
}
function applyPayrollImport(){
  const grossText=document.querySelector('#payrollImportGross').value.trim();
  const baseText=document.querySelector('#payrollImportBase').value.trim();
  if(!grossText||money(grossText)<=0){
    alert('Informe e confira a remuneração bruta reconhecida na folha.');
    document.querySelector('#payrollImportGross').focus();
    return;
  }
  if(baseText&&money(baseText)>0)state.payrollConfig.baseSalary=money(baseText);
  const monthCfg=payrollMonthConfig();
  const advanceText=document.querySelector('#payrollImportAdvance').value.trim();
  const inssText=document.querySelector('#payrollImportInss').value.trim();
  const irrfText=document.querySelector('#payrollImportIrrf').value.trim();
  const finalPayText=document.querySelector('#payrollImportNet').value.trim();
  const baseSalary=baseText?money(baseText):Number(state.payrollConfig.baseSalary||0);
  monthCfg.importedPayroll={
    baseSalary,
    gross:money(grossText),
    advance:advanceText?money(advanceText):null,
    inss:inssText?money(inssText):null,
    irrf:irrfText?money(irrfText):null,
    finalPay:finalPayText?money(finalPayText):null,
    importedAt:new Date().toISOString()
  };
  save();
  renderAll();
  document.querySelector('#payrollImportReview').classList.add('hidden');
  document.querySelector('#payrollImportStatus').textContent=`Folha aplicada à competência ${MONTHS[simCursor.getMonth()]} de ${simCursor.getFullYear()}. O bruto importado será usado no 13º e no FGTS.`;
  document.querySelector('#clearPayrollImport').classList.remove('hidden');
}
function clearPayrollImport(){
  const monthCfg=payrollMonthConfig(simKey(),false);
  if(!monthCfg.importedPayroll)return;
  delete monthCfg.importedPayroll;
  save();
  renderAll();
  document.querySelector('#payrollImportStatus').textContent=`Importação removida de ${MONTHS[simCursor.getMonth()]} de ${simCursor.getFullYear()}; a competência voltou ao cálculo manual.`;
  document.querySelector('#clearPayrollImport').classList.add('hidden');
}
function payrollMonthConfig(k=simKey(),create=true){
  if(state.payrollMonths[k])return state.payrollMonths[k];
  if(!create)return {holidayCount:0,referenceHours:null};
  state.payrollMonths[k]={holidayCount:0,referenceHours:null};
  return state.payrollMonths[k];
}
function payrollTaxEstimate(base){
  const gross=Number(base||0);
  const inss=inss2026(gross);
  const ir=irrf2026(gross,inss);
  return {gross, inss, ir:ir.value, net:round2(gross-inss-ir.value)};
}
function annualRecord(records,year,defaults){
  const key=String(year);
  if(!records[key])records[key]=defaults;
  return records[key];
}
function thirteenthYearRecord(year){
  return annualRecord(state.thirteenthByYear,year,{
    startMonth:year===2026?5:1,
    endMonth:12,
    firstDate:year===2026?'2026-07-23':`${year}-11-30`,
    secondDate:`${year}-12-18`,
    firstAmount:null,
    secondAmount:null,
    firstPaid:year===2026,
    secondPaid:false
  });
}
function activeFgtsAccount(){
  return state.fgtsAccounts.find(account=>account.id===state.activeFgtsAccountId)||null;
}
function fgtsYearRecord(year,account=activeFgtsAccount()){
  const records=account?account.years:state.fgtsByYear;
  const admission=account?.admissionDate;
  const termination=account?.terminationDate;
  const startMonth=admission
    ?Number(admission.slice(0,4))===Number(year)?Number(admission.slice(5,7)):Number(admission.slice(0,4))<Number(year)?1:12
    :year===2026?5:1;
  const endMonth=termination&&Number(termination.slice(0,4))===Number(year)?Number(termination.slice(5,7)):12;
  return annualRecord(records,year,{startMonth,endMonth,deposits:{}});
}
function fgtsAccountBreakdown(account,asOf=''){
  if(!account||account.isLegacy)return null;
  if(!asOf){
    const now=new Date();
    asOf=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }
  const snapshot=Number(account.currentBalance)||0;
  const snapshotDate=account.balanceDate||'';
  const totals={snapshot,hasSnapshot:account.currentBalance!==null&&account.currentBalance!==undefined,
    snapshotDate,deposits:0,credits:0,withdrawals:0,futureConfirmed:0};
  const counts=(date)=>{
    if(!date||date<=snapshotDate)return false;
    if(date>asOf)return false;
    return true;
  };
  const plus=(field,amount,date)=>{
    const value=Number(amount)||0;
    if(value>0&&counts(date))totals[field]=round2(totals[field]+value);
  };
  const future=(amount,date)=>{
    const value=Number(amount)||0;
    if(value>0&&date>asOf&&date>snapshotDate)totals.futureConfirmed=round2(totals.futureConfirmed+value);
  };
  for(const [yearText,yearRecord] of Object.entries(account.years||{})){
    const year=Number(yearText);
    if(!Number.isInteger(year)||!yearRecord?.deposits)continue;
    for(const [monthText,entry] of Object.entries(yearRecord.deposits)){
      if(monthText==='thirteenth'||!(/^(0?[1-9]|1[0-2])$/.test(monthText)))continue;
      const month=Number(monthText);
      const fallback=`${year}-${String(month).padStart(2,'0')}-${String(new Date(year,month,0).getDate()).padStart(2,'0')}`;
      const date=entry.date||fallback;
      if(entry.paid){plus('deposits',entry.amount,date);future(entry.amount,date)}
      plus('credits',entry.jam,entry.jamDate||date);
      plus('credits',entry.indemnity,entry.indemnityDate||date);
      plus('credits',entry.terminationPenalty,entry.terminationPenaltyDate||date);
      plus('withdrawals',entry.withdrawal,entry.withdrawalDate||date);
      plus('withdrawals',entry.jamWithdrawal,entry.jamWithdrawalDate||date);
    }
    const thirteenth=yearRecord.deposits.thirteenth;
    if(thirteenth){
      const date=thirteenth.date||`${year}-12-31`;
      if(thirteenth.paid){plus('deposits',thirteenth.amount,date);future(thirteenth.amount,date)}
      plus('credits',thirteenth.jam,thirteenth.jamDate||date);
    }
  }
  totals.netOther=round2(totals.credits-totals.withdrawals);
  totals.balance=round2(snapshot+totals.deposits+totals.netOther);
  return totals;
}
function fgtsAccountBalance(account){
  return fgtsAccountBreakdown(account)?.balance??null;
}
function fgtsAccountProjectedBalance(account){
  if(account.isLegacy)return null;
  let projected=fgtsAccountBalance(account);
  if(account.terminationDate)return projected;
  const year=today.getFullYear();
  if(account.admissionDate&&Number(account.admissionDate.slice(0,4))>year)return projected;
  const record=fgtsYearRecord(year,account);
  const firstMonth=Math.max(
    Number(record.startMonth||1),
    today.getMonth()+1,
    account.admissionDate&&Number(account.admissionDate.slice(0,4))===year?Number(account.admissionDate.slice(5,7)):1
  );
  const lastMonth=Number(record.endMonth||12);
  const todayKey=`${year}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  for(let month=firstMonth;month<=lastMonth;month++){
    const deposit=record.deposits?.[String(month)]||{};
    const defaultDate=`${year}-${String(month).padStart(2,'0')}-${String(new Date(year,month,0).getDate()).padStart(2,'0')}`;
    const date=deposit.date||defaultDate;
    if(date<=todayKey||account.balanceDate&&date<=account.balanceDate)continue;
    const payroll=payrollSimulation(`${year}-${String(month).padStart(2,'0')}`,false);
    projected+=Number(deposit.amount??round2(payroll.gross*0.08));
  }
  const thirteenthDeposit=record.deposits?.thirteenth||{};
  const thirteenthDate=thirteenthDeposit.date||`${year}-12-18`;
  if(thirteenthDate>todayKey&&(!account.balanceDate||thirteenthDate>account.balanceDate)){
    const annual=thirteenthYearRecord(year);
    const thirteenth=thirteenthCalculation(year,annual.startMonth,annual.endMonth);
    projected+=Number(thirteenthDeposit.amount??round2(thirteenth.gross*0.08));
  }
  return round2(projected);
}
function renderFgtsAccounts(){
  const totalEl=document.querySelector('#fgtsAccountsTotal');
  const projectedTotalEl=document.querySelector('#fgtsProjectedBalance');
  const countEl=document.querySelector('#fgtsAccountsCount');
  const list=document.querySelector('#fgtsAccountList');
  const selectorWrap=document.querySelector('#fgtsAccountSelectorWrap');
  const selector=document.querySelector('#fgtsAccountSelect');
  const accounts=state.fgtsAccounts;
  const activeAccounts=accounts.filter(account=>!account.isLegacy);
  // O histórico antigo não pode ser a seleção padrão quando existem contas reais.
  if(activeAccounts.length&&!activeAccounts.some(account=>account.id===state.activeFgtsAccountId)){
    const preferred=activeAccounts.find(account=>!account.terminationDate)||activeAccounts[0];
    state.activeFgtsAccountId=preferred.id;
  }
  const selected=activeFgtsAccount();
  const selectedBox=document.querySelector('#fgtsSelectedCompanySummary');
  const breakdown=fgtsAccountBreakdown(selected);
  selectedBox.classList.toggle('hidden',!breakdown);
  if(breakdown){
    document.querySelector('#fgtsSelectedSnapshot').textContent=fmt.format(breakdown.snapshot);
    document.querySelector('#fgtsSelectedSnapshotDate').textContent=breakdown.hasSnapshot
      ?breakdown.snapshotDate?`Extrato de ${formatDate(breakdown.snapshotDate)}`:'Último saldo registrado (sem data)'
      :'Sem saldo de extrato importado; total formado pelos lançamentos manuais.';
    document.querySelector('#fgtsSelectedDeposits').textContent=fmt.format(breakdown.deposits);
    document.querySelector('#fgtsSelectedMovements').textContent=fmt.format(breakdown.netOther);
    document.querySelector('#fgtsSelectedBalance').textContent=fmt.format(breakdown.balance);
    const notes=[];
    if(breakdown.snapshotDate)notes.push('Somente movimentações posteriores à data do extrato entram na soma.');
    if(breakdown.futureConfirmed)notes.push(`${fmt.format(breakdown.futureConfirmed)} marcado como depositado com data futura: ainda fora do saldo atual.`);
    notes.push('Valores previstos ficam fora do saldo atual para evitar dupla contagem.');
    document.querySelector('#fgtsSelectedCompanyNote').textContent=notes.join(' ');
  }
  const withBalance=activeAccounts.filter(account=>account.currentBalance!==null&&account.currentBalance!==undefined);
  const totalBalance=round2(activeAccounts.reduce((sum,account)=>sum+fgtsAccountBalance(account),0));
  const projectedTotal=round2(activeAccounts.reduce((sum,account)=>sum+fgtsAccountProjectedBalance(account),0));
  totalEl.textContent=fmt.format(totalBalance);
  projectedTotalEl.textContent=fmt.format(projectedTotal);
  countEl.textContent=withBalance.length
    ?`${withBalance.length} saldo(s) de extrato + movimentações posteriores confirmadas`
    :'Importe os extratos de cada empregador para compor o saldo total da Caixa.';
  list.innerHTML=accounts.length?accounts.map(account=>{
    const details=account.isLegacy
      ?'Histórico anterior preservado; reimporte cada extrato para separar empregadores.'
      :[
      account.accountNumber?`Conta ${escapeHtml(account.accountNumber)}`:'',
      account.admissionDate?`Admissão ${formatDate(account.admissionDate)}`:'',
      account.terminationDate?`Afastamento ${formatDate(account.terminationDate)}`:'Vínculo ativo'
    ].filter(Boolean).join(' · ');
    const balance=account.isLegacy
      ?'<strong>Fora do saldo consolidado</strong><span>Sem identificação individual</span>'
      :account.currentBalance===null||account.currentBalance===undefined
        ?`<strong>${fmt.format(fgtsAccountBalance(account))}</strong><span>Depósitos confirmados lançados manualmente</span>`
      :`<strong>${fmt.format(fgtsAccountBalance(account))}</strong><span>${account.balanceDate?`Saldo do extrato em ${formatDate(account.balanceDate)}`:'Saldo do extrato'}${fgtsAccountBalance(account)!==Number(account.currentBalance)?` · atualizado com lançamentos posteriores`:''}</span>`;
    return `<div class="item"><span class="item-icon">▣</span><span class="item-main"><strong>${escapeHtml(account.employer||'Empregador não identificado')}</strong><span>${details||'Conta importada'}</span></span><span class="item-side">${balance}</span></div>`;
  }).join(''):'<div class="empty">Ainda não há contas importadas. Importe um extrato completo por empregador para registrar seu saldo real.</div>';
  selectorWrap.classList.toggle('hidden',!accounts.length);
  selector.innerHTML=[...activeAccounts,...accounts.filter(account=>account.isLegacy)].map(account=>`<option value="${escapeHtml(account.id)}">${escapeHtml(account.employer||'Empregador não identificado')}${account.isLegacy?' (não compõe o saldo total)':''}</option>`).join('');
  selector.value=state.activeFgtsAccountId;
  selector.onchange=()=>{
    state.activeFgtsAccountId=selector.value;
    save();
    renderFgts();
  };
}
function extraCompensationForMonth(year,month){
  const monthValue=`${year}-${String(month).padStart(2,'0')}`;
  return payrollSimulation(monthValue,false).extras;
}
function thirteenthCalculation(year,startMonth,endMonth){
  const monthsWorked=Math.max(0,endMonth-startMonth+1);
  const baseShare=round2(Number(state.payrollConfig.baseSalary||0)*monthsWorked/12);
  let extraTotal=0;
  for(let month=startMonth;month<=endMonth;month++){
    const key=`${year}-${String(month).padStart(2,'0')}`;
    const payroll=payrollSimulation(key,false);
    extraTotal=round2(extraTotal+payroll.extras);
  }
  const extraAverage=monthsWorked?round2(extraTotal/monthsWorked):0;
  const extraShare=round2(extraTotal/12);
  const gross=round2(baseShare+extraShare);
  const tax=payrollTaxEstimate(gross);
  const first=round2(baseShare/2);
  return {
    monthsWorked,
    baseShare,
    extraAverage,
    extraShare,
    gross,
    first,
    second:round2(Math.max(0,tax.net-first)),
    deductions:round2(gross-tax.net),
    net:tax.net
  };
}
function payrollSimulation(k=simKey(),createMonthConfig=true){
  const cfg = state.payrollConfig,
      monthCfg = payrollMonthConfig(k,createMonthConfig);
  const imported=monthCfg.importedPayroll||null;

const logs = state.overtimeLogs.filter(
  x => payrollCompetenceKey(x.date) === k
);
  let h50=0,h100=0,night=0;
  logs.forEach(r=>{const c=calculateExtraRecord(r);h50+=c.hours50;h100+=c.hours100;night+=c.nightHours});
  if(monthCfg.referenceHours&&logs.length===0){h50=Number(monthCfg.referenceHours.h50||0);h100=Number(monthCfg.referenceHours.h100||0);night=Number(monthCfg.referenceHours.night||0)}
  const baseSalary=Number(imported?.baseSalary??cfg.baseSalary??0);
  const hourBase=baseSalary/Math.max(1,Number(cfg.monthlyHours||220));
  const v50=round2(h50*hourBase*1.5),v100=round2(h100*hourBase*2),nightValue=round2(night*hourBase*(Number(cfg.nightPct||20)/100));
  const extraBase=round2(v50+v100+nightValue),calendar=getDSRCalendar(k),restDays=calendar.sundays,workDays=Math.max(1,calendar.totalDays-calendar.sundays),dsr=round2(extraBase/workDays*restDays);
  let extras=round2(extraBase+dsr),gross=round2(baseSalary+extras),inss=inss2026(gross),ir=irrf2026(gross,inss),netMonth=round2(gross-inss-ir.value),advance=Number(cfg.advance||0),finalPay=round2(netMonth-advance);
  if(imported){
    gross=round2(Number(imported.gross));
    extras=round2(gross-baseSalary);
    inss=imported.inss===null?inss2026(gross):Number(imported.inss);
    ir=irrf2026(gross,inss);
    if(imported.irrf!==null)ir.value=Number(imported.irrf);
    advance=imported.advance===null?advance:Number(imported.advance);
    netMonth=round2(gross-inss-ir.value);
    finalPay=imported.finalPay===null?round2(netMonth-advance):Number(imported.finalPay);
  }
  return {k,baseSalary,h50,h100,night,hourBase,v50,v100,nightValue,extraBase,sundays:calendar.sundays,holidays:0,automaticHolidays:0,manualHolidays:0,restDays,workDays,dsr,extras,gross,inss,ir,netMonth,advance,finalPay,logs,reference:monthCfg.referenceHours&&logs.length===0,imported:!!imported};
}
function renderSimulator(){
  const referenceButton=document.querySelector('#loadJulyReference');if(referenceButton)referenceButton.textContent='Referência set/26';
  document.querySelector('#simMonthLabel').textContent=`${MONTHS[simCursor.getMonth()]} ${simCursor.getFullYear()}`;
  const cfg=state.payrollConfig,monthCfg=payrollMonthConfig();document.querySelector('#simBaseSalary').value=Number(cfg.baseSalary).toFixed(2).replace('.',',');document.querySelector('#simMonthlyHours').value=cfg.monthlyHours;document.querySelector('#simAdvance').value=Number(monthCfg.importedPayroll?.advance??cfg.advance).toFixed(2).replace('.',',');document.querySelector('#simHolidayCount').value=monthCfg.holidayCount||0;document.querySelector('#simNightPct').value=cfg.nightPct;document.querySelector('#simExtraGoal').value=cfg.extraGoal||0;
  const p=payrollSimulation();
  const importStatus=document.querySelector('#payrollImportStatus');
  const clearImportButton=document.querySelector('#clearPayrollImport');
  if(importStatus&&p.imported)importStatus.textContent=`Folha importada e aplicada para ${MONTHS[simCursor.getMonth()]} de ${simCursor.getFullYear()}. Valores anuais usam o bruto reconhecido.`;
  else if(importStatus)importStatus.textContent='Nenhuma folha importada para esta competência.';
  if(clearImportButton)clearImportButton.classList.toggle('hidden',!p.imported);
  document.querySelector('#simHours50').textContent=hoursLabel(p.h50);document.querySelector('#simValue50').textContent=fmt.format(p.v50);document.querySelector('#simHours100').textContent=hoursLabel(p.h100);document.querySelector('#simValue100').textContent=fmt.format(p.v100);document.querySelector('#simNightHours').textContent=hoursLabel(p.night);document.querySelector('#simNightValue').textContent=fmt.format(p.nightValue);setMoney('simDsrValue',p.dsr);document.querySelector('#simDsrDetail').textContent=`${p.restDays} DSR / ${p.workDays} dias no divisor`;
  setMoney('payBase',state.payrollConfig.baseSalary);setMoney('payExtras',p.extras);setMoney('payGross',p.gross);document.querySelector('#payInss').textContent=`− ${fmt.format(p.inss)}`;document.querySelector('#payIrrf').textContent=`− ${fmt.format(p.ir.value)}`;setMoney('payNetMonth',p.netMonth);document.querySelector('#payAdvance').textContent=`− ${fmt.format(p.advance)}`;setMoney('payFinal',p.finalPay);
  document.querySelector('#payrollReferenceNote').textContent=p.reference?'Referência de setembro/2026 carregada: 60h00 de HE 50%, 0h00 de HE 100% e 6h00 de adicional noturno. A calibração reproduz o holerite de setembro.':'INSS e IRRF usam as tabelas de 2026; o DSR da simulação segue o padrão observado no holerite de setembro, usando os domingos do mês.';
  const records=[...p.logs].sort((a,b)=>b.date.localeCompare(a.date));
  let refHtml='';if(p.reference)refHtml=`<div class="item"><span class="item-icon">✓</span><span class="item-main"><strong>Referência do contracheque — setembro/2026</strong><span>60h00 HE50 · 0h00 HE100 · 6h00 noturno</span></span><span class="item-side"><strong>${fmt.format(p.extras)}</strong><span>Calibração</span></span></div>`;
  document.querySelector('#extraList').innerHTML=refHtml+(records.length?records.map(r=>{const c=calculateExtraRecord(r);return `<button class="item" data-extra-edit="${r.id}" style="width:100%;text-align:left;cursor:pointer"><span class="item-icon">⌁</span><span class="item-main"><strong>${escapeHtml(r.description)}</strong><span>${formatDate(r.date)} · ${r.start}–${r.end}${r.holiday?' · HE 100%':''}</span></span><span class="item-side"><strong>${hoursLabel(c.minutes/60)}</strong><span>${c.is100?'100%':'50%'}${c.nightHours?` · ${hoursLabel(c.nightHours)} not.`:''}</span></span></button>`}).join(''):'');
  if(!p.reference&&!records.length)document.querySelector('#extraList').innerHTML='<div class="empty">Nenhuma hora extra registrada nesta competência.</div>';
}

function populateMonthSelect(select,selected){
  select.innerHTML=MONTHS.map((month,index)=>`<option value="${index+1}">${month}</option>`).join('');
  select.value=String(selected);
}
function thirteenthTransaction(year,part){
  return state.transactions.find(t=>t.payrollSource===`thirteenth-${year}-${part}`);
}
function renderThirteenth(preserveSelection=false){
  const year=thirteenthViewYear,record=thirteenthYearRecord(year);
  const startMonth=preserveSelection?Number(document.querySelector('#thirteenthStartMonth').value):record.startMonth||1;
  const endMonth=preserveSelection?Number(document.querySelector('#thirteenthEndMonth').value):record.endMonth||12;
  document.querySelector('#thirteenthYearLabel').textContent=String(year);
  populateMonthSelect(document.querySelector('#thirteenthStartMonth'),startMonth);
  populateMonthSelect(document.querySelector('#thirteenthEndMonth'),endMonth);
  const calc=thirteenthCalculation(year,startMonth,endMonth);
  const firstTx=thirteenthTransaction(year,'first');
  const secondTx=thirteenthTransaction(year,'second');
  const firstAmount=firstTx?.amount??record.firstAmount??calc.first;
  const defaultSecond=round2(Math.max(0,calc.net-Number(firstAmount||0)));
  const secondAmount=secondTx?.status==='realized'
    ?secondTx.amount
    :defaultSecond;
  const firstDate=firstTx?.date||record.firstDate;
  const secondDate=secondTx?.date||record.secondDate;
  document.querySelector('#thirteenthSalaryBase').textContent=`Base mensal bruta da simulação: ${fmt.format(Number(state.payrollConfig.baseSalary||0))}, acrescida dos adicionais e DSR brutos de cada competência. Líquido e valor após adiantamento não compõem o 13º bruto.`;
  document.querySelector('#thirteenthMonthsCount').textContent=String(calc.monthsWorked);
  document.querySelector('#thirteenthBaseShare').textContent=fmt.format(calc.baseShare);
  document.querySelector('#thirteenthExtraShare').textContent=`${fmt.format(calc.extraAverage)} / mês · ${fmt.format(calc.extraShare)} no 13º`;
  document.querySelector('#thirteenthGross').textContent=fmt.format(calc.gross);
  document.querySelector('#thirteenthFirstEstimate').textContent=fmt.format(firstAmount);
  document.querySelector('#thirteenthSecondEstimate').textContent=fmt.format(Math.max(0,calc.net-Number(firstAmount||0)));
  document.querySelector('#thirteenthDeductions').textContent=fmt.format(calc.deductions);
  document.querySelector('#thirteenthExtrasNote').textContent=`Parcela variável estimada pelas horas extras registradas entre ${MONTHS[startMonth-1]} e ${MONTHS[endMonth-1]}, incluindo DSR aproximado. Os descontos usam as tabelas 2026 disponíveis no simulador e são apenas estimativas; confira a folha oficial.`;
  document.querySelector('#thirteenthFirstAmount').value=Number(firstAmount).toFixed(2).replace('.',',');
  document.querySelector('#thirteenthSecondAmount').value=Number(secondAmount).toFixed(2).replace('.',',');
  document.querySelector('#thirteenthFirstDate').value=firstDate||'';
  document.querySelector('#thirteenthSecondDate').value=secondDate||'';
  document.querySelector('#thirteenthFirstPaid').checked=firstTx?firstTx.status==='realized':!!record.firstPaid;
  document.querySelector('#thirteenthSecondPaid').checked=secondTx?secondTx.status==='realized':!!record.secondPaid;
  document.querySelector('#thirteenthStatus').textContent=secondTx?.status==='realized'
    ?'A 1ª parcela é estimada em 50% do salário proporcional, sem descontos. As horas extras aumentam o 13º bruto e entram no ajuste da 2ª parcela, junto com os descontos. Como a 2ª parcela já está marcada como recebida, o valor do lançamento é preservado.'
    :'A 1ª parcela é estimada em 50% do salário proporcional, sem extras ou descontos. A média de extras aumenta o 13º bruto e é considerada no ajuste da 2ª parcela, que desconta o valor já recebido e os tributos estimados.';
}
function renderFgts(){
  renderFgtsAccounts();
  const account=activeFgtsAccount();
  const year=fgtsViewYear,record=fgtsYearRecord(year,account),startMonth=Number(record.startMonth||1),endMonth=Number(record.endMonth||12);
  document.querySelector('#fgtsYearLabel').textContent=String(year);
  document.querySelector('#fgtsYearContext').textContent=account?.employer||'Projeção anual geral';
  populateMonthSelect(document.querySelector('#fgtsStartMonth'),startMonth);
  populateMonthSelect(document.querySelector('#fgtsEndMonth'),endMonth);
  const beforeAdmission=account&&!account.isLegacy&&account.admissionDate&&year<Number(account.admissionDate.slice(0,4));
  const afterTermination=account&&!account.isLegacy&&account.terminationDate&&year>Number(account.terminationDate.slice(0,4));
  const outsideEmployment=!!(beforeAdmission||afterTermination);
  const canEstimate=!outsideEmployment&&(!account||account.isLegacy===true||(!account.terminationDate&&year>=today.getFullYear()));
  const monthly=[];
  if(!outsideEmployment&&startMonth<=endMonth){
    for(let month=startMonth;month<=endMonth;month++){
      const monthValue=`${year}-${String(month).padStart(2,'0')}`;
      const monthPayroll=payrollSimulation(monthValue,false);
      const amount=canEstimate?round2(monthPayroll.gross*0.08):0;
      const deposit=record.deposits?.[String(month)]||{};
      monthly.push({month,amount,deposit});
    }
  }
  const total=round2(monthly.reduce((sum,item)=>sum+(item.deposit.paid?Number(item.deposit.amount??item.amount):item.amount),0));
  const thirteenthRecord=thirteenthYearRecord(year);
  const thirteenth=thirteenthCalculation(year,thirteenthRecord.startMonth,thirteenthRecord.endMonth);
  const thirteenthFgts=canEstimate&&startMonth<=endMonth?round2(thirteenth.gross*0.08):0;
  const thirteenthDeposit=record.deposits?.thirteenth||{};
  const projectedThirteenth=thirteenthDeposit.paid?Number(thirteenthDeposit.amount??thirteenthFgts):thirteenthFgts;
  const indemnityTotal=round2(monthly.reduce((sum,item)=>sum+Number(item.deposit.indemnity||0),0));
  const terminationPenaltyTotal=round2(monthly.reduce((sum,item)=>sum+Number(item.deposit.terminationPenalty||0),0));
  const annualTotal=round2(total+projectedThirteenth+indemnityTotal+terminationPenaltyTotal);
  const paid=round2(
    monthly.reduce((sum,item)=>sum+(item.deposit.paid?Number(item.deposit.amount??item.amount):0)+Number(item.deposit.indemnity||0)+Number(item.deposit.terminationPenalty||0),0)
    +(thirteenthDeposit.paid?Number(thirteenthDeposit.amount??thirteenthFgts):0)
  );
  const jamTotal=round2(monthly.reduce((sum,item)=>sum+Number(item.deposit.jam||0),0)+Number(thirteenthDeposit.jam||0));
  const withdrawalsTotal=round2(monthly.reduce((sum,item)=>sum+Number(item.deposit.withdrawal||0),0));
  const jamWithdrawalsTotal=round2(monthly.reduce((sum,item)=>sum+Number(item.deposit.jamWithdrawal||0),0));
  const netPeriod=round2(annualTotal+jamTotal-withdrawalsTotal-jamWithdrawalsTotal);
  document.querySelector('#fgtsYearTotal').textContent=fmt.format(annualTotal);
  document.querySelector('#fgtsPaidTotal').textContent=fmt.format(paid);
  document.querySelector('#fgtsPendingTotal').textContent=fmt.format(Math.max(0,annualTotal-paid));
  document.querySelector('#fgtsThirteenthTotal').textContent=fmt.format(thirteenthFgts);
  document.querySelector('#fgtsJamTotal').textContent=fmt.format(jamTotal);
  document.querySelector('#fgtsWithdrawalsTotal').textContent=fmt.format(withdrawalsTotal);
  document.querySelector('#fgtsJamWithdrawalsTotal').textContent=fmt.format(jamWithdrawalsTotal);
  document.querySelector('#fgtsIndemnityTotal').textContent=fmt.format(indemnityTotal);
  document.querySelector('#fgtsTerminationPenaltyTotal').textContent=fmt.format(terminationPenaltyTotal);
  document.querySelector('#fgtsNetPeriod').textContent=fmt.format(netPeriod);
  const monthlyRows=monthly.map(({month,amount,deposit})=>{
    const lastDay=new Date(year,month,0).getDate();
    const defaultDate=`${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    return `<div class="item fgts-month-row">
      <span class="item-icon">▣</span>
      <span class="item-main"><strong>${MONTHS[month-1]}</strong><span>${deposit.paid?'Depositado:':canEstimate?'Estimativa:':'Sem depósito importado'} ${fmt.format(deposit.paid?Number(deposit.amount??amount):amount)}${Number(deposit.jam||0)?` · JAM: ${fmt.format(deposit.jam)}`:''}${Number(deposit.withdrawal||0)?` · Saque DEP: ${fmt.format(deposit.withdrawal)}`:''}${Number(deposit.jamWithdrawal||0)?` · Saque JAM: ${fmt.format(deposit.jamWithdrawal)}`:''}${Number(deposit.indemnity||0)?` · Verbas IND: ${fmt.format(deposit.indemnity)}`:''}${Number(deposit.terminationPenalty||0)?` · Multa rescisória: ${fmt.format(deposit.terminationPenalty)}`:''}</span></span>
      <span class="item-side fgts-deposit-controls">
        <label class="check-row"><input type="checkbox" data-fgts-paid="${month}" ${deposit.paid?'checked':''}> Depositado</label>
        <input type="text" inputmode="decimal" aria-label="Valor do FGTS de ${MONTHS[month-1]}" data-fgts-amount="${month}" value="${Number(deposit.amount??amount).toFixed(2).replace('.',',')}">
        <input type="date" aria-label="Data do depósito ${MONTHS[month-1]}" data-fgts-date="${month}" value="${deposit.date||defaultDate}">
        <label class="fgts-jam-field">Crédito JAM<input type="text" inputmode="decimal" aria-label="Crédito JAM de ${MONTHS[month-1]}" data-fgts-jam="${month}" value="${Number(deposit.jam||0)?Number(deposit.jam).toFixed(2).replace('.',','):''}" placeholder="0,00"></label>
        <label class="fgts-jam-field">Saque DEP (opcional)<input type="text" inputmode="decimal" aria-label="Saque DEP de ${MONTHS[month-1]}" data-fgts-withdrawal="${month}" value="${Number(deposit.withdrawal||0)?Number(deposit.withdrawal).toFixed(2).replace('.',','):''}" placeholder="0,00"></label>
        <label class="fgts-jam-field">Saque JAM (opcional)<input type="text" inputmode="decimal" aria-label="Saque JAM de ${MONTHS[month-1]}" data-fgts-jam-withdrawal="${month}" value="${Number(deposit.jamWithdrawal||0)?Number(deposit.jamWithdrawal).toFixed(2).replace('.',','):''}" placeholder="0,00"></label>
        <label class="fgts-jam-field">DEP VERBAS IND<input type="text" inputmode="decimal" aria-label="DEP VERBAS IND de ${MONTHS[month-1]}" data-fgts-indemnity="${month}" value="${Number(deposit.indemnity||0)?Number(deposit.indemnity).toFixed(2).replace('.',','):''}" placeholder="0,00"></label>
        <label class="fgts-jam-field">DEP MULTA RESCISÓRIA<input type="text" inputmode="decimal" aria-label="DEP MULTA RESCISÓRIA de ${MONTHS[month-1]}" data-fgts-termination-penalty="${month}" value="${Number(deposit.terminationPenalty||0)?Number(deposit.terminationPenalty).toFixed(2).replace('.',','):''}" placeholder="0,00"></label>
      </span>
    </div>`;
  });
  if(!outsideEmployment&&startMonth<=endMonth){
    monthlyRows.push(`<div class="item fgts-month-row">
      <span class="item-icon">13</span>
      <span class="item-main"><strong>13º salário</strong><span>Estimativa: ${fmt.format(thirteenthFgts)}</span></span>
      <span class="item-side fgts-deposit-controls">
        <label class="check-row"><input type="checkbox" data-fgts-thirteenth-paid ${thirteenthDeposit.paid?'checked':''}> Depositado</label>
        <input type="text" inputmode="decimal" aria-label="Valor do FGTS sobre o 13º" data-fgts-thirteenth-amount value="${Number(thirteenthDeposit.amount??thirteenthFgts).toFixed(2).replace('.',',')}">
        <input type="date" aria-label="Data do depósito do FGTS sobre o 13º" data-fgts-thirteenth-date value="${thirteenthDeposit.date||`${year}-12-18`}">
        <label class="fgts-jam-field">Crédito JAM<input type="text" inputmode="decimal" aria-label="Crédito JAM sobre o 13º" data-fgts-thirteenth-jam value="${Number(thirteenthDeposit.jam||0)?Number(thirteenthDeposit.jam).toFixed(2).replace('.',','):''}" placeholder="0,00"></label>
      </span>
    </div>`);
  }
  document.querySelector('#fgtsMonthList').innerHTML=monthlyRows.length
    ?monthlyRows.join('')
    :`<div class="empty">${outsideEmployment?'Este vínculo ainda não existia ou já havia terminado neste ano.':'O mês inicial deve ser anterior ou igual ao mês final.'}</div>`;
}
function syncThirteenthTransaction(year,part,record){
  const suffix=part==='first'?'1ª':'2ª';
  const marker=`thirteenth-${year}-${part}`;
  let transaction=state.transactions.find(t=>t.payrollSource===marker);
  const amount=Number(part==='first'?record.firstAmount:record.secondAmount);
  const date=part==='first'?record.firstDate:record.secondDate;
  const paid=!!record[`${part}Paid`];
  const data={
    id:transaction?.id||uid(),
    kind:'income',
    incomeType:'extra',
    description:`13º salário - ${suffix} parcela`,
    amount,
    date,
    status:paid?'realized':'planned',
    payrollSource:marker
  };
  if(transaction)Object.assign(transaction,data);
  else state.transactions.push(data);
}
function saveThirteenth(){
  const year=thirteenthViewYear;
  const record=thirteenthYearRecord(year);
  record.startMonth=Number(document.querySelector('#thirteenthStartMonth').value);
  record.endMonth=Number(document.querySelector('#thirteenthEndMonth').value);
  if(record.startMonth>record.endMonth){
    alert('O mês inicial deve ser anterior ou igual ao mês final.');
    return;
  }
  const calc=thirteenthCalculation(year,record.startMonth,record.endMonth);
  const firstAmountInput=document.querySelector('#thirteenthFirstAmount').value.trim();
  const secondAmountInput=document.querySelector('#thirteenthSecondAmount').value.trim();
  record.firstAmount=Math.max(0,firstAmountInput?money(firstAmountInput):calc.first);
  record.secondAmount=Math.max(0,secondAmountInput?money(secondAmountInput):Math.max(0,calc.net-record.firstAmount));
  record.firstDate=document.querySelector('#thirteenthFirstDate').value;
  record.secondDate=document.querySelector('#thirteenthSecondDate').value;
  record.firstPaid=document.querySelector('#thirteenthFirstPaid').checked;
  record.secondPaid=document.querySelector('#thirteenthSecondPaid').checked;
  if(!record.firstDate||!record.secondDate){
    alert('Informe as datas previstas ou recebidas das duas parcelas.');
    return;
  }
  syncThirteenthTransaction(year,'first',record);
  syncThirteenthTransaction(year,'second',record);
  save();
  renderAll();
  go('thirteenth');
}
