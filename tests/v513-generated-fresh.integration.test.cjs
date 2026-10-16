'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../js/v51-live-engine.js');
const code=fs.readFileSync(path.join(__dirname,'..','js/v51-live-sync.js'),'utf8');
function simulate({kind='matching',cache=false}={}){
 const uid='UID_TEST',scope='user_'+uid;
 const seed={version:2,cloud:{},transactions:[{id:'demo',amount:500}],settings:{theme:'light'},budgets:[],payrollMonths:{},thirteenthByYear:{},fgtsByYear:{},netWorthSnapshots:[],creditCards:[],cardPurchases:[]};
 const base=E.blankProfileTemplate(seed,x=>structuredClone(x));
 const cloud=structuredClone(base);
 cloud.transactions.push({id:'tx',description:'cloud',amount:1});
 const local=structuredClone(cloud);
 if(kind==='matching')cloud.transactions.push({id:'remoteOnly',amount:300});
 if(kind==='different')local.transactions[0].amount=200;
 if(kind==='localOnly')local.transactions.push({id:'localExtra',amount:400});
 if(kind==='blank')Object.assign(local,structuredClone(base));
 if(kind==='generated'){Object.assign(local,structuredClone(base));local.payrollMonths={'2026-10':{holidayCount:0,referenceHours:null}};local.thirteenthByYear={'2026':{startMonth:5,endMonth:12,firstDate:'2026-07-23',secondDate:'2026-12-18',firstAmount:null,secondAmount:null,firstPaid:true,secondPaid:false}};local.fgtsByYear={'2026':{startMonth:5,endMonth:12,deposits:{}}};local.netWorthSnapshots=[{date:new Date().toISOString().slice(0,10),total:0,assets:0,liabilities:0}];}
 if(kind==='generatedWithRealFGTS'){Object.assign(local,structuredClone(base));local.fgtsByYear={'2026':{startMonth:5,endMonth:12,deposits:{10:{amount:123}}}};}
 const recs=[...E.flatten(cloud).values()].map(r=>({...r,revision:1,actor:'elsewhere',updatedAt:{toDate:()=>new Date()}}));
 recs.push({section:'__meta',itemId:'init',payload:JSON.stringify({phase:'ready'}),deleted:false,revision:2,actor:'other',updatedAt:{toDate:()=>new Date()}});
 const sdk={collection:()=>({}),onSnapshot:(_,opts,cb)=>{queueMicrotask(()=>cb({metadata:{fromCache:cache},docs:recs.map(r=>({data:()=>r})),empty:false}));return()=>{};},doc:(_,v)=>v,serverTimestamp:()=>new Date(),runTransaction:async()=>{throw Error('unexpected write')}};
 const nodes={};const node=id=>nodes[id]??(nodes[id]={hidden:false,disabled:false,dataset:{},textContent:'',addEventListener(){},replaceChildren(){},append(){}});
 const m=new Map([['saldoplan.profile.active.v4',scope]]);
 const ls={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};
 const context={window:{SaldoPlanLiveEngine:E,saldoPlanAuthUser:{uid},addEventListener(){}},document:{getElementById:node,createElement:()=>node('created')},
 localStorage:ls,PROFILE_ACTIVE_SCOPE:scope,PROFILE_ACTIVE_KEY:'saldoplan.profile.active.v4',STORAGE_KEY:'accountdata',PREVIOUS_KEY:'previous',state:local,seed,migrateState:x=>structuredClone(x),
 renderAll(){},navigator:{onLine:true},crypto:{randomUUID:()=> 'device'},console,setTimeout,clearTimeout,confirm(){throw Error('Auto flow prompted a user')},sdkForTest:sdk};
 const mocked=code.replace(/  async function openFirebase\(\)\{[\s\S]*?\n  \}/,'  async function openFirebase(){sdk=sdkForTest;db={};return sdk;}');
 assert.notEqual(mocked,code);
 vm.runInNewContext(mocked,context);
 return {wait:ms=>new Promise(r=>setTimeout(r,ms)),linked:()=>ls.getItem(`saldoplan.live.v51.linked.${scope}`)===uid,state:()=>context.state,status:()=>node('sp51LiveStatus').textContent};
}
(async()=>{
 const matched=simulate({kind:'matching'});await matched.wait(85);assert(matched.linked());assert.equal(matched.state().transactions.length,2);console.log('Matching local data + cloud extras: AUTO PASS');
 const blank=simulate({kind:'blank'});await blank.wait(85);assert(blank.linked());assert.equal(blank.state().transactions.length,1);console.log('Blank profile: AUTO PASS');
 const diverged=simulate({kind:'different'});await diverged.wait(85);assert(!diverged.linked());assert.equal(diverged.state().transactions[0].amount,200);console.log('Conflicting local data: MANUAL PASS');
 const unique=simulate({kind:'localOnly'});await unique.wait(85);assert(!unique.linked());console.log('Unique local data: MANUAL PASS');
 const gen=simulate({kind:'generated'});await gen.wait(85);assert(gen.linked());assert.equal(gen.state().transactions.length,1);console.log('Generated defaults + remote financial data: AUTO PASS');
 const fgts=simulate({kind:'generatedWithRealFGTS'});await fgts.wait(85);assert(!fgts.linked());console.log('Real FGTS data: MANUAL PASS');
 const cached=simulate({kind:'matching',cache:true});await cached.wait(85);assert(!cached.linked());console.log('Unconfirmed cache: NO AUTO PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
