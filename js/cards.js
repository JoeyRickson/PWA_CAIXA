// Cartões, faturas e parcelamentos — SaldoPlan v2.17.0
function creditCardById(id){
  return state.creditCards.find(card=>card.id===id)||null;
}

function cardPurchaseById(id){
  return state.cardPurchases.find(purchase=>purchase.id===id)||null;
}

function monthKeyAdd(month,offset=0){
  if(!/^\d{4}-\d{2}$/.test(month||''))return key();
  const [year,monthNumber]=month.split('-').map(Number);
  return monthKey(new Date(year,monthNumber-1+offset,1));
}

function monthDayDate(month,day){
  const [year,monthNumber]=month.split('-').map(Number);
  const lastDay=new Date(year,monthNumber,0).getDate();
  const safeDay=Math.min(lastDay,Math.max(1,Number(day||1)));
  return `${year}-${String(monthNumber).padStart(2,'0')}-${String(safeDay).padStart(2,'0')}`;
}

function cardStatementMonthForDate(date,card){
  if(!date||!card)return key();
  const baseMonth=date.slice(0,7);
  const day=Number(date.slice(8,10))||1;
  return day<=Number(card.closingDay||1)?baseMonth:monthKeyAdd(baseMonth,1);
}

function cardInstallmentTransactions(purchaseId){
  return state.transactions
    .filter(transaction=>transaction.cardPurchaseId===purchaseId)
    .sort((a,b)=>(a.cardInstallmentIndex||0)-(b.cardInstallmentIndex||0));
}

function splitCardPurchaseAmount(total,installments){
  const count=Math.min(48,Math.max(1,Number(installments||1)));
  const cents=Math.max(0,Math.round(Number(total||0)*100));
  const base=Math.floor(cents/count);
  const remainder=cents-(base*count);
  return Array.from({length:count},(_,index)=>(base+(index<remainder?1:0))/100);
}

function buildCardInstallments(purchase,card){
  const amounts=splitCardPurchaseAmount(purchase.totalAmount,purchase.installments);
  return amounts.map((amount,index)=>{
    const statementMonth=monthKeyAdd(purchase.firstStatementMonth,index);
    return {
      id:uid(),
      kind:'expense',
      expenseType:'variable',
      paySource:'cash',
      category:purchase.category||'Cartão',
      description:`${purchase.description} (${index+1}/${purchase.installments})`,
      amount:round2(amount),
      date:monthDayDate(statementMonth,card.dueDay),
      status:'planned',
      cardId:card.id,
      cardPurchaseId:purchase.id,
      cardInstallmentIndex:index+1,
      cardInstallmentCount:purchase.installments,
      cardStatementMonth:statementMonth,
      cardPurchaseDate:purchase.purchaseDate
    };
  });
}

function cardOutstanding(cardId=''){
  return round2(sum(state.transactions.filter(transaction=>
    transaction.cardPurchaseId&&
    transaction.status==='planned'&&
    (!cardId||transaction.cardId===cardId)
  )));
}

function cardInvoiceTransactions(cardId,month=key()){
  return state.transactions
    .filter(transaction=>transaction.cardPurchaseId&&transaction.cardId===cardId&&transaction.cardStatementMonth===month)
    .sort((a,b)=>a.date.localeCompare(b.date)||Number(a.cardInstallmentIndex||0)-Number(b.cardInstallmentIndex||0));
}

function cardInvoiceTotal(cardId,month=key()){
  return round2(sum(cardInvoiceTransactions(cardId,month)));
}

function allCardsInvoiceTotal(month=key()){
  return round2(sum(state.transactions.filter(transaction=>transaction.cardPurchaseId&&transaction.cardStatementMonth===month)));
}

function cardTotalLimit(){
  return round2(state.creditCards.filter(card=>card.active!==false).reduce((total,card)=>total+Number(card.limit||0),0));
}

function cardAvailableLimit(){
  return round2(cardTotalLimit()-cardOutstanding());
}

function cardDisplayName(card){
  if(!card)return 'Cartão';
  const last4=card.last4?` •••• ${card.last4}`:'';
  return `${card.name||card.institution||'Cartão'}${last4}`;
}

