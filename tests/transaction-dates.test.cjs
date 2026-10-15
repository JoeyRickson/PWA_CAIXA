'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/transactions.js'),'utf8');

function scenario({date='2026-10-20',kind='expense',status='planned',repeat=false,fixed=false,start='2026-10-15',end='2026-10-01',noEnd=false,changeDate=false}={}){
  const els=new Map();
  const make=()=>({value:'',checked:false,disabled:false,handlers:{},classList:{add(){},remove(){},toggle(){}},closest(){return {classList:{add(){},remove(){}}};},focus(){},addEventListener(type,handler){this.handlers[type]=handler;},showModal(){},close(){},reset(){}});
  const get=id=>{if(!els.has(id))els.set(id,make());return els.get(id);};
  const set=(id, props)=>Object.assign(get('#'+id),props);
  set('entryId',{value:''});
  set('entryKind',{value:kind});
  set('fixedTemplateMode',{value:fixed?'1':'0'});
  set('amount',{value:'200'});
  set('entryDate',{value:date});
  set('entryStatus',{value:status});
  set('incomeType',{value:'first'});
  set('expenseType',{value:'variable'});
  set('paySource',{value:'cash'});
  set('category',{value:'Carro'});
  set('description',{value:'Manutenção'});
  set('repeatMonthly',{checked:repeat});
  set('repeatStartDate',{value:start});
  set('repeatEndDate',{value:end});
  set('repeatNoEnd',{checked:noEnd});
  const state={transactions:[],fixedTemplates:[]};
  const alerts=[];let saves=0;
  const context={
    document:{querySelector:get},state,
    today:new Date(2026,9,15),cursor:new Date(2026,9,1),
    money:v=>Number(v),uid:()=>`id${state.transactions.length+state.fixedTemplates.length+1}`,
    defaultExpenseDescription:()=>'',defaultIncomeDescription:()=>'',
    alert:msg=>alerts.push(msg),
    save:()=>{saves++;},renderAll:()=>{},
    key:()=> '2026-10',
    syncRecurringTemplateDateFields:()=>{},
    recurringEndDate:()=>'',
    freezeRecurringHistory:()=>{},removeRecurringPlannedFrom:()=>{},
    detachRemainingRecurring:()=>{},
  };
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'js/transactions.js'});
  if(changeDate){get('#entryDate').handlers.change();}
  get('#entryForm').handlers.submit({preventDefault(){}});
  return {state,alerts,saves,els,get};
}

{
  const t=scenario({date:'2026-10-20',status:'planned'});
  assert.equal(t.alerts.length,0,'gasto futuro previsto não pode exigir repetição');
  assert.equal(t.saves,1);
  assert.equal(t.state.transactions[0].date,'2026-10-20');
  assert.equal(t.state.transactions[0].status,'planned');
}
{
  const t=scenario({date:'2026-10-31',status:'realized'});
  assert.equal(t.saves,1,'gasto futuro realizado deve poder ser registrado');
  assert.equal(t.state.transactions[0].date,'2026-10-31');
}
{
  const t=scenario({date:'2026-10-29',kind:'income',status:'planned'});
  assert.equal(t.saves,1,'receita futura deve ser permitida');
  assert.equal(t.state.transactions[0].kind,'income');
}
{
  const t=scenario({date:'2026-09-30',status:'realized'});
  assert.equal(t.saves,1,'lançamento avulso anterior deve ser permitido');
}
{
  const t=scenario({date:'2026-10-20',repeat:true,start:'2026-10-15',noEnd:true});
  assert.equal(t.saves,0,'repetição inválida deve continuar rejeitada');
  assert.match(t.alerts[0],/início da repetição/i);
}
{
  const t=scenario({date:'2026-10-20',repeat:true,start:'2026-10-20',end:'2026-10-19'});
  assert.equal(t.saves,0,'repetição terminando antes do início deve ser rejeitada');
  assert.match(t.alerts[0],/data final da repetição/i);
}
{
  const t=scenario({date:'2026-10-20',repeat:true,start:'2026-10-20',noEnd:true});
  assert.equal(t.saves,1,'repetição mensal válida deve continuar funcionando');
  assert.equal(t.state.transactions[0].templateId,'id1');
}
{
  const t=scenario({date:'2026-10-20',fixed:true,start:'2026-10-15',noEnd:true,changeDate:true});
  assert.equal(t.get('#repeatStartDate').value,'2026-10-20','gasto fixo deve acompanhar a data alterada');
  assert.equal(t.saves,1,'gasto fixo válido deve continuar funcionando');
  assert.equal(t.state.fixedTemplates[0].startDate,'2026-10-20');
}
console.log('SaldoPlan: 8 testes de datas e recorrências PASS');
