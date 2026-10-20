'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const path=require('node:path');
const project=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(project,'js/payroll.js'),'utf8');
const start=code.indexOf('function fgtsAccountBreakdown(');
const stop=code.indexOf('function fgtsAccountProjectedBalance(',start);
assert(start>=0&&stop>start);
const slice=code.slice(start,stop);
const context=vm.createContext({round2:x=>Math.round((x+Number.EPSILON)*100)/100,Date,Number,Object,String,console});
vm.runInContext(slice,context);
const breakd=vm.runInContext('fgtsAccountBreakdown',context);
const balance=vm.runInContext('fgtsAccountBalance',context);
const account={employer:'Empresa teste',currentBalance:2585.72,balanceDate:'2026-10-08',years:{'2026':{deposits:{
 '9':{paid:true,amount:1200,date:'2026-09-30'},
 '10':{paid:true,amount:580.17,date:'2026-10-18',jam:4.10,jamDate:'2026-10-19',withdrawal:2,withdrawalDate:'2026-10-19'},
 '11':{paid:false,amount:500,date:'2026-11-20'},
 thirteenth:{paid:false,amount:90,date:'2026-12-18'}
}}}};
let r=breakd(account,'2026-10-20');
assert.equal(r.snapshot,2585.72);
assert.equal(r.deposits,580.17);
assert.equal(r.credits,4.10);
assert.equal(r.withdrawals,2);
assert.equal(r.balance,3167.99);
assert.equal(r.futureConfirmed,0);
// Depósito marcado mas com data futura não entra no saldo de hoje.
account.years['2026'].deposits['10'].date='2026-10-31';
r=breakd(account,'2026-10-20');
assert.equal(r.deposits,0);
assert.equal(r.futureConfirmed,580.17);
assert.equal(r.credits,4.10); // JAM possui data própria, independente do depósito
// Conta ao mudar para depois do crédito.
r=breakd(account,'2026-11-02');
assert.equal(r.deposits,580.17);
// Quando o extrato é mais novo não contar o depósito de novo.
account.balanceDate='2026-11-05';account.currentBalance=3400;
r=breakd(account,'2026-11-10');
assert.equal(r.deposits,0);
assert.equal(r.balance,3400);
// Histórico legado fica fora do saldo real.
assert.equal(breakd({...account,isLegacy:true},'2026-11-10'),null);
assert.equal(balance({...account,isLegacy:true}),null);
assert.equal(breakd({...account,currentBalance:null,balanceDate:'',years:{}},'2026-11-10').balance,0);
const view=fs.readFileSync(path.join(project,'views/fgts.html'),'utf8');
for(const id of ['fgtsAccountSelect','fgtsSelectedSnapshot','fgtsSelectedDeposits','fgtsSelectedMovements','fgtsSelectedBalance','fgtsAccountsTotal'])assert(view.includes(`id="${id}"`),id);
assert(view.indexOf('id="fgtsAccountSelect"') < view.indexOf('id="fgtsAccountsTotal"'));
const index=fs.readFileSync(path.join(project,'index.html'),'utf8');
assert(index.includes('v521-fgts.css?v=5.2.1'));
const sw=fs.readFileSync(path.join(project,'sw.js'),'utf8');
assert(sw.includes('fgts.html?v=5.2.1'));
console.log('FGTS por empresa v5.2.1: verificacoes PASS (extrato, depositos, saques, data futura, historico e layout)');
