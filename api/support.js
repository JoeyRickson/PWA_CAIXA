/* SaldoPlan v2.21.0 — endpoint autenticado /api/support */
'use strict';
const {getApps,initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const DESTINATION='joeyrickson1812@gmail.com';
const TYPES={sugestao:'Sugestão de melhoria',problema:'Problema',duvida:'Dúvida',outro:'Outro assunto'};
const recent=new Map(); // Limitação básica por instância (não substitui rate limit distribuído)

function sendJson(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
function trimText(value,max){
  if(typeof value!=='string')return '';
  return value.trim().slice(0,max+1);
}
function textLine(value){return String(value).replace(/[\r\n\t]+/g,' ').trim();}
module.exports=async function handler(req,res){
  res.setHeader('Allow','POST');
  if(req.method!=='POST')return sendJson(res,405,{message:'Método não permitido.'});
  const contentType=String(req.headers['content-type']||'');
  if(!contentType.toLowerCase().startsWith('application/json'))return sendJson(res,415,{message:'Envie uma solicitação JSON.'});
  const length=Number(req.headers['content-length']||0);
  if(length>12000)return sendJson(res,413,{message:'Mensagem muito grande.'});
  const projectId=process.env.FIREBASE_PROJECT_ID||'saldoplan';
  const key=process.env.RESEND_API_KEY;
  const from=process.env.SUPPORT_FROM_EMAIL;
  if(!key||!from)return sendJson(res,503,{message:'O canal de suporte ainda não foi configurado. Tente novamente mais tarde.'});

  const authHeader=String(req.headers.authorization||'');
  const match=/^Bearer\s+([^\s]+)$/i.exec(authHeader);
  if(!match)return sendJson(res,401,{message:'Entre com Google no SaldoPlan antes de enviar.'});
  let decoded;
  try{
    if(!getApps().length)initializeApp({projectId});
    decoded=await getAuth().verifyIdToken(match[1]);
    if(!decoded.uid||!decoded.email||decoded.email_verified!==true){
      return sendJson(res,403,{message:'Utilize uma conta Google com e-mail verificado.'});
    }
  }catch{
    return sendJson(res,401,{message:'Sessão inválida ou expirada. Entre novamente.'});
  }

  let body=req.body;
  if(typeof body==='string'){
    try{body=JSON.parse(body);}catch{return sendJson(res,400,{message:'JSON inválido.'});}
  }
  if(!body||typeof body!=='object'||Array.isArray(body))return sendJson(res,400,{message:'Solicitação inválida.'});
  if(body.website)return sendJson(res,400,{message:'Solicitação recusada.'});
  const category=trimText(body.category,25);
  const subject=textLine(trimText(body.subject,110));
  const message=trimText(body.message,4000);
  if(!Object.prototype.hasOwnProperty.call(TYPES,category)||subject.length<6||subject.length>110||message.length<15||message.length>4000){
    return sendJson(res,400,{message:'Verifique categoria, assunto e descrição.'});
  }
  if(/\r|\n/.test(subject))return sendJson(res,400,{message:'Assunto inválido.'});
  const now=Date.now();
  for(const [id,time] of recent){if(now-time>60000)recent.delete(id);}
  if(recent.has(decoded.uid))return sendJson(res,429,{message:'Aguarde um minuto antes de enviar outra solicitação.'});
  recent.set(decoded.uid,now);

  const senderName=textLine(decoded.name||'Usuário SaldoPlan').slice(0,120);
  const senderEmail=textLine(decoded.email).slice(0,254);
  const text=[
    'Nova solicitação enviada pelo SaldoPlan',
    '',
    `Categoria: ${TYPES[category]}`,
    `Assunto: ${subject}`,
    `Nome: ${senderName}`,
    `E-mail autenticado: ${senderEmail}`,
    `UID Firebase: ${decoded.uid}`,
    '',
    'Descrição:',message,'',
    'Solicitação enviada pela aba Suporte e sugestões.'
  ].join('\n');
  try{
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        from,
        to:[DESTINATION],
        reply_to:senderEmail,
        subject:`[SaldoPlan] ${TYPES[category]}: ${subject}`.slice(0,200),
        text
      }),
      signal:AbortSignal.timeout(12000)
    });
    if(!response.ok){
      console.error('SaldoPlan suporte: provedor rejeitou o envio',response.status);
      recent.delete(decoded.uid);
      return sendJson(res,502,{message:'Não foi possível encaminhar o e-mail. Verifique a configuração do serviço de envio.'});
    }
    return sendJson(res,200,{ok:true,message:'Solicitação enviada.'});
  }catch(error){
    console.error('SaldoPlan suporte: erro ao chamar provedor',String(error?.message||error));
    recent.delete(decoded.uid);
    return sendJson(res,502,{message:'O serviço de envio está indisponível. Tente novamente.'});
  }
};
