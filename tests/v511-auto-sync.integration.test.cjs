'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const E = require('../js/v51-live-engine.js');
const code = fs.readFileSync(require('node:path').join(__dirname,'..','js','v51-live-sync.js'),'utf8');
function harness({initial='new', cloud='existing'}={}){
 const uid='test_ABC123', scope='user_'+uid;
 const seed={version:2,cloud:{provider:'google'},transactions:[{id:'fake',description:'Demo',amount:100}],settings:{theme:'light'},financialGoals:[],importHistory:[],fgtsByYear:{},creditCards:[],cardPurchases:[],budgets:[],payrollConfig:{baseSalary:5000}};
 const pristine=E.blankProfileTemplate(seed,x=>structuredClone(x));
 const local=structuredClone(pristine);
 if(initial==='changed')local.transactions.push({id:'local',description:'Celular',amount:2});
 const remote=cloud==='existing'?[{section:'transactions',itemId:'id:fromcloud',payload:JSON.stringify({id:'fromcloud',description:'Computador',amount:1}),deleted:false,revision:1,actor:'computer',updatedAt:{toDate:()=>new Date()}}]:[];
 const marker=cloud==='existing'?{section:'__meta',itemId:'init',payload:JSON.stringify({phase:'ready',actor:'computer'}),deleted:false,revision:2,actor:'computer',updatedAt:{toDate:()=>new Date()}}:null;
 let calls=0, snapshots;
 const docs=()=>[...remote, ...(marker?[marker]:[])].map(r=>({data:()=>r}));
 const sdk={collection:()=>({}),doc:(_,path)=>path,onSnapshot:(_,opts,cb)=>{snapshots=cb;queueMicrotask(()=>cb({metadata:{fromCache:false},docs:docs(),empty:!docs().length}));return ()=>{};},
  serverTimestamp:()=>new Date(),runTransaction:async(_,fn)=>fn({get:async()=>({exists:()=>false}),set:()=>{calls++},update:()=>{calls++}})};
 const elements={}; const node=id=>elements[id]??(elements[id]={dataset:{},textContent:'',hidden:false,disabled:false,addEventListener(){},replaceChildren(){},append(){}});
 const m=new Map([['saldoplan.profile.active.v4',scope],[`meuCaixa.profile.${scope}.v4`,JSON.stringify(local)]]);
 const localStorage={getItem:key=>m.has(key)?m.get(key):null,setItem:(key,v)=>m.set(key,String(v)),removeItem:key=>m.delete(key)};
 const context={
  window:{SaldoPlanLiveEngine:E,saldoPlanAuthUser:{uid},addEventListener(){}},document:{getElementById:node,createElement:()=>node('elem')},
  localStorage, PROFILE_ACTIVE_SCOPE:scope, PROFILE_ACTIVE_KEY:'saldoplan.profile.active.v4',STORAGE_KEY:`meuCaixa.profile.${scope}.v4`,PREVIOUS_KEY:'previous',
  state:local,seed,migrateState:x=>structuredClone(x), renderAll(){},navigator:{onLine:true},crypto:{randomUUID:()=> 'device'},console,
  setTimeout,clearTimeout,confirm(){throw Error('Unexpected confirm() during automatic login');},
  sdkForTest:sdk
 };
 const stubbed=code.replace(/  async function openFirebase\(\)\{[\s\S]*?\n  \}/,`  async function openFirebase(){sdk=sdkForTest;db={};return sdk;}`);
 assert.notEqual(stubbed,code,'firebase stub patched');
 vm.runInNewContext(stubbed,context,{filename:'v51-live-sync.js'});
 return {localStorage, context, uid, scope, sdk, m, node, calls:()=>calls, wait:ms=>new Promise(r=>setTimeout(r,ms))};
}
async function main(){
 const a=harness();await a.wait(35);
 assert.equal(a.localStorage.getItem(`saldoplan.live.v51.linked.${a.scope}`),a.uid,'login links a pristine profile');
 assert.equal(a.context.state.transactions.length,1,'cloud record downloaded');
 assert.equal(a.context.state.transactions[0].amount,1);
 console.log('AUTO LOGIN cloud -> pristine: PASS');
 const b=harness({initial:'changed'});await b.wait(35);
 assert.equal(b.localStorage.getItem(`saldoplan.live.v51.linked.${b.scope}`),null,'no automatic replacement of local data');
 assert.equal(b.context.state.transactions[0].amount,2);
 console.log('LOCAL DATA conflict -> manual: PASS');
 const c=harness({initial:'new',cloud:'empty'});await c.wait(75);
 assert.equal(c.localStorage.getItem(`saldoplan.live.v51.linked.${c.scope}`),c.uid,'new account linked');
 assert(c.calls()>=1,'bootstrap marker created');
 console.log('AUTO LOGIN empty cloud -> initializes: PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1});
