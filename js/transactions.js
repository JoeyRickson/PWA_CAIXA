// Lançamentos
const dlg=document.querySelector('#entryDialog'),form=document.querySelector('#entryForm');
function baseDate(d=cursor){const y=d.getFullYear(),m=d.getMonth();const day=(today.getFullYear()===y&&today.getMonth()===m)?today.getDate():1;return `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`}
function setEntryRecurrenceUI(show){
  const box=document.querySelector('#repeatRangeFields');
  const checkbox=document.querySelector('#repeatMonthly');

  if(!box)return;

  const visible=show ?? !!checkbox?.checked;

  box.classList.toggle('hidden',!visible);

  if(visible){
    const date=document.querySelector('#entryDate')?.value||baseDate();
    const start=document.querySelector('#repeatStartDate');

    if(start){
      start.value=date;
      start.disabled=true;
    }
  }

  const noEnd=document.querySelector('#repeatNoEnd');
  const end=document.querySelector('#repeatEndDate');

  if(end){
    end.disabled=!!noEnd?.checked;
  }
}

function syncEntryEndDate(){
  const noEnd=document.querySelector('#repeatNoEnd');
  const end=document.querySelector('#repeatEndDate');
  if(end)end.disabled=!!noEnd?.checked;
}

function openEntry(kind='expense',obj=null){
  form.reset();

  document.querySelector('#entryId').value=obj?.id||'';
  document.querySelector('#entryKind').value=kind;
  document.querySelector('#fixedTemplateMode').value='0';
  document.querySelector('#formEyebrow').textContent=kind==='income'?'ENTRADA':'GASTO';
  document.querySelector('#formTitle').textContent=obj?'Editar lançamento':kind==='income'?'Nova entrada':'Novo gasto';
  document.querySelector('#incomeFields').classList.toggle('hidden',kind!=='income');
  document.querySelector('#expenseFields').classList.toggle('hidden',kind!=='expense');
  document.querySelector('#repeatLabel').classList.remove('hidden');
  document.querySelector('#deleteEntry').classList.toggle('hidden',!obj);
  document.querySelector('#entryDate').value=obj?.date||baseDate();
  document.querySelector('#entryStatus').value=obj?.status||'realized';

  const template=obj?.templateId
    ?state.fixedTemplates.find(t=>t.id===obj.templateId)
    :null;

  const recurring=!!obj?.templateId;

  document.querySelector('#repeatMonthly').checked=recurring;

  const occurrenceDate=obj?.date||baseDate();
  const templateEnd=template?recurringEndDate(template):'';
  document.querySelector('#repeatStartDate').value=occurrenceDate;
  document.querySelector('#repeatEndDate').value=templateEnd;
  document.querySelector('#repeatNoEnd').checked=!templateEnd;

  setEntryRecurrenceUI(recurring);

  if(kind==='income'){
    const type=obj?.incomeType||'first';
    document.querySelector('#incomeType').value=type;
    document.querySelector('#description').value=obj?.description||defaultIncomeDescription(type);
  }else{
    document.querySelector('#expenseType').value=obj?.expenseType||'variable';
    document.querySelector('#paySource').value=obj?.paySource||'cash';
    document.querySelector('#category').value=obj?.category||'';
    document.querySelector('#description').value=obj?.description||'';
  }

  document.querySelector('#amount').value=obj
    ?Number(obj.amount).toFixed(2).replace('.',',')
    :'';

  dlg.showModal();
}

function openTemplate(t=null){
  form.reset();

  document.querySelector('#entryId').value=t?.id||'';
  document.querySelector('#entryKind').value='expense';
  document.querySelector('#fixedTemplateMode').value='1';
  document.querySelector('#formEyebrow').textContent='GASTO FIXO';
  document.querySelector('#formTitle').textContent=t?'Editar gasto fixo':'Novo gasto fixo';
  document.querySelector('#incomeFields').classList.add('hidden');
  document.querySelector('#expenseFields').classList.remove('hidden');
  document.querySelector('#repeatLabel').classList.add('hidden');
  document.querySelector('#deleteEntry').classList.toggle('hidden',!t);
  document.querySelector('#expenseType').value='fixed';
  document.querySelector('#expenseType').disabled=true;
  document.querySelector('#paySource').value=t?.paySource||'cash';
  document.querySelector('#category').value=t?.category||'';
  document.querySelector('#description').value=t?.description||'';
  document.querySelector('#amount').value=t
    ?Number(t.amount).toFixed(2).replace('.',',')
    :'';

  const day=t?.dueDay||15;

  document.querySelector('#entryDate').value=recurrenceDateForMonth(key(),day);

  document.querySelector('#entryStatus').value='planned';
  document.querySelector('#entryStatus').closest('label').classList.add('hidden');

  const fixedStartDate=document.querySelector('#entryDate').value;
  const fixedEndDate=t?recurringEndDate(t):'';
  document.querySelector('#repeatStartDate').value=fixedStartDate;
  document.querySelector('#repeatEndDate').value=fixedEndDate;
  document.querySelector('#repeatNoEnd').checked=!fixedEndDate;

  setEntryRecurrenceUI(true);

  dlg.showModal();
}

