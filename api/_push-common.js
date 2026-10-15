'use strict';
const {createHash}=require('node:crypto');
const {getApps,getApp,initializeApp,cert}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const {getMessaging}=require('firebase-admin/messaging');
function firebase(){
  const appName='saldoplan-push';
  if(!getApps().some(app=>app.name===appName)){
    const secret=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if(!secret)throw new Error('Push não configurado: FIREBASE_SERVICE_ACCOUNT_JSON ausente');
    const account=JSON.parse(secret);
    if(account.project_id!=='saldoplan')throw new Error('Credenciais de projeto incorretas');
    initializeApp({credential:cert(account),projectId:'saldoplan'},appName);
  }
  const app=getApp(appName);
  return {db:getFirestore(app),auth:getAuth(app),messaging:getMessaging(app)};
}
function send(res,status,value){res.statusCode=status;res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));}
function tokenId(token){return createHash('sha256').update(token).digest('hex');}
function validDays(input){
  if(!Array.isArray(input)||input.length>45)return null;
  if(!input.every(x=>typeof x==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(x)&&!isNaN(new Date(x+'T12:00:00Z').getTime())))return null;
  return [...new Set(input)].sort();
}
function tzName(zone){try{new Intl.DateTimeFormat('en-CA',{timeZone:zone});return zone;}catch{return 'America/Sao_Paulo';}}
module.exports={firebase,send,tokenId,validDays,tzName};
