'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const E=require('../js/v53-planning-engine.js');
let count=0;const check=(name,fn)=>{try{fn();count++;}catch(err){console.error('FAIL:',name);throw err;}};
const ref='2026-10-20';
check('validDate rejects impossible dates',()=>{assert.equal(E.validDate('2026-02-30'),false);assert.equal(E.validDate('2026-02-28'),true)});
check('plusDays crosses month end and leap day',()=>{assert.equal(E.plusDays('2026-10-31',1),'2026-11-01');assert.equal(E.plusDays('2028-02-28',1),'2028-02-29')});
check('plusMonths crosses year',()=>assert.equal(E.plusMonths('2026-12',2),'2027-02'));
check('billDate clamps month end',()=>assert.equal(E.billDate('2027-02',31),'2027-02-28'));
check('empty forecast retains opening',()=>{const f=E.forecast({}, {date:ref,openingBalance:123,days:90});assert.equal(f.balance,123);assert.equal(f.at30,123)});
const rows={transactions:[
  {kind:'income',amount:150,date:'2026-10-25',status:'planned'},
  {kind:'expense',amount:40,date:'2026-10-24',status:'planned',paySource:'cash'},
  {kind:'expense',amount:80,date:'2026-10-24',status:'realized',paySource:'cash'},
  {kind:'income',amount:800,date:'2026-10-22',status:'realized'},
  {kind:'expense',amount:120,date:'2026-10-26',status:'planned',paySource:'flash'},
  {kind:'income',amount:300,date:'2026-10-23',status:'planned',incomeType:'flash'},
  {kind:'expense',amount:60,date:'2026-10-27',status:'planned',paySource:'cash',cardPurchaseId:'a'},
  {kind:'expense',amount:50,date:'2026-10-19',status:'planned',paySource:'cash'}
]};
check('forecast includes only pending non-bonus after start',()=>{const f=E.forecast(rows,{date:ref,openingBalance:100,days:30});assert.equal(f.balance,150);assert.equal(f.income,150);assert.equal(f.expense,100);assert.equal(f.pendingCount,3)});
check('forecast does not re-add realized expenses/income',()=>assert.equal(E.forecast(rows,{date:ref,openingBalance:100,days:2}).balance,100));
check('forecast detects first negative day',()=>{const f=E.forecast({transactions:[{kind:'expense',amount:80,date:'2026-10-21',status:'planned'}]},{date:ref,openingBalance:40,days:30});assert.equal(f.firstNegative,'2026-10-21')});
check('forecast rejects NaN',()=>assert.throws(()=>E.forecast({}, {date:ref,openingBalance:NaN}),/Saldo/));
check('forecast stops at day 90',()=>{const s={transactions:[{kind:'expense',amount:99,date:E.plusDays(ref,91),status:'planned'}]};assert.equal(E.forecast(s,{date:ref,openingBalance:50,days:90}).balance,50)});
check('alerts include planned expenses',()=>assert.equal(E.dueAlerts(rows,ref,7).length,3));
check('alerts exclude flash? applies to due monitoring',()=>assert(E.dueAlerts(rows,ref,7).some(t=>t.amount===120)));
check('alerts exclude realized items',()=>assert(!E.dueAlerts(rows,ref,7).some(t=>t.amount===80)));
check('card simulation respects closing date',()=>{const x=E.cardSimulation({closingDay:8,dueDay:20},200,2,'2026-10-09');assert.equal(x[0].date,'2026-11-20');assert.equal(x[1].date,'2026-12-20')});
check('card on closing date belongs current statement',()=>assert.equal(E.cardSimulation({closingDay:8,dueDay:20},100,1,'2026-10-08')[0].date,'2026-10-20'));
check('card installment cent sum is exact',()=>{const x=E.cardSimulation({closingDay:3,dueDay:5},100,3,ref);assert.deepEqual(x.map(y=>y.amount),[33.34,33.33,33.33]);assert.equal(E.round(x.reduce((a,b)=>a+b.amount,0)),100)});
check('card rejects zero',()=>assert.throws(()=>E.cardSimulation({closingDay:5,dueDay:5},0,1,ref)));
check('card respects February due day',()=>assert.equal(E.cardSimulation({closingDay:31,dueDay:31},10,1,'2027-02-20')[0].date,'2027-02-28'));
check('goals return monthly target',()=>{const x=E.goals({financialGoals:[{id:'g',name:'Casa',targetAmount:12000,currentAmount:6000,deadline:'2027-04-30'}]},ref);assert.equal(x[0].remaining,6000);assert(x[0].monthlyAmount>0)});
check('goals without due date do not invent monthly need',()=>{const x=E.goals({financialGoals:[{name:'Viagem',targetAmount:1000,currentAmount:0}]},ref);assert.equal(x[0].monthlyAmount,null)});
check('goals overdue flag',()=>assert.equal(E.goals({financialGoals:[{name:'Meta',targetAmount:100,currentAmount:0,deadline:'2020-01-01'}]},ref)[0].overdue,true));
check('bank reconciliation uses sign bank minus app',()=>{const x=E.reconciliation(100,115);assert.equal(x.difference,-15);assert.equal(x.balanced,false)});
check('bank reconciliation rounded cent',()=>assert.equal(E.reconciliation(100.001,100).balanced,true));
check('bank reject infinity',()=>assert.throws(()=>E.reconciliation(Infinity,100)));
check('single view integrated into view loader',()=>assert.match(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),/'planning'/));
check('UI IDs present',()=>{const src=fs.readFileSync(path.join(__dirname,'../views/planning.html'),'utf8');for(const id of ['sp53ForecastForm','sp53CardForm','sp53BankForm','sp53Goals','sp53Alerts'])assert(src.includes(`id="${id}"`))});
check('Live sync has section support through updated baseline',()=>{const core=fs.readFileSync(path.join(__dirname,'../js/core.js'),'utf8');assert.match(core,/planningSettings:/);assert.match(core,/bankChecks:/)});
check('New JS syntax valid',()=>{require('node:vm').runInNewContext(fs.readFileSync(path.join(__dirname,'../js/v53-planning.js'),'utf8'),{window:{addEventListener(){},SaldoPlanPlanningEngine:E},document:{getElementById(){return null;}}})});
console.log(`SaldoPlan v5.3 Planejamento: ${count} verificações PASS`);
