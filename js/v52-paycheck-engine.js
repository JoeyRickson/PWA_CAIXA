/* SaldoPlan v5.2.0 - conferência de contracheque: lógica pura e testável. */
(function(root, factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root) root.SaldoPlanPaycheckEngine=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
  const finite=(v,min=0)=>Number.isFinite(Number(v)) && Number(v)>=min;
  function parseHours(input,mode){
    const s=String(input??'').trim();
    if(!s)return 0;
    if(mode==='hhmm'){
      if(!/^\d{1,4}:[0-5]\d$/.test(s)) throw new Error('Use horas e minutos no formato 42:46.');
      const [h,m]=s.split(':').map(Number); return h+m/60;
    }
    if(mode==='decimal'){
      if(!/^\d{1,4}(?:[,.]\d{1,4})?$/.test(s)) throw new Error('Use horas decimais no formato 42,46.');
      return Number(s.replace(',','.'));
    }
    throw new Error('Selecione o formato de horas.');
  }
  function calcFromHours(settings,raw,mode,tax){
    const salary=Number(settings.salary),monthlyHours=Number(settings.monthlyHours),nightPct=Number(settings.nightPct);
    const advance=Number(settings.advance),rests=Number(settings.restDays),work=Number(settings.workDays);
    if(!finite(salary)||!finite(monthlyHours,1)||!finite(nightPct)||!finite(advance)||!finite(rests)||!finite(work,1))throw new Error('Revise salário, divisor mensal e dias de descanso.');
    const hours={h50:parseHours(raw.h50,mode),h100:parseHours(raw.h100,mode),night:parseHours(raw.night,mode)};
    const rate=salary/monthlyHours;
    const v50=cents(hours.h50*rate*1.5),v100=cents(hours.h100*rate*2);
    const nightValue=cents(hours.night*rate*nightPct/100);
    const dsr=cents((v50+v100+nightValue)*rests/work),gross=cents(salary+v50+v100+nightValue+dsr);
    const inss=cents(tax.inss(gross)),irrf=cents(tax.irrf(gross,inss));
    const final=cents(gross-inss-irrf-advance);
    return {salary,v50,v100,night:nightValue,dsr,gross,inss,irrf,advance,final,hours};
  }
  const fields=['salary','v50','v100','night','dsr','gross','inss','irrf','advance','final'];
  function deltaTable(estimate,official){
    return fields.map(key=>({key,estimate:cents(estimate[key]||0),actual:official?.[key]===null||official?.[key]===undefined?null:cents(Number(official[key])),delta:official?.[key]===null||official?.[key]===undefined?null:cents(Number(estimate[key]||0)-Number(official[key]))}));
  }
  function checkOfficial(official){
    if(official?.gross===null||official?.gross===undefined)return null;
    const items=['salary','v50','v100','night','dsr'];
    if(items.some(k=>official[k]===null||official[k]===undefined))return null;
    return cents(Number(official.gross)-items.reduce((sum,k)=>sum+Number(official[k]),0));
  }
  return Object.freeze({parseHours,calcFromHours,deltaTable,checkOfficial,fields});
});
