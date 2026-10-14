// Recorrência mensal por intervalo de datas completas — SaldoPlan v2.16.0
function transactionMonth(x){
  return String(x?.date||'').slice(0,7);
}

function savingMonth(x){
  return String(x?.date||'').slice(0,7);
}

function isIsoDate(value){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
}

function daysInMonthKey(monthKey){
  if(!/^\d{4}-\d{2}$/.test(String(monthKey||'')))return 31;
  const [year,month]=monthKey.split('-').map(Number);
  return new Date(year,month,0).getDate();
}

function recurrenceDateForMonth(monthKey,day){
  if(!/^\d{4}-\d{2}$/.test(String(monthKey||'')))return '';
  const safeDay=Math.min(Math.max(1,Number(day)||1),daysInMonthKey(monthKey));
  return `${monthKey}-${String(safeDay).padStart(2,'0')}`;
}

function recurrenceAnchorDay(template){
  if(isIsoDate(template?.startDate)){
    return Number(template.startDate.slice(8,10))||Number(template?.dueDay)||1;
  }
  return Number(template?.dueDay)||1;
}

function templateDateFromLegacyMonth(template,field,targetKey=''){
  const value=String(template?.[field]||'');
  if(!/^\d{4}-\d{2}$/.test(value))return '';
  return recurrenceDateForMonth(value,recurrenceAnchorDay(template));
}

function recurringStartDate(template,targetKey=key(),items=state.transactions,idField='templateId'){
  if(isIsoDate(template?.startDate))return template.startDate;

  const legacy=templateDateFromLegacyMonth(template,'startMonth',targetKey);
  if(legacy)return legacy;

  const dates=items
    .filter(item=>item?.[idField]===template.id && isIsoDate(item.date))
    .map(item=>item.date)
    .sort();

  if(dates.length)return dates[dates.length-1];
  return recurrenceDateForMonth(targetKey,recurrenceAnchorDay(template));
}

function recurringEndDate(template){
  if(isIsoDate(template?.endDate))return template.endDate;
  return templateDateFromLegacyMonth(template,'endMonth');
}

function syncRecurringTemplateDateFields(template,startDate,endDate=''){
  template.startDate=startDate;
  template.endDate=endDate||'';

  // Mantém os campos antigos por compatibilidade com backups/app anteriores.
  template.startMonth=isIsoDate(startDate)?startDate.slice(0,7):String(template.startMonth||'');
  template.endMonth=isIsoDate(endDate)?endDate.slice(0,7):'';
  template.dueDay=isIsoDate(startDate)?Number(startDate.slice(8,10)):(Number(template.dueDay)||1);
  return template;
}

function migrateRecurringDateRanges(){
  let changed=false;

  const migrate=(template,items,idField)=>{
    const start=recurringStartDate(template,key(),items,idField);
    const end=recurringEndDate(template);

    if(start && template.startDate!==start){
      template.startDate=start;
      changed=true;
    }

    if((template.endDate||'')!==(end||'')){
      template.endDate=end||'';
      changed=true;
    }

    if(start){
      const oldStartMonth=template.startMonth||'';
      const oldEndMonth=template.endMonth||'';
      const oldDueDay=Number(template.dueDay)||1;

      syncRecurringTemplateDateFields(template,start,end);

      if(
        template.startMonth!==oldStartMonth ||
        template.endMonth!==oldEndMonth ||
        template.dueDay!==oldDueDay
      )changed=true;
    }
  };

  state.fixedTemplates.forEach(template=>migrate(template,state.transactions,'templateId'));
  state.savingTemplates.forEach(template=>migrate(template,state.savings,'savingTemplateId'));

  if(changed)save({backupOld:false,cloud:false,history:false});
}

function freezeRecurringHistory(templateId,beforeMonth){
  state.transactions.forEach(x=>{
    if(x.templateId===templateId && transactionMonth(x)<beforeMonth){
      delete x.templateId;
      delete x.recurringMarker;
    }
  });
}

function removeRecurringPlannedFrom(templateId,fromMonth,exceptId=''){
  state.transactions=state.transactions.filter(x=>{
    if(x.id===exceptId)return true;
    if(x.templateId!==templateId)return true;
    if(transactionMonth(x)<fromMonth)return true;
    return x.status==='realized';
  });
}

