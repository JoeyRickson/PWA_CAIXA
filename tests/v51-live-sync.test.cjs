const assert=require('node:assert/strict');
const S=require('../js/v51-live-engine.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const original={version:2,cloud:{provider:'google',folderId:'private'},savingGoal:500,
  settings:{theme:'dark'},transactions:[{id:'a',description:'Compra',amount:50},{id:'b',description:'Almoço',amount:30}],
  financialGoals:[{id:'g',name:'Casa',currentAmount:100}],payrollMonths:{'2026-10':{base:100},'2026-11':{base:110}},importHistory:[]};
const edited=clone(original);edited.transactions[0].amount=70;edited.transactions.push({id:'c',description:'Fatura',amount:90});edited.financialGoals[0].currentAmount=200;edited.payrollMonths['2026-11'].base=120;edited.savingGoal=700;
const delta=S.difference(original,edited);
assert.equal(delta.length,5,'5 mudanças por registro');
assert(delta.some(x=>x.section==='transactions'&&x.itemId==='id:a'));
assert(delta.some(x=>x.section==='transactions'&&x.itemId==='id:c'));
assert(delta.some(x=>x.section==='financialGoals'&&x.itemId==='id:g'));
assert(delta.some(x=>x.section==='payrollMonths'&&x.itemId==='map:2026-11'));
assert(delta.some(x=>x.section==='savingGoal'));
const remote=clone(original);for(const change of delta)S.applyRecord(remote,change);
assert.deepEqual(remote,edited,'aplicar alterações reproduz o estado editado');
const deleted=clone(edited);deleted.transactions=deleted.transactions.filter(x=>x.id!=='b');
const tomb=S.difference(edited,deleted);assert.equal(tomb.length,1);assert.equal(tomb[0].deleted,true);S.applyRecord(remote,tomb[0]);
assert.deepEqual(remote,deleted,'exclusão se propaga como tombstone');
const empty=S.emptySynced(original);assert.equal(empty.cloud.provider,'google');assert.equal(empty.transactions.length,0);assert.equal(empty.savingGoal,null);
const clear=clone(original);for(const [k,rec] of S.flatten(original))if(k.startsWith('transactions|'))S.applyRecord(clear,{...rec,deleted:true,payload:''});
assert.equal(clear.transactions.length,0);
assert(S.idFor('transactions','id:a').startsWith('r_'));
assert(![...S.flatten(original)].some(([k])=>k.startsWith('cloud|')),'credenciais cloud nao sao sincronizadas');
const legacy={transactions:[{description:'duplicado',amount:5},{description:'duplicado',amount:5}]};
assert.equal(S.flatten(legacy).size,2,'duplicatas legadas preservadas');
console.log('v5.1 Live Sync: 10 verificações PASS (diferenças, mescla, exclusões, isolamento e legado)');
