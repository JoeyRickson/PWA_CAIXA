const assert=require('node:assert/strict');
const E=require('../js/v51-live-engine.js');
const seed={version:2,cloud:{provider:'google'},transactions:[{id:'demo',amount:100}],creditCards:[],
  payrollConfig:{baseSalary:5000},financialGoals:[],fgtsByYear:{},fgtsAccounts:[],settings:{theme:'light'},
  fixedTemplates:[],savingTemplates:[],savings:[],overtimeLogs:[],importHistory:[]};
const migrate=x=>JSON.parse(JSON.stringify(x));
const fresh=E.blankProfileTemplate(seed,migrate);
assert.equal(fresh.transactions.length,0,'exemplos não pertencem a um perfil novo');
assert(E.isPristineProfile(JSON.parse(JSON.stringify(fresh)),fresh),'perfil novo permite auto sync');
const withExpense=JSON.parse(JSON.stringify(fresh));withExpense.transactions.push({id:'real',amount:2});
assert(!E.isPristineProfile(withExpense,fresh),'lançamento existente exige decisão manual');
const withSettings=JSON.parse(JSON.stringify(fresh));withSettings.settings.theme='dark';
assert(!E.isPristineProfile(withSettings,fresh),'configuração alterada exige decisão manual');
const withBudget=JSON.parse(JSON.stringify(fresh));withBudget.budgets=[{id:'b',limit:10}];
assert(!E.isPristineProfile(withBudget,fresh),'orçamento existente exige decisão manual');
const withSalary=JSON.parse(JSON.stringify(fresh));withSalary.payrollConfig.baseSalary=6000;
assert(!E.isPristineProfile(withSalary,fresh),'valor alterado exige decisão manual');
const noCredentialChange=JSON.parse(JSON.stringify(fresh));noCredentialChange.cloud={provider:'onedrive',privateToken:'local'};
assert(E.isPristineProfile(noCredentialChange,fresh),'preferência local de backup isolada da sincronização');
const missing=JSON.parse(JSON.stringify(fresh));delete missing.settings;
assert(!E.isPristineProfile(missing,fresh),'dados incompletos não são perfil inicial');
assert(!E.isPristineProfile(null,fresh),'estado inválido é bloqueado');
const source=require('fs').readFileSync(require('path').join(__dirname,'..','js','v51-live-sync.js'),'utf8');
assert(source.includes('if(snap.metadata.fromCache)'), 'snapshot offline não inicia vinculação');
assert(source.includes('void autoConnect(expectedEpoch)'), 'primeiro login deve conectar automaticamente');
assert(source.includes("E.isPristineProfile(state,freshTemplate)"),'guard de perfil inicial ativo');
assert(source.includes("if(remoteMeta?.phase==='initializing')"),'bootstrap de outro dispositivo deve ser respeitado');
console.log('v5.1.1 Auto Sync: 12 verificações PASS (login, perfil inicial, proteção de dados e cache)');
