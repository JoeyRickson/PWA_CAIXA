/* SaldoPlan 5.3.0 — cálculos determinísticos e locais. Não faz solicitações externas. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.SaldoPlanPlanningEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const round=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
  const validDate=x=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(x||'')))return false;const d=new Date(`${x}T12:00:00Z`);return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===x};
  function plusDays(date,n){if(!validDate(date))throw Error('Data inválida');const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
  function plusMonths(month,offset){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mês inválido');const [y,m]=month.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+offset,1,12));return d.toISOString().slice(0,7);}
  function billDate(month,day){const [y,m]=month.split('-').map(Number);const last=new Date(Date.UTC(y,m,0)).getUTCDate();return `${month}-${String(Math.min(last,Math.max(1,Math.floor(Number(day)||1)))).padStart(2,'0')}`;}
  const isCash=tx=>tx?.kind==='income'?(tx.incomeType!=='flash'):(tx?.kind==='expense'&&tx.paySource!=='flash');
  function forecast(state,opts={}){
    const date=opts.date; if(!validDate(date))throw Error('Informe a data do saldo inicial.');
    const opening=Number(opts.openingBalance);if(!Number.isFinite(opening)||Math.abs(opening)>1e12)throw Error('Saldo inicial inválido.');
    const horizon=Math.min(365,Math.max(1,Math.floor(Number(opts.days||90))));
    const until=plusDays(date,horizon);
    const pending=(Array.isArray(state?.transactions)?state.transactions:[]).filter(t=>
      t?.status==='planned'&&validDate(t.date)&&t.date>=date&&t.date<=until&&isCash(t)&&
      Number.isFinite(Number(t.amount))&&Number(t.amount)>=0
    );
    const byDate=new Map();
    for(const t of pending){const delta=Number(t.kind==='income'?1:-1)*Number(t.amount);byDate.set(t.date,round((byDate.get(t.date)||0)+delta));}
    const balances=[];let balance=round(opening),firstNegative=null;let income=0,expense=0;
    for(let day=0;day<=horizon;day++){
      const iso=plusDays(date,day);
      for(const item of pending){if(item.date===iso){if(item.kind==='income')income+=Number(item.amount);else expense+=Number(item.amount);}}
      balance=round(balance+(byDate.get(iso)||0));
      if(balance<0&&!firstNegative)firstNegative=iso;
      balances.push({date:iso,balance});
    }
    function at(days){return balances[Math.min(horizon,days)]?.balance??balance;}
    return {date,until,openingBalance:round(opening),balance:round(balance),at30:at(30),at60:at(60),at90:at(90),income:round(income),expense:round(expense),firstNegative,series:balances,pendingCount:pending.length,pending};
  }
  function dueAlerts(state,date,days=7){
    if(!validDate(date))return [];
    const until=plusDays(date,Math.min(30,Math.max(1,Number(days)||7)));
    return (Array.isArray(state?.transactions)?state.transactions:[])
      .filter(t=>t&&t.kind==='expense'&&t.status==='planned'&&validDate(t.date)&&t.date>=date&&t.date<=until&&Number(t.amount)>=0)
      .sort((a,b)=>a.date.localeCompare(b.date)||Number(b.amount)-Number(a.amount)).slice(0,30)
      .map(t=>({date:t.date,description:String(t.description||'Despesa'),amount:round(t.amount),card:!!t.cardPurchaseId}));
  }
  function cardSimulation(card,amount,count,date){
    if(!card||!validDate(date))throw Error('Selecione cartão e data válidos.');
    amount=Number(amount);count=Number(count);
    if(!Number.isFinite(amount)||amount<=0||amount>10000000||!Number.isInteger(count)||count<1||count>48)throw Error('Valor ou número de parcelas inválido.');
    const closing=Math.max(1,Math.min(31,Number(card.closingDay)||1));
    const day=Number(date.slice(8));
    const first=plusMonths(date.slice(0,7),day<=closing?0:1);
    const cents=Math.round(amount*100),base=Math.floor(cents/count),extra=cents%count;
    return Array.from({length:count},(_,index)=>({
      index:index+1,month:plusMonths(first,index),date:billDate(plusMonths(first,index),card.dueDay),amount:round((base+(index<extra?1:0))/100)
    }));
  }
  function goals(state,now){
    if(!validDate(now))return [];
    return (Array.isArray(state?.financialGoals)?state.financialGoals:[]).map(g=>{
      const target=Number(g.targetAmount)||0, current=Number(g.currentAmount)||0;
      if(!(target>0))return null;
      const remaining=Math.max(0,round(target-current));
      const deadline=validDate(g.deadline)?g.deadline:null;
      const months=deadline?Math.max(1,(Number(deadline.slice(0,4))-Number(now.slice(0,4)))*12+Number(deadline.slice(5,7))-Number(now.slice(5,7))+(Number(deadline.slice(8))>Number(now.slice(8))?1:0)):null;
      return {id:g.id,name:String(g.name||'Meta'),target,current,remaining,deadline,months,monthlyAmount:months?round(remaining/months):null,source:g.source||'manual',overdue:!!(deadline&&deadline<now&&remaining>0)};
    }).filter(Boolean).sort((a,b)=>(a.deadline||'9999').localeCompare(b.deadline||'9999'));
  }
  function reconciliation(bankBalance,recordedBalance){
    const bank=Number(bankBalance),recorded=Number(recordedBalance);
    if(!Number.isFinite(bank)||!Number.isFinite(recorded)||Math.abs(bank)>1e12||Math.abs(recorded)>1e12)throw Error('Saldos inválidos');
    const difference=round(bank-recorded);
    return {bankBalance:round(bank),recordedBalance:round(recorded),difference,balanced:Math.abs(difference)<0.005};
  }
  return {round,validDate,plusDays,plusMonths,billDate,forecast,dueAlerts,cardSimulation,goals,reconciliation};
});