function renderCardsDashboard(){
  const invoice=document.querySelector('#dashboardCardsInvoice');
  if(!invoice)return;
  invoice.textContent=fmt.format(allCardsInvoiceTotal(key()));
  document.querySelector('#dashboardCardsUsed').textContent=fmt.format(cardOutstanding());
  const available=cardAvailableLimit();
  const availableEl=document.querySelector('#dashboardCardsAvailable');
  availableEl.textContent=fmt.format(available);
  availableEl.classList.toggle('negative',available<0);
}

function creditCardListHtml(){
  if(!state.creditCards.length){
    return '<div class="empty">Nenhum cartão cadastrado. Adicione um cartão para controlar faturas e parcelas.</div>';
  }

  return state.creditCards.map(card=>{
    const used=cardOutstanding(card.id);
    const available=round2(Number(card.limit||0)-used);
    const pct=Number(card.limit||0)>0?Math.min(100,Math.max(0,used/Number(card.limit)*100)):0;
    return `<button type="button" class="credit-card-item ${card.active===false?'is-archived':''}" data-card-edit="${card.id}">
      <span class="credit-card-topline">
        <span>
          <strong>${escapeHtml(cardDisplayName(card))}</strong>
          <small>${escapeHtml(card.institution||'Instituição não informada')} · ${card.active===false?'Arquivado':'Ativo'}</small>
        </span>
        <span class="credit-card-limit"><small>Disponível</small><strong class="${available<0?'negative':''}">${fmt.format(available)}</strong></span>
      </span>
      <span class="credit-card-progress"><i style="width:${pct}%"></i></span>
      <span class="credit-card-meta">
        <span>Limite ${fmt.format(card.limit||0)}</span>
        <span>Usado ${fmt.format(used)}</span>
        <span>Fecha dia ${card.closingDay}</span>
        <span>Vence dia ${card.dueDay}</span>
        <span>Melhor dia ${card.bestDay}</span>
      </span>
    </button>`;
  }).join('');
}

function cardInvoiceListHtml(month=key()){
  const cards=state.creditCards.filter(card=>cardInvoiceTransactions(card.id,month).length);
  if(!cards.length){
    return '<div class="empty">Nenhuma parcela nesta fatura.</div>';
  }

  return cards.map(card=>{
    const items=cardInvoiceTransactions(card.id,month);
    const total=sum(items);
    const pending=sum(items.filter(item=>item.status==='planned'));
    const paid=sum(items.filter(item=>item.status==='realized'));
    const allPaid=items.length>0&&pending===0;
    return `<article class="card-invoice-card">
      <div class="card-invoice-head">
        <div>
          <span class="muted">${escapeHtml(cardDisplayName(card))}</span>
          <strong>${fmt.format(total)}</strong>
          <small>${items.length} parcela${items.length===1?'':'s'} · ${pending>0?`${fmt.format(pending)} pendente`:'fatura paga'}</small>
        </div>
        <button type="button" class="btn ${allPaid?'ghost':'secondary'} small" data-card-invoice-toggle="${card.id}" data-card-invoice-month="${month}">${allPaid?'Reabrir fatura':'Marcar como paga'}</button>
      </div>
      <div class="card-invoice-progress"><i style="width:${total>0?Math.min(100,paid/total*100):0}%"></i></div>
      <div class="card-invoice-items">${items.map(item=>`<button type="button" class="card-invoice-item" data-card-purchase="${item.cardPurchaseId}">
        <span><strong>${escapeHtml(item.description)}</strong><small>${formatDate(item.date)} · ${escapeHtml(item.category||'Cartão')}</small></span>
        <span><strong>${fmt.format(item.amount)}</strong><small class="${item.status==='planned'?'pending':'positive'}">${item.status==='planned'?'Pendente':'Pago'}</small></span>
      </button>`).join('')}</div>
    </article>`;
  }).join('');
}

function cardFutureInvoicesHtml(){
  return Array.from({length:6},(_,index)=>{
    const month=monthKeyAdd(key(),index);
    const total=allCardsInvoiceTotal(month);
    const [year,monthNumber]=month.split('-').map(Number);
    return `<button type="button" class="card-future-item" data-card-month="${month}">
      <span>${MONTHS[monthNumber-1].slice(0,3)} ${year}</span>
      <strong>${fmt.format(total)}</strong>
      <small>${total>0?'Fatura projetada':'Sem parcelas'}</small>
    </button>`;
  }).join('');
}

