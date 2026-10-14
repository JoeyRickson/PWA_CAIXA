// Guardado
const savingDlg=document.querySelector('#savingDialog'),savingForm=document.querySelector('#savingForm');

function setSavingRecurrenceUI(show){
  const box=document.querySelector('#savingRepeatRangeFields');
  if(!box)return;

  box.classList.toggle('hidden',!show);

  const noEnd=document.querySelector('#savingRepeatNoEnd');
  const end=document.querySelector('#savingRepeatEndDate');

  if(end)end.disabled=!!noEnd?.checked;
}

function syncSavingEndDate(){
  const noEnd=document.querySelector('#savingRepeatNoEnd');
  const end=document.querySelector('#savingRepeatEndDate');
  if(end)end.disabled=!!noEnd?.checked;
}

function openSaving(obj=null){
  savingForm.reset();

  document.querySelector('#savingId').value=obj?.id||'';
  document.querySelector('#savingFormTitle').textContent=obj?'Editar movimentação':'Nova movimentação';
  document.querySelector('#savingType').value=obj?.type||'deposit';
  document.querySelector('#savingDate').value=obj?.date||baseDate();
  document.querySelector('#savingAccount').value=obj?.account||'Reserva de emergência';
  document.querySelector('#savingDescription').value=obj?.description||'';
  document.querySelector('#savingAmount').value=obj
    ?Number(obj.amount).toFixed(2).replace('.',',')
    :'';
  document.querySelector('#savingStatus').value=obj?.status||'realized';

  const template=obj?.savingTemplateId
    ?state.savingTemplates.find(t=>t.id===obj.savingTemplateId)
    :null;

  const recurring=!!obj?.savingTemplateId;
  const occurrenceDate=obj?.date||baseDate();

  document.querySelector('#savingRepeatMonthly').checked=recurring;
  const templateEnd=template?recurringEndDate(template):'';
  document.querySelector('#savingRepeatStartDate').value=occurrenceDate;
  document.querySelector('#savingRepeatEndDate').value=templateEnd;
  document.querySelector('#savingRepeatNoEnd').checked=!templateEnd;

  setSavingRecurrenceUI(recurring);

  document.querySelector('#deleteSaving').classList.toggle('hidden',!obj);

  savingDlg.showModal();
}

document.querySelector('#closeSavingDialog').onclick=()=>savingDlg.close();

document.querySelector('#savingRepeatMonthly').addEventListener('change',e=>{
  const date=document.querySelector('#savingDate').value||baseDate();

  if(e.target.checked){
    document.querySelector('#savingRepeatStartDate').value=date;
  }

  setSavingRecurrenceUI(e.target.checked);
});

document.querySelector('#savingRepeatNoEnd').addEventListener('change',syncSavingEndDate);

document.querySelector('#savingDate').addEventListener('change',()=>{
  if(document.querySelector('#savingRepeatMonthly').checked){
    const date=document.querySelector('#savingDate').value;
    if(date)document.querySelector('#savingRepeatStartDate').value=date;
    setSavingRecurrenceUI(true);
  }
});