function closeDialog(){
  document.querySelector('#expenseType').disabled=false;
  document.querySelector('#entryStatus').closest('label').classList.remove('hidden');
  document.querySelector('#repeatRangeFields')?.classList.add('hidden');
  dlg.close();
}

document.querySelector('#closeDialog').onclick=closeDialog;

document.querySelector('#repeatMonthly').addEventListener('change',e=>{
  const date=document.querySelector('#entryDate').value||baseDate();

  if(e.target.checked){
    document.querySelector('#repeatStartDate').value=date;
  }

  setEntryRecurrenceUI(e.target.checked);
});

document.querySelector('#repeatNoEnd').addEventListener('change',syncEntryEndDate);

document.querySelector('#repeatMonthly').onclick=()=>{
  setEntryRecurrenceUI(
    document.querySelector('#repeatMonthly').checked
  );
};

document.querySelector('#entryDate').addEventListener('change',()=>{
  if(document.querySelector('#repeatMonthly').checked){
    const recurrenceStart=document.querySelector('#entryDate').value;

    if(recurrenceStart){
      document.querySelector('#repeatStartDate').value=recurrenceStart;
    }

    setEntryRecurrenceUI(true);
  }
});
form.addEventListener('submit',e=>{
  e.preventDefault();

  const id=document.querySelector('#entryId').value;
  const templateMode=document.querySelector('#fixedTemplateMode').value==='1';
  const kind=document.querySelector('#entryKind').value;
  const amount=money(document.querySelector('#amount').value);
  const date=document.querySelector('#entryDate').value;

  const incomeType=document.querySelector('#incomeType').value;
  const expenseType=document.querySelector('#expenseType').value;
  const category=document.querySelector('#category').value.trim();

  let description=document.querySelector('#description').value.trim();

  if(!description){
    description=kind==='income'
      ?defaultIncomeDescription(incomeType)
      :defaultExpenseDescription(expenseType,category);
  }

  if(!(amount>0)){
    alert('Informe um valor maior que zero. Ex.: 2000 ou 2.000,00.');
    document.querySelector('#amount').focus();
    return;
  }

  if(!date){
    alert('Informe a data do lançamento.');
    document.querySelector('#entryDate').focus();
    return;
  }

  const effectiveMonth=date.slice(0,7);
  const requestedStartDate=document.querySelector('#repeatStartDate')?.value||date;
  const noEnd=!!document.querySelector('#repeatNoEnd')?.checked;
  const requestedEndDate=noEnd?'':(document.querySelector('#repeatEndDate')?.value||'');

  if(requestedStartDate<date){
    alert('O início da repetição não pode ser anterior à data do lançamento.');
    document.querySelector('#repeatStartDate').focus();
    return;
  }

  if(requestedEndDate && requestedEndDate<requestedStartDate){
    alert('A data final da repetição não pode ser anterior à data inicial.');
    document.querySelector('#repeatEndDate').focus();
    return;
  }

  if(templateMode){
    const previousTemplate=state.fixedTemplates.find(x=>x.id===id);

    if(previousTemplate){
      freezeRecurringHistory(previousTemplate.id,effectiveMonth);
      removeRecurringPlannedFrom(previousTemplate.id,effectiveMonth);
    }

    const t={
      id:id||uid(),
      kind:'expense',
      expenseType:'fixed',
      description,
      amount,
      category:category||'Outros',
      paySource:document.querySelector('#paySource').value,
      startDate:requestedStartDate,
      endDate:requestedEndDate,
      dueDay:Number(requestedStartDate.slice(-2))
    };

    syncRecurringTemplateDateFields(t,requestedStartDate,requestedEndDate);

    const ix=state.fixedTemplates.findIndex(x=>x.id===id);

    if(ix>=0)state.fixedTemplates[ix]=t;
    else state.fixedTemplates.push(t);

  }else{
    const obj={
      id:id||uid(),
      kind,
      description,
      amount,
      date,
      status:document.querySelector('#entryStatus').value
    };

    if(kind==='income'){
      obj.incomeType=incomeType;
    }else{
      obj.expenseType=expenseType;
      obj.paySource=document.querySelector('#paySource').value;
      obj.category=category||'Outros';
    }

    const repeatMonthly=document.querySelector('#repeatMonthly').checked;
    const previousTransaction=state.transactions.find(x=>x.id===id);
    const oldTemplateId=previousTransaction?.templateId;

    let attachedToSeries=false;

    if(repeatMonthly){
      const templateId=oldTemplateId||uid();

      if(oldTemplateId){
        freezeRecurringHistory(templateId,effectiveMonth);
        removeRecurringPlannedFrom(templateId,effectiveMonth,id);
      }

      const template={
        id:templateId,
        kind,
        description,
        amount,
        dueDay:Number(requestedStartDate.slice(-2)),
        startDate:requestedStartDate,
        endDate:requestedEndDate
      };

      syncRecurringTemplateDateFields(template,requestedStartDate,requestedEndDate);

      if(kind==='income'){
        template.incomeType=incomeType;
      }else{
        template.expenseType=expenseType;
        template.paySource=document.querySelector('#paySource').value;
        template.category=category||'Outros';
      }

      const templateIndex=state.fixedTemplates.findIndex(t=>t.id===templateId);

      if(templateIndex>=0)state.fixedTemplates[templateIndex]=template;
      else state.fixedTemplates.push(template);

      const currentIsInRange=
        date>=requestedStartDate &&
        (!requestedEndDate || date<=requestedEndDate);

      if(currentIsInRange){
        obj.templateId=templateId;
        obj.recurringMarker=`${templateId}:${effectiveMonth}`;
        attachedToSeries=true;
      }

    }else if(oldTemplateId){
      freezeRecurringHistory(oldTemplateId,effectiveMonth);
      removeRecurringPlannedFrom(oldTemplateId,effectiveMonth,id);

      state.fixedTemplates=
        state.fixedTemplates.filter(t=>t.id!==oldTemplateId);

      detachRemainingRecurring(oldTemplateId);
    }

    const ix=state.transactions.findIndex(x=>x.id===id);

    if(ix>=0){
      state.transactions[ix]={
        ...state.transactions[ix],
        ...obj
      };

      if(!attachedToSeries){
        delete state.transactions[ix].templateId;
        delete state.transactions[ix].recurringMarker;
      }
    }else{
      state.transactions.push(obj);
    }

    const [y,m]=date.slice(0,7).split('-').map(Number);
    cursor=new Date(y,m-1,1);

    if(typeof rememberViewMonth==='function'){
      rememberViewMonth();
    }
  }

  save();
  closeDialog();
  renderAll();
});
document.querySelector('#incomeType').addEventListener('change',e=>{
  if(document.querySelector('#entryKind').value!=='income')return;
  const d=document.querySelector('#description'),autoValues=['Salário - quinzena','Salário - final do mês','Entrada extra','Crédito Flash',''];
  if(autoValues.includes(d.value.trim()))d.value=defaultIncomeDescription(e.target.value);
});
document.querySelector('#deleteEntry').onclick=()=>{
  const id=document.querySelector('#entryId').value;
  const templateMode=document.querySelector('#fixedTemplateMode').value==='1';

  if(!id)return;

  if(templateMode){
    if(!confirm(
      'Excluir esta recorrência deste mês em diante? Os meses anteriores serão preservados.'
    ))return;

    const cutoff=key();

    freezeRecurringHistory(id,cutoff);
    removeRecurringPlannedFrom(id,cutoff);

    state.fixedTemplates=
      state.fixedTemplates.filter(x=>x.id!==id);

    detachRemainingRecurring(id);

  }else{
    const item=state.transactions.find(x=>x.id===id);

    if(!item)return;

    if(item.templateId){
      if(!confirm(
        'Este lançamento é recorrente. Excluir este mês e interromper a repetição daqui para frente? Os meses anteriores serão preservados.'
      ))return;

      const templateId=item.templateId;
      const cutoff=transactionMonth(item)||key();

      freezeRecurringHistory(templateId,cutoff);
      removeRecurringPlannedFrom(templateId,cutoff);

      state.transactions=
        state.transactions.filter(x=>x.id!==id);

      state.fixedTemplates=
        state.fixedTemplates.filter(x=>x.id!==templateId);

      detachRemainingRecurring(templateId);

    }else{
      if(!confirm('Excluir este item?'))return;

      const thirteenthMatch=item.payrollSource?.match(/^thirteenth-(\d{4})-(first|second)$/);
      if(thirteenthMatch){
        const [,year,part]=thirteenthMatch;
        const record=thirteenthYearRecord(Number(year));
        record[`${part}Paid`]=false;
      }

      state.transactions=
        state.transactions.filter(x=>x.id!==id);
    }
  }

  save();
  closeDialog();
  renderAll();
};
