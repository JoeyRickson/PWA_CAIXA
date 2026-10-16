'use strict';
// Somente servidor. FIREBASE_SERVICE_ACCOUNT_JSON nunca deve ser enviado ao navegador.
const {getApps,getApp,initializeApp,cert}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
function services(){
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw)throw new Error('Firestore Admin não configurado');
  const service=JSON.parse(raw);
  const projectId=process.env.FIREBASE_PROJECT_ID||'saldoplan';
  if(service.project_id!==projectId)throw new Error('Conta de serviço do projeto errado');
  const name='saldoplan-support-admin';
  const app=getApps().find(a=>a.name===name)||initializeApp({credential:cert(service),projectId},name);
  return {auth:getAuth(app),db:getFirestore(app)};
}
async function saveTicket(ticket){
  const {db}=services();
  await db.collection('saldoplanSupportTickets').doc(ticket.protocol).create({
    protocol:ticket.protocol,uid:ticket.uid,category:ticket.category,subject:ticket.subject,
    message:ticket.message,senderName:ticket.senderName,senderEmail:ticket.senderEmail,
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'recebido'
  });
}
function json(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));}
async function adminUser(req){
  const uid=String(process.env.SUPPORT_ADMIN_UID||'');
  if(!uid)throw Object.assign(new Error('Painel não configurado'),{httpStatus:503});
  const token=/^Bearer\s+(\S+)$/i.exec(String(req.headers.authorization||''))?.[1];
  if(!token)throw Object.assign(new Error('Entre com Google'),{httpStatus:401});
  const {auth,db}=services();
  const user=await auth.verifyIdToken(token);
  if(user.uid!==uid||!user.email_verified)throw Object.assign(new Error('Acesso restrito'),{httpStatus:403});
  return {user,db};
}
module.exports={services,saveTicket,json,adminUser};