savingForm.addEventListener('submit',e=>{
  e.preventDefault();

  const id=document.querySelector('#savingId').value;
  const date=document.querySelector('#savingDate').value;
  const amount=money(document.querySelector('#savingAmount').value);
  const description=document.querySelector('#savingDescription').value.trim();

  const obj={
    id:id||uid(),
    type:document.querySelector('#savingType').value,
    date,
    account:document.querySelector('#savingAccount').value.trim()||'Reserva',
    description,
    amount,
    status:document.querySelector('#savingStatus').value
  };

  if(!obj.date||!obj.description||!(obj.amount>0)){
    alert('Preencha data, descrição e um valor maior que zero.');
    return;
  }

  const effectiveMonth=date.slice(0,7);
  const repeatMonthly=document.querySelector('#savingRepeatMonthly').checked;

  const requestedStartDate=
    document.querySelector('#savingRepeatStartDate').value||date;

  const noEnd=
    document.querySelector('#savingRepeatNoEnd').checked;

  const requestedEndDate=noEnd
    ?''
    :(document.querySelector('#savingRepeatEndDate').value||'');

  if(repeatMonthly && requestedStartDate<date){
    alert('O início da repetição não pode ser anterior à data da movimentação.');
    document.querySelector('#savingRepeatStartDate').focus();
    return;
  }

  if(repeatMonthly && requestedEndDate && requestedEndDate<requestedStartDate){
    alert('A data final da repetição não pode ser anterior à data inicial.');
    document.querySelector('#savingRepeatEndDate').focus();
    return;
  }

  const previous=state.savings.find(x=>x.id===id);
  const oldTemplateId=previous?.savingTemplateId;

  let attachedToSeries=false;

  if(repeatMonthly){
    const templateId=oldTemplateId||uid();

    if(oldTemplateId){
      freezeSavingHistory(templateId,effectiveMonth);
      removeSavingRecurringPlannedFrom(templateId,effectiveMonth,id);
    }

    const template={
      id:templateId,
      type:obj.type,
      account:obj.account,
      description:obj.description,
      amount:obj.amount,
      dueDay:Number(requestedStartDate.slice(-2)),
      startDate:requestedStartDate,
      endDate:requestedEndDate
    };

    syncRecurringTemplateDateFields(template,requestedStartDate,requestedEndDate);

    const templateIndex=
      state.savingTemplates.findIndex(t=>t.id===templateId);

    if(templateIndex>=0){
      state.savingTemplates[templateIndex]=template;
    }else{
      state.savingTemplates.push(template);
    }

    const currentIsInRange=
      date>=requestedStartDate &&
      (!requestedEndDate || date<=requestedEndDate);

    if(currentIsInRange){
      obj.savingTemplateId=templateId;
      obj.savingRecurringMarker=`${templateId}:${effectiveMonth}`;
      attachedToSeries=true;
    }

  }else if(oldTemplateId){
    freezeSavingHistory(oldTemplateId,effectiveMonth);
    removeSavingRecurringPlannedFrom(oldTemplateId,effectiveMonth,id);

    state.savingTemplates=
      state.savingTemplates.filter(t=>t.id!==oldTemplateId);

    detachRemainingSavingRecurring(oldTemplateId);
  }

  const ix=state.savings.findIndex(x=>x.id===id);

  if(ix>=0){
    state.savings[ix]={
      ...state.savings[ix],
      ...obj
    };

    if(!attachedToSeries){
      delete state.savings[ix].savingTemplateId;
      delete state.savings[ix].savingRecurringMarker;
    }
  }else{
    state.savings.push(obj);
  }

  save();
  savingDlg.close();
  renderAll();
});

document.querySelector('#deleteSaving').onclick=()=>{
  const id=document.querySelector('#savingId').value;

  if(!id)return;

  const item=state.savings.find(x=>x.id===id);

  if(!item)return;

  if(item.savingTemplateId){
    if(!confirm(
      'Esta movimentação é recorrente. Excluir este mês e interromper a repetição daqui para frente? Os meses anteriores serão preservados.'
    ))return;

    const templateId=item.savingTemplateId;
    const cutoff=savingMonth(item)||key();

    freezeSavingHistory(templateId,cutoff);
    removeSavingRecurringPlannedFrom(templateId,cutoff);

    state.savings=
      state.savings.filter(x=>x.id!==id);

    state.savingTemplates=
      state.savingTemplates.filter(x=>x.id!==templateId);

    detachRemainingSavingRecurring(templateId);

  }else{
    if(!confirm('Excluir esta movimentação?'))return;

    state.savings=
      state.savings.filter(x=>x.id!==id);
  }

  save();
  savingDlg.close();
  renderAll();
};