function cardPurchaseListHtml(){
  const purchases=[...state.cardPurchases].sort((a,b)=>(b.purchaseDate||'').localeCompare(a.purchaseDate||'')).slice(0,18);
  if(!purchases.length){
    return '<div class="empty">Nenhuma compra registrada no cartão.</div>';
  }

  return purchases.map(purchase=>{
    const card=creditCardById(purchase.cardId);
    const tx=cardInstallmentTransactions(purchase.id);
    const paidCount=tx.filter(item=>item.status==='realized').length;
    const pendingCount=tx.filter(item=>item.status==='planned').length;
    const status=purchase.cancelled?'Cancelada':pendingCount?`${paidCount}/${purchase.installments} pagas`:'Quitada';
    return `<button type="button" class="card-purchase-item ${purchase.cancelled?'is-cancelled':''}" data-card-purchase="${purchase.id}">
      <span>
        <strong>${escapeHtml(purchase.description)}</strong>
        <small>${formatDate(purchase.purchaseDate)} · ${escapeHtml(cardDisplayName(card))} · ${purchase.installments}x</small>
      </span>
      <span>
        <strong>${fmt.format(purchase.totalAmount)}</strong>
        <small>${escapeHtml(status)}</small>
      </span>
    </button>`;
  }).join('');
}

