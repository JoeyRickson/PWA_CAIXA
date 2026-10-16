'use strict';
const assert=require('node:assert/strict');
const E=require('../js/v5-engine.js');
const sample={transactions:[
  {kind:'income',amount:4000,date:'2026-10-12',status:'realized'},
  {kind:'expense',amount:200,date:'2026-10-12',category:'Alimentação',status:'realized'},
  {kind:'expense',amount:100,date:'2026-10-14',category:'Alimentação',status:'realized'},
  {kind:'expense',amount:400,date:'2026-09-21',category:'Moradia',status:'realized'},
  {kind:'expense',amount:900,date:'2026-10-20',category:'Moradia',status:'planned'}],
  financialGoals:[{name:'Casa',targetAmount:10000,currentAmount:500,source:'manual'}]};
assert.deepEqual(E.totals(sample,'2026-10'),{income:4000,expense:300,balance:3700,count:3,categories:{'Alimentação':300}});
assert.equal(E.monthBefore('2026-01'),'2025-12');
assert.match(E.analyze(sample,'2026-10','Quanto gastei?'),/300,00/);
assert.match(E.analyze(sample,'2026-10','alimentação'),/300,00/);
assert.match(E.analyze(sample,'2026-10','mês anterior'),/400,00/);
assert.match(E.analyze(sample,'2026-10','minhas metas'),/Casa/);
assert.match(E.analyze({transactions:[],financialGoals:[]},'2026-10','quais categorias'),/Não há despesas/);
console.log('V5 analytics: 7 checks PASS');
