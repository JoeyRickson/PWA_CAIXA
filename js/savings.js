// Guardado
const savingDlg=document.querySelector('#savingDialog'),savingForm=document.querySelector('#savingForm');

function setSavingRecurrenceUI(show){
  const box=document.querySelector('#savingRepeatRangeFields');
  if(!box)return;

  box.classList.toggle('hidden',!show);

  const noEnd=document.querySelector('#savingRepeatNoEnd');
  const end=document.querySelector('#savingRepeatEndMonth');

  if(end)end.disabled=!!noEnd?.checked;
}

function syncSavingEndMonth(){
  const noEnd=document.querySelector('#savingRepeatNoEnd');
  const end=document.querySelector('#savingRepeatEndMonth');
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
  const occurrenceMonth=(obj?.date||baseDate()).slice(0,7);

  document.querySelector('#savingRepeatMonthly').checked=recurring;
  document.querySelector('#savingRepeatStartMonth').value=occurrenceMonth;
  document.querySelector('#savingRepeatEndMonth').value=template?.endMonth||'';
  document.querySelector('#savingRepeatNoEnd').checked=!template?.endMonth;

  setSavingRecurrenceUI(recurring);

  document.querySelector('#deleteSaving').classList.toggle('hidden',!obj);

  savingDlg.showModal();
}

document.querySelector('#closeSavingDialog').onclick=()=>savingDlg.close();

document.querySelector('#savingRepeatMonthly').addEventListener('change',e=>{
  const date=document.querySelector('#savingDate').value||baseDate();

  if(e.target.checked){
    document.querySelector('#savingRepeatStartMonth').value=date.slice(0,7);
  }

  setSavingRecurrenceUI(e.target.checked);
});

document.querySelector('#savingRepeatNoEnd').addEventListener('change',syncSavingEndMonth);

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

  const requestedStart=
    document.querySelector('#savingRepeatStartMonth').value||effectiveMonth;

  const noEnd=
    document.querySelector('#savingRepeatNoEnd').checked;

  const requestedEnd=noEnd
    ?''
    :(document.querySelector('#savingRepeatEndMonth').value||'');

  if(repeatMonthly && requestedStart<effectiveMonth){
    alert('O início da repetição não pode ser anterior ao mês da movimentação.');
    document.querySelector('#savingRepeatStartMonth').focus();
    return;
  }

  if(repeatMonthly && requestedEnd && requestedEnd<requestedStart){
    alert('O mês final da repetição não pode ser anterior ao mês inicial.');
    document.querySelector('#savingRepeatEndMonth').focus();
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
      dueDay:Number(date.slice(-2)),
      startMonth:requestedStart,
      endMonth:requestedEnd
    };

    const templateIndex=
      state.savingTemplates.findIndex(t=>t.id===templateId);

    if(templateIndex>=0){
      state.savingTemplates[templateIndex]=template;
    }else{
      state.savingTemplates.push(template);
    }

    const currentIsInRange=
      effectiveMonth>=requestedStart &&
      (!requestedEnd || effectiveMonth<=requestedEnd);

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
