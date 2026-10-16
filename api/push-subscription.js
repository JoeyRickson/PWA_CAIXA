'use strict';
const {firebase,send,tokenId,validDays,tzName}=require('./_push-common');
module.exports=async(req,res)=>{
  if(!['POST','DELETE'].includes(req.method))return send(res,405,{message:'Método não permitido'});
  if(String(req.headers['content-type']||'').split(';')[0]!=='application/json')return send(res,415,{message:'JSON obrigatório'});
  if(Number(req.headers['content-length']||0)>11000)return send(res,413,{message:'Requisição muito grande'});
  try{
    const {db,auth}=firebase();
    const match=/^Bearer ([\w.-]+)$/.exec(String(req.headers.authorization||''));
    if(!match)return send(res,401,{message:'Entre com Google'});
    const account=await auth.verifyIdToken(match[1]);
    if(!account.uid||!account.email_verified)return send(res,403,{message:'Conta não verificada'});
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body.token!=='string'||body.token.length<50||body.token.length>4096)return send(res,400,{message:'Token push inválido'});
    const doc=db.collection('saldoplanPush').doc(account.uid).collection('devices').doc(tokenId(body.token));
    if(req.method==='DELETE'){
      await doc.delete();return send(res,200,{ok:true});
    }
    const days=validDays(body.dates);
    if(!days)return send(res,400,{message:'Datas inválidas'});
    const advanceDays=[0,1,3,7].includes(body.advanceDays)?body.advanceDays:0;
    const data={token:body.token,enabled:true,dates:days,advanceDays,timezone:tzName(String(body.timezone||'')),updatedAt:new Date().toISOString()};
    await doc.set(data);
    return send(res,200,{ok:true,scheduled:days.length});
  }catch(error){
    console.error('Push subscription failure',error?.name||'Error');
    return send(res,503,{message:'Notificações em segundo plano indisponíveis. Confira a configuração do servidor.'});
  }
};