function detachRemainingRecurring(templateId){
  state.transactions.forEach(x=>{
    if(x.templateId===templateId){
      delete x.templateId;
      delete x.recurringMarker;
    }
  });
}

function ensureRecurring(){
  const targetKey=key();
  let changed=false;

  state.fixedTemplates.forEach(template=>{
    const startDate=recurringStartDate(template,targetKey,state.transactions,'templateId');
    const endDate=recurringEndDate(template);

    if(!startDate)return;

    if(
      template.startDate!==startDate ||
      (template.endDate||'')!==(endDate||'') ||
      template.startMonth!==startDate.slice(0,7) ||
      template.endMonth!==(endDate?endDate.slice(0,7):'') ||
      Number(template.dueDay)!==Number(startDate.slice(8,10))
    ){
      syncRecurringTemplateDateFields(template,startDate,endDate);
      changed=true;
    }

    const occurrenceDate=recurrenceDateForMonth(targetKey,recurrenceAnchorDay(template));
    if(!occurrenceDate)return;
    if(occurrenceDate<startDate)return;
    if(endDate && occurrenceDate>endDate)return;

    const marker=`${template.id}:${targetKey}`;
    if(state.transactions.some(x=>x.recurringMarker===marker))return;

    const obj={
      id:uid(),
      kind:template.kind||'expense',
      description:template.description,
      amount:template.amount,
      date:occurrenceDate,
      status:'planned',
      recurringMarker:marker,
      templateId:template.id
    };

    if(obj.kind==='income'){
      obj.incomeType=template.incomeType||'first';
    }else{
      obj.expenseType=template.expenseType||'fixed';
      obj.paySource=template.paySource||'cash';
      obj.category=template.category||'Outros';
    }

    state.transactions.push(obj);
    changed=true;
  });

  if(changed)save({backupOld:false,cloud:false,history:false});
}

function freezeSavingHistory(templateId,beforeMonth){
  state.savings.forEach(x=>{
    if(x.savingTemplateId===templateId && savingMonth(x)<beforeMonth){
      delete x.savingTemplateId;
      delete x.savingRecurringMarker;
    }
  });
}

function removeSavingRecurringPlannedFrom(templateId,fromMonth,exceptId=''){
  state.savings=state.savings.filter(x=>{
    if(x.id===exceptId)return true;
    if(x.savingTemplateId!==templateId)return true;
    if(savingMonth(x)<fromMonth)return true;
    return x.status==='realized';
  });
}

function detachRemainingSavingRecurring(templateId){
  state.savings.forEach(x=>{
    if(x.savingTemplateId===templateId){
      delete x.savingTemplateId;
      delete x.savingRecurringMarker;
    }
  });
}

function ensureSavingRecurring(targetKey=key()){
  let changed=false;

  state.savingTemplates.forEach(template=>{
    const startDate=recurringStartDate(template,targetKey,state.savings,'savingTemplateId');
    const endDate=recurringEndDate(template);

    if(!startDate)return;

    if(
      template.startDate!==startDate ||
      (template.endDate||'')!==(endDate||'') ||
      template.startMonth!==startDate.slice(0,7) ||
      template.endMonth!==(endDate?endDate.slice(0,7):'') ||
      Number(template.dueDay)!==Number(startDate.slice(8,10))
    ){
      syncRecurringTemplateDateFields(template,startDate,endDate);
      changed=true;
    }

    const occurrenceDate=recurrenceDateForMonth(targetKey,recurrenceAnchorDay(template));
    if(!occurrenceDate)return;
    if(occurrenceDate<startDate)return;
    if(endDate && occurrenceDate>endDate)return;

    const marker=`${template.id}:${targetKey}`;
    if(state.savings.some(x=>x.savingRecurringMarker===marker))return;

    state.savings.push({
      id:uid(),
      type:template.type||'deposit',
      date:occurrenceDate,
      account:template.account||'Reserva',
      description:template.description||'Movimentação recorrente',
      amount:template.amount,
      status:'planned',
      savingTemplateId:template.id,
      savingRecurringMarker:marker
    });

    changed=true;
  });

  if(changed)save({backupOld:false,cloud:false,history:false});
}

function recurringRangeLabel(template){
  const start=recurringStartDate(template,key(),state.transactions,'templateId');
  const end=recurringEndDate(template);
  return `${start?formatDate(start):'—'} → ${end?formatDate(end):'sem fim'}`;
}

migrateRecurringDateRanges();