function renderCards(){
  const root=document.querySelector('#view-cards');
  if(!root)return;

  document.querySelector('#cardsMonthLabel').textContent=`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  const monthTotal=allCardsInvoiceTotal(key());
  const monthItems=state.transactions.filter(transaction=>transaction.cardPurchaseId&&transaction.cardStatementMonth===key());
  const pending=sum(monthItems.filter(item=>item.status==='planned'));
  const paid=sum(monthItems.filter(item=>item.status==='realized'));

  setMoney('cardsInvoiceTotal',monthTotal);
  document.querySelector('#cardsInvoiceDetail').textContent=monthItems.length
    ?`${monthItems.length} parcela${monthItems.length===1?'':'s'} · ${fmt.format(pending)} pendente · ${fmt.format(paid)} pago`
    :'Nenhuma compra nesta fatura';

  const limit=cardTotalLimit();
  const used=cardOutstanding();
  const available=round2(limit-used);
  setMoney('cardsLimitTotal',limit);
  setMoney('cardsUsedTotal',used);
  setMoney('cardsAvailableTotal',available);
  document.querySelector('#cardsAvailableDetail').textContent=state.creditCards.length
    ?`${state.creditCards.filter(card=>card.active!==false).length} cartão(ões) ativo(s)`
    :'Cadastre seu primeiro cartão';

  const status=document.querySelector('#cardsInvoiceStatus');
  if(status){
    status.textContent=!monthItems.length?'Sem fatura':pending>0?'Em aberto':'Paga';
    status.classList.toggle('ok',monthItems.length>0&&pending===0);
  }

  document.querySelector('#creditCardList').innerHTML=creditCardListHtml();
  document.querySelector('#cardInvoiceList').innerHTML=cardInvoiceListHtml(key());
  document.querySelector('#cardFutureInvoices').innerHTML=cardFutureInvoicesHtml();
  document.querySelector('#cardPurchaseList').innerHTML=cardPurchaseListHtml();
  renderCardsDashboard();
}

const creditCardDialog=document.querySelector('#creditCardDialog');
const creditCardForm=document.querySelector('#creditCardForm');
const cardPurchaseDialog=document.querySelector('#cardPurchaseDialog');
const cardPurchaseForm=document.querySelector('#cardPurchaseForm');

function openCreditCard(card=null){
  creditCardForm.reset();
  document.querySelector('#creditCardId').value=card?.id||'';
  document.querySelector('#creditCardFormTitle').textContent=card?'Editar cartão':'Novo cartão';
  document.querySelector('#creditCardName').value=card?.name||'';
  document.querySelector('#creditCardInstitution').value=card?.institution||'';
  document.querySelector('#creditCardLast4').value=card?.last4||'';
  document.querySelector('#creditCardLimit').value=card?Number(card.limit||0).toFixed(2).replace('.',','):'';
  document.querySelector('#creditCardClosingDay').value=card?.closingDay||10;
  document.querySelector('#creditCardDueDay').value=card?.dueDay||20;
  document.querySelector('#creditCardBestDay').value=card?.bestDay||11;
  document.querySelector('#creditCardActive').checked=card?.active!==false;
  document.querySelector('#deleteCreditCard').classList.toggle('hidden',!card);
  creditCardDialog.showModal();
}

function closeCreditCard(){creditCardDialog.close()}

function populateCardPurchaseSelect(selected=''){
  const select=document.querySelector('#cardPurchaseCard');
  const cards=state.creditCards.filter(card=>card.active!==false||card.id===selected);
  select.innerHTML=cards.map(card=>`<option value="${card.id}">${escapeHtml(cardDisplayName(card))}</option>`).join('');
  if(selected&&cards.some(card=>card.id===selected))select.value=selected;
}

function syncPurchaseFirstStatement(){
  const card=creditCardById(document.querySelector('#cardPurchaseCard').value);
  const date=document.querySelector('#cardPurchaseDate').value;
  if(card&&date){
    document.querySelector('#cardPurchaseFirstStatement').value=cardStatementMonthForDate(date,card);
  }
  updateCardPurchasePreview();
}

function updateCardPurchasePreview(){
  const preview=document.querySelector('#cardPurchasePreview');
  if(!preview)return;
  const card=creditCardById(document.querySelector('#cardPurchaseCard').value);
  const total=money(document.querySelector('#cardPurchaseAmount').value);
  const count=Math.min(48,Math.max(1,Number(document.querySelector('#cardPurchaseInstallments').value||1)));
  const first=document.querySelector('#cardPurchaseFirstStatement').value;
  if(!card||!(total>0)||!/^\d{4}-\d{2}$/.test(first||'')){
    preview.textContent='Informe os dados da compra para visualizar as parcelas.';
    return;
  }
  const amounts=splitCardPurchaseAmount(total,count);
  const average=round2(total/count);
  const lastMonth=monthKeyAdd(first,count-1);
  preview.innerHTML=`<strong>${count}x de aproximadamente ${fmt.format(average)}</strong><span>Primeira: ${fmt.format(amounts[0])} · ${formatDate(monthDayDate(first,card.dueDay))}</span><span>Última: ${fmt.format(amounts[amounts.length-1])} · ${formatDate(monthDayDate(lastMonth,card.dueDay))}</span>`;
}

function openCardPurchase(purchase=null){
  if(!state.creditCards.length){
    alert('Cadastre um cartão antes de registrar uma compra.');
    openCreditCard();
    return;
  }

  cardPurchaseForm.reset();
  document.querySelector('#cardPurchaseId').value=purchase?.id||'';
  document.querySelector('#cardPurchaseFormTitle').textContent=purchase?'Editar compra':'Nova compra';
  populateCardPurchaseSelect(purchase?.cardId||state.creditCards.find(card=>card.active!==false)?.id||state.creditCards[0]?.id||'');
  document.querySelector('#cardPurchaseDate').value=purchase?.purchaseDate||baseDate();
  document.querySelector('#cardPurchaseDescription').value=purchase?.description||'';
  document.querySelector('#cardPurchaseCategory').value=purchase?.category||'Cartão';
  document.querySelector('#cardPurchaseAmount').value=purchase?Number(purchase.totalAmount||0).toFixed(2).replace('.',','):'';
  document.querySelector('#cardPurchaseInstallments').value=purchase?.installments||1;
  document.querySelector('#cardPurchaseFirstStatement').value=purchase?.firstStatementMonth||cardStatementMonthForDate(document.querySelector('#cardPurchaseDate').value,creditCardById(document.querySelector('#cardPurchaseCard').value));
  document.querySelector('#deleteCardPurchase').classList.toggle('hidden',!purchase);
  updateCardPurchasePreview();
  cardPurchaseDialog.showModal();
}

function closeCardPurchase(){cardPurchaseDialog.close()}

document.querySelector('#newCreditCard').onclick=()=>openCreditCard();
document.querySelector('#cardsAddCardLink').onclick=()=>openCreditCard();
document.querySelector('#newCardPurchase').onclick=()=>openCardPurchase();
document.querySelector('#cardsAddPurchaseLink').onclick=()=>openCardPurchase();
document.querySelector('#closeCreditCardDialog').onclick=closeCreditCard;
document.querySelector('#closeCardPurchaseDialog').onclick=closeCardPurchase;

document.querySelector('#cardPurchaseCard').addEventListener('change',syncPurchaseFirstStatement);
document.querySelector('#cardPurchaseDate').addEventListener('change',syncPurchaseFirstStatement);
document.querySelector('#cardPurchaseFirstStatement').addEventListener('change',updateCardPurchasePreview);
document.querySelector('#cardPurchaseAmount').addEventListener('input',updateCardPurchasePreview);
document.querySelector('#cardPurchaseInstallments').addEventListener('input',updateCardPurchasePreview);

creditCardForm.addEventListener('submit',event=>{
  event.preventDefault();
  const id=document.querySelector('#creditCardId').value;
  const name=document.querySelector('#creditCardName').value.trim();
  const limit=money(document.querySelector('#creditCardLimit').value);
  const closingDay=Number(document.querySelector('#creditCardClosingDay').value);
  const dueDay=Number(document.querySelector('#creditCardDueDay').value);
  const bestDay=Number(document.querySelector('#creditCardBestDay').value);

  if(!name){alert('Informe o nome do cartão.');return}
  if(!(limit>0)){alert('Informe um limite maior que zero.');return}
  if([closingDay,dueDay,bestDay].some(day=>!Number.isInteger(day)||day<1||day>31)){
    alert('Fechamento, vencimento e melhor dia devem ficar entre 1 e 31.');
    return;
  }

  const card={
    id:id||uid(),
    name,
    institution:document.querySelector('#creditCardInstitution').value.trim(),
    last4:document.querySelector('#creditCardLast4').value.replace(/\D/g,'').slice(-4),
    limit:round2(limit),
    closingDay,
    dueDay,
    bestDay,
    active:document.querySelector('#creditCardActive').checked
  };

  const index=state.creditCards.findIndex(item=>item.id===id);
  if(index>=0)state.creditCards[index]={...state.creditCards[index],...card};
  else state.creditCards.push(card);

  save({undoLabel:`Cartão ${index>=0?'alterado':'criado'}: ${card.name}`});
  closeCreditCard();
  renderAll();
});

document.querySelector('#deleteCreditCard').onclick=()=>{
  const id=document.querySelector('#creditCardId').value;
  const card=creditCardById(id);
  if(!card)return;
  const hasPurchases=state.cardPurchases.some(purchase=>purchase.cardId===id);
  if(hasPurchases){
    alert('Este cartão possui compras vinculadas. Arquive o cartão desmarcando “Cartão ativo” para preservar o histórico.');
    return;
  }
  if(!confirm(`Excluir o cartão “${card.name}”?`))return;
  state.creditCards=state.creditCards.filter(item=>item.id!==id);
  save({undoLabel:`Cartão excluído: ${card.name}`});
  closeCreditCard();
  renderAll();
};

cardPurchaseForm.addEventListener('submit',event=>{
  event.preventDefault();
  const id=document.querySelector('#cardPurchaseId').value;
  const existing=id?cardPurchaseById(id):null;
  if(existing&&cardInstallmentTransactions(existing.id).some(item=>item.status==='realized')){
    alert('Esta compra já possui parcela paga. Para preservar o histórico, não é possível alterar sua estrutura. Você ainda pode cancelar apenas as parcelas futuras.');
    return;
  }

  const card=creditCardById(document.querySelector('#cardPurchaseCard').value);
  const purchaseDate=document.querySelector('#cardPurchaseDate').value;
  const description=document.querySelector('#cardPurchaseDescription').value.trim();
  const totalAmount=money(document.querySelector('#cardPurchaseAmount').value);
  const installments=Math.min(48,Math.max(1,Number(document.querySelector('#cardPurchaseInstallments').value||1)));
  const firstStatementMonth=document.querySelector('#cardPurchaseFirstStatement').value;

  if(!card){alert('Selecione um cartão.');return}
  if(!purchaseDate){alert('Informe a data da compra.');return}
  if(!description){alert('Informe a descrição da compra.');return}
  if(!(totalAmount>0)){alert('Informe um valor total maior que zero.');return}
  if(!/^\d{4}-\d{2}$/.test(firstStatementMonth||'')){alert('Informe a primeira fatura.');return}

  const purchase={
    id:id||uid(),
    cardId:card.id,
    purchaseDate,
    description,
    category:document.querySelector('#cardPurchaseCategory').value.trim()||'Cartão',
    totalAmount:round2(totalAmount),
    installments,
    firstStatementMonth,
    cancelled:false,
    createdAt:existing?.createdAt||new Date().toISOString(),
    updatedAt:new Date().toISOString()
  };

  if(existing){
    state.transactions=state.transactions.filter(transaction=>transaction.cardPurchaseId!==existing.id);
    const index=state.cardPurchases.findIndex(item=>item.id===existing.id);
    state.cardPurchases[index]=purchase;
  }else{
    state.cardPurchases.push(purchase);
  }

  state.transactions.push(...buildCardInstallments(purchase,card));
  save({undoLabel:`Compra no cartão ${existing?'alterada':'criada'}: ${purchase.description}`});
  closeCardPurchase();
  renderAll();
});

document.querySelector('#deleteCardPurchase').onclick=()=>{
  const id=document.querySelector('#cardPurchaseId').value;
  const purchase=cardPurchaseById(id);
  if(!purchase)return;
  const installments=cardInstallmentTransactions(id);
  const hasPaid=installments.some(item=>item.status==='realized');

  if(hasPaid){
    if(!confirm('Esta compra possui parcelas pagas. Cancelar somente as parcelas futuras e preservar o histórico pago?'))return;
    state.transactions=state.transactions.filter(transaction=>transaction.cardPurchaseId!==id||transaction.status==='realized');
    purchase.cancelled=true;
    purchase.cancelledAt=new Date().toISOString();
    save({undoLabel:`Parcelas futuras canceladas: ${purchase.description}`});
  }else{
    if(!confirm(`Excluir a compra “${purchase.description}” e todas as parcelas previstas?`))return;
    state.transactions=state.transactions.filter(transaction=>transaction.cardPurchaseId!==id);
    state.cardPurchases=state.cardPurchases.filter(item=>item.id!==id);
    save({undoLabel:`Compra no cartão excluída: ${purchase.description}`});
  }

  closeCardPurchase();
  renderAll();
};

addEventListener('click',event=>{
  const cardEdit=event.target.closest('[data-card-edit]');
  if(cardEdit){openCreditCard(creditCardById(cardEdit.dataset.cardEdit));return}

  const purchaseEdit=event.target.closest('[data-card-purchase]');
  if(purchaseEdit){
    const purchase=cardPurchaseById(purchaseEdit.dataset.cardPurchase);
    if(purchase)openCardPurchase(purchase);
    return;
  }

  const invoiceToggle=event.target.closest('[data-card-invoice-toggle]');
  if(invoiceToggle){
    const card=creditCardById(invoiceToggle.dataset.cardInvoiceToggle);
    const month=invoiceToggle.dataset.cardInvoiceMonth;
    const items=cardInvoiceTransactions(card?.id,month);
    if(!card||!items.length)return;
    const reopen=items.every(item=>item.status==='realized');
    const verb=reopen?'reabrir':'marcar como paga';
    if(!confirm(`${reopen?'Reabrir':'Marcar como paga'} a fatura de ${card.name} (${month})?`))return;
    items.forEach(item=>item.status=reopen?'planned':'realized');
    save({undoLabel:`Fatura ${reopen?'reaberta':'paga'}: ${card.name} · ${month}`});
    renderAll();
    return;
  }

  const monthButton=event.target.closest('[data-card-month]');
  if(monthButton){
    const [year,monthNumber]=monthButton.dataset.cardMonth.split('-').map(Number);
    cursor=new Date(year,monthNumber-1,1);
    rememberViewMonth();
    renderAll();
  }
});
