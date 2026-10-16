/* SaldoPlan v2.21.2 — endpoint autenticado /api/support e template de email */
'use strict';
const {getApps,initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {randomBytes}=require('node:crypto');
const {saveTicket}=require('./_support-store');
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
// Template de email compatível com Gmail e clientes tradicionais.
// Toda informação vinda do usuário é escapada antes de entrar no HTML.
function escapeHtml(value){
  return String(value).replace(/[&<>"']/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char]);
}
function htmlMessage(value){
  return escapeHtml(value).replace(/\r\n|\r|\n/g,'<br>');
}
function formattedDate(date){
  return new Intl.DateTimeFormat('pt-BR',{
    timeZone:'America/Manaus',day:'2-digit',month:'long',year:'numeric',
    hour:'2-digit',minute:'2-digit',hour12:false
  }).format(date);
}
function buildSupportEmail({category,subject,message,senderName,senderEmail,receivedAt}){
  const title=TYPES[category];
  const accents={sugestao:'#136f6a',problema:'#a63c40',duvida:'#4b55b9',outro:'#9c5518'};
  const accent=accents[category]||'#136f6a';
  const replyUrl='mailto:'+encodeURIComponent(senderEmail)
    +'?subject='+encodeURIComponent('Re: [SaldoPlan] '+title+': '+subject);
  const nameSafe=escapeHtml(senderName);
  const emailSafe=escapeHtml(senderEmail);
  const subjectSafe=escapeHtml(subject);
  const categorySafe=escapeHtml(title);
  const timeSafe=escapeHtml(receivedAt);
  const messageSafe=htmlMessage(message);
  const replySafe=escapeHtml(replyUrl);
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f5f9;color:#172033;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;font-size:1px;color:#f2f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">Nova solicitação de ${nameSafe} — ${subjectSafe}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#f2f5f9;"><tr><td align="center" style="padding:32px 12px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dfe5ed;border-radius:16px;">
<tr><td style="padding:28px 30px;background:#101827;border-radius:16px 16px 0 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="vertical-align:middle;"><div style="width:45px;height:45px;line-height:45px;text-align:center;background:#24cad5;border-radius:12px;color:#091726;font-weight:bold;font-size:26px;">S</div></td>
    <td style="padding-left:13px;vertical-align:middle;"><div style="font-size:21px;font-weight:bold;color:#ffffff;letter-spacing:-.5px;">SaldoPlan</div><div style="font-size:11px;color:#a4b7cd;letter-spacing:1.7px;">CENTRAL DE SUPORTE</div></td>
  </tr></table>
  <p style="margin:24px 0 5px;color:#9dcbd2;font-size:12px;font-weight:bold;letter-spacing:1.3px;">NOVA SOLICITAÇÃO</p>
  <h1 style="margin:0;color:#ffffff;font-size:25px;line-height:1.3;font-weight:bold;">Você recebeu uma mensagem</h1>
  <p style="margin:9px 0 0;color:#d2dbe8;font-size:14px;line-height:1.6;">Uma nova solicitação foi enviada pelo formulário do SaldoPlan.</p>
</td></tr>
<tr><td style="padding:27px 30px 10px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:7px;background:${accent};padding:8px 12px;font-size:12px;font-weight:bold;color:#ffffff;">${categorySafe}</td></tr></table>
  <p style="margin:17px 0 5px;font-size:11px;color:#748094;font-weight:bold;letter-spacing:1.1px;">ASSUNTO</p>
  <h2 style="margin:0;font-size:22px;line-height:1.35;color:#142034;overflow-wrap:anywhere;">${subjectSafe}</h2>
</td></tr>
<tr><td style="padding:15px 30px 0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background:#f5f7fa;border:1px solid #e6ebf0;border-radius:10px;">
    <tr><td style="padding:17px 18px;">
      <p style="margin:0 0 12px;color:#68788d;font-size:11px;font-weight:bold;letter-spacing:1px;">QUEM ENVIOU</p>
      <p style="margin:0 0 5px;color:#172033;font-size:15px;font-weight:bold;overflow-wrap:anywhere;">${nameSafe}</p>
      <a href="mailto:${emailSafe}" style="font-size:13px;color:#1766a0;text-decoration:none;overflow-wrap:anywhere;">${emailSafe}</a>
      <p style="margin:12px 0 0;color:#6c7789;font-size:12px;">Recebido em ${timeSafe} (horário de Manaus)</p>
    </td></tr>
  </table>
</td></tr>
<tr><td style="padding:25px 30px 0;">
  <p style="margin:0 0 12px;color:#64748b;font-size:11px;font-weight:bold;letter-spacing:1px;">MENSAGEM</p>
  <div style="padding:19px 18px;background:#ffffff;border-left:4px solid ${accent};border-top:1px solid #e8edf3;border-right:1px solid #e8edf3;border-bottom:1px solid #e8edf3;border-radius:5px 10px 10px 5px;font-size:15px;line-height:1.8;color:#263348;overflow-wrap:anywhere;word-break:break-word;">${messageSafe}</div>
</td></tr>
<tr><td style="padding:26px 30px 28px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#101827;border-radius:9px;">
    <a href="${replySafe}" style="display:inline-block;padding:14px 22px;color:#ffffff;font-size:14px;font-weight:bold;text-decoration:none;">Responder ao solicitante &#8594;</a>
  </td></tr></table>
  <p style="margin:13px 0 0;color:#7b8797;font-size:12px;line-height:1.5;">O botão abre seu aplicativo de e-mail. Você também pode usar <b>Responder</b> no Gmail: o endereço do solicitante já está configurado como resposta.</p>
</td></tr>
<tr><td style="padding:18px 30px 22px;background:#f6f8fb;border-top:1px solid #e6ebf0;border-radius:0 0 16px 16px;">
  <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#31445c;">SaldoPlan • Notificação de suporte</p>
  <p style="margin:0;color:#718096;font-size:11px;line-height:1.6;">Gerado automaticamente a partir da aba Suporte e sugestões. Não contém saldos nem dados financeiros do usuário. Não responda com senhas ou códigos de acesso.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
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
  const receivedAt=formattedDate(new Date());
  const protocol='SP-'+new Date().getFullYear()+'-'+randomBytes(5).toString('hex').toUpperCase();
  const html=buildSupportEmail({category,subject,message,senderName,senderEmail,receivedAt})
    .replace('NOVA SOLICITAÇÃO</p>',`PROTOCOLO ${protocol}</p>`);
  const text=[
    'Nova solicitação enviada pelo SaldoPlan',
    '',
    `Categoria: ${TYPES[category]}`,
    `Assunto: ${subject}`,
    `Protocolo: ${protocol}`,
    `Nome: ${senderName}`,
    `E-mail autenticado: ${senderEmail}`,
    `Recebido em: ${receivedAt} (horário de Manaus)`,
    '',
    'Descrição:',message,'',
    'Solicitação enviada pela aba Suporte e sugestões.'
  ].join('\n');
  try{
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        from:/^[^<>\s]+@[^<>\s]+$/.test(from)?`SaldoPlan <${from}>`:from,
        to:[DESTINATION],
        reply_to:senderEmail,
        subject:`[SaldoPlan] [${protocol}] ${TYPES[category]}: ${subject}`.slice(0,200),
        text,
        html
      }),
      signal:AbortSignal.timeout(12000)
    });
    if(!response.ok){
      console.error('SaldoPlan suporte: provedor rejeitou o envio',response.status);
      recent.delete(decoded.uid);
      return sendJson(res,502,{message:'Não foi possível encaminhar o e-mail. Verifique a configuração do serviço de envio.'});
    }
    // Histórico remoto opcional: o e-mail permanece funcional sem Firestore Admin.
    try{await saveTicket({protocol,uid:decoded.uid,category,subject,message,senderName,senderEmail});}
    catch(error){console.warn('SaldoPlan: protocolo enviado por e-mail; histórico remoto indisponível');}
    return sendJson(res,200,{ok:true,protocol,message:'Solicitação enviada.'});
  }catch(error){
    console.error('SaldoPlan suporte: erro ao chamar provedor',String(error?.message||error));
    recent.delete(decoded.uid);
    return sendJson(res,502,{message:'O serviço de envio está indisponível. Tente novamente.'});
  }
};
