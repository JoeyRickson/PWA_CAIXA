'use strict';
const {firebase,send}=require('./_push-common');
module.exports=async(req,res)=>{
  if(req.method!=='GET')return send(res,405,{message:'Método não permitido'});
  const cron=process.env.CRON_SECRET;
  if(!cron||req.headers.authorization!==`Bearer ${cron}`)return send(res,401,{message:'Não autorizado'});
  try{
    const {db,messaging}=firebase();
    const docs=await db.collectionGroup('devices').limit(250).get();
    let sent=0,skipped=0;
    for(const doc of docs.docs){
      const row=doc.data();
      if(!row?.enabled||!row.token){skipped++;continue;}
      let today;
      try{const parts=new Intl.DateTimeFormat('en-US',{timeZone:row.timezone||'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
        const part=k=>parts.find(x=>x.type===k)?.value;today=`${part('year')}-${part('month')}-${part('day')}`;}
      catch{skipped++;continue;}
      // Lembrete genérico: nenhuma despesa, saldo, categoria ou nome enviado ao FCM.
      const due=(row.dates||[]).includes(today);
      if(!due||row.lastSentDay===today){skipped++;continue;}
      try{
        await messaging.send({token:row.token,data:{title:'SaldoPlan · Lembrete financeiro',body:'Você tem um compromisso previsto para hoje. Confira o calendário no aplicativo.',url:'https://saldoplan.vercel.app/'},webpush:{headers:{TTL:'3600',Urgency:'normal'}}});
        await doc.ref.update({lastSentDay:today});sent++;
      }catch(e){
        console.warn('FCM delivery failed:',e?.code||'unknown');
        if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(e?.code))await doc.ref.delete();
      }
    }
    return send(res,200,{ok:true,sent,skipped,checked:docs.size,truncated:docs.size===250});
  }catch(error){console.error('Push cron failure',error?.name||'Error');return send(res,503,{message:'Serviço push indisponível'});}
};
