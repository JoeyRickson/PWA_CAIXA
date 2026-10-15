const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const code=fs.readFileSync(path.join(__dirname,'..','js','v4-features.js'),'utf8');
function test(active,choice){
 const map=new Map([['meuCaixa.v1',JSON.stringify({transactions:[{id:'legacy',amount:18}],settings:{theme:'dark'}})]]);
 if(active)map.set('saldoplan.profile.active.v4',active);
 const ls={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
 const el={classList:{add(){},remove(){}},setAttribute(){},addEventListener(){},append(){},innerHTML:'',hidden:false};
 const document={createElement(){return {...el,dataset:{}};},body:{append(){}},addEventListener(){},getElementById(){return null;},documentElement:el};
 const win={location:{reload(){this.reloaded=true;}},addEventListener(){},saldoPlanAuthUser:null};
 const c={localStorage:ls,window:win,document,seed:{transactions:[{id:'demo'}],savings:[{id:'demo'}],cloud:{}},deepClone:x=>JSON.parse(JSON.stringify(x)),confirm:()=>choice,console,Blob,documentElement:el,setTimeout:()=>{},navigator:{}};
 vm.createContext(c);vm.runInContext(code,c);
 return {map,win};
}
{
 const {map,win}=test(null,true);
 assert.strictEqual(win.saldoPlanV4ProfileAuth({uid:'AAA'}),false);
 assert.strictEqual(JSON.parse(map.get('meuCaixa.profile.user_AAA.v4')).transactions[0].id,'legacy');
 assert.strictEqual(map.get('saldoplan.profile.active.v4'),'user_AAA');
 assert.strictEqual(JSON.parse(map.get('meuCaixa.v1')).transactions[0].id,'legacy');
 assert.strictEqual(win.location.reloaded,true);
}
{
 const {map,win}=test(null,false);
 assert.strictEqual(win.saldoPlanV4ProfileAuth({uid:'AAA'}),false);
 assert.strictEqual(JSON.parse(map.get('meuCaixa.profile.user_AAA.v4')).transactions.length,0);
 assert.strictEqual(JSON.parse(map.get('meuCaixa.v1')).transactions[0].id,'legacy');
}
{
 const {map,win}=test('user_OLD',false);
 assert.strictEqual(win.saldoPlanV4ProfileAuth({uid:'NEW'}),false);
 assert.strictEqual(JSON.parse(map.get('meuCaixa.profile.user_NEW.v4')).transactions.length,0);
}
console.log('Account profile tests: 3 scenarios PASS');
{
 const {win}=test('user_AAA',false);
 assert.strictEqual(win.saldoPlanV4ProfileAuth({uid:'AAA'}),true);
 assert.ok(!win.location.reloaded);
}
{
 const {map,win}=test('user_OLD',false);
 assert.strictEqual(win.saldoPlanV4ProfileGuest(),false);
 assert.strictEqual(JSON.parse(map.get('meuCaixa.guest.v4')).transactions.length,0);
 assert.strictEqual(map.get('saldoplan.profile.active.v4'),'guest');
}
console.log('Account profile tests: 2 additional scenarios PASS');
