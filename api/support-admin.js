'use strict';
const {adminUser,json}=require('./_support-store');
const TYPES=['recebido','em_analise','resolvido'];
const goodProtocol=s=>/^SP-20\d{2}-[A-F0-9]{10}$/.test(s||'');
module.exports=async function handler(req,res){
  if(!['GET','PATCH','POST'].includes(req.method))return json(res,405,{message:'Método não permitido'});
  try{
    const {db}=await adminUser(req);
    const col=db.collection('saldoplanSupportTickets');
    if(req.method==='GET'){
      const snapshot=await col.orderBy('createdAt','desc').limit(60).get();
      return json(res,200,{tickets:snapshot.docs.map(doc=>doc.data())});
    }
    if(String(req.headers['content-type']||'').split(';')[0]!=='application/json')return json(res,415,{message:'JSON obrigatório'});
    if(Number(req.headers['content-length']||0)>6000)return json(res,413,{message:'Requisição grande demais'});
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||!goodProtocol(body.protocol))return json(res,400,{message:'Protocolo inválido'});
    const ref=col.doc(body.protocol);const snap=await ref.get();
    if(!snap.exists)return json(res,404,{message:'Solicitação não encontrada'});
    const ticket=snap.data();
    if(req.method==='PATCH'){
      if(!TYPES.includes(body.status))return json(res,400,{message:'Status inválido'});
      await ref.update({status:body.status,updatedAt:new Date().toISOString()});
      return json(res,200,{ok:true});
    }
    const key=process.env.RESEND_API_KEY,from=process.env.SUPPORT_FROM_EMAIL;
    const message=typeof body.message==='string'?body.message.trim():'';
    if(message.length<10||message.length>2000)return json(res,400,{message:'A resposta deve ter entre 10 e 2.000 caracteres'});
    if(!key||!from)return json(res,503,{message:'Serviço de e-mail indisponível'});
    if(!ticket.senderEmail||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ticket.senderEmail))return json(res,422,{message:'Destinatário inválido'});
    const subject=String(ticket.subject||'Solicitação').replace(/[\r\n]/g,' ').slice(0,110);
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({from:/^[^<>\s]+@[^<>\s]+$/.test(from)?`SaldoPlan <${from}>`:from,
        to:[ticket.senderEmail],subject:`Re: [SaldoPlan] [${body.protocol}] ${subject}`,text:message}),
      signal:AbortSignal.timeout(12000)
    });
    if(!response.ok)return json(res,502,{message:'Provedor de e-mail rejeitou a resposta. Verifique o domínio remetente no Resend.'});
    await ref.update({status:'em_analise',lastReplyAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    return json(res,200,{ok:true});
  }catch(error){
    const status=error.httpStatus||((error.code||'').includes('auth/')?401:503);
    console.warn('Support Admin:',error.httpStatus||'service_error');
    return json(res,status,{message:status===503?'Central administrativa não está disponível. Confira a configuração no servidor.':error.message});
  }
};
