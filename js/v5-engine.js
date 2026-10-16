/* SaldoPlan v5: analisador financeiro determinístico. Nenhuma chamada à rede. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.saldoPlanV5Engine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Math.round((Number(n)||0)*100)/100);
  const safeText=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const money=x=>Number.isFinite(Number(x))?Number(x):0;
  function monthBefore(month){const [y,m]=String(month).split('-').map(Number);const d=new Date(Date.UTC(y,m-2,1));return d.toISOString().slice(0,7);}
  function transactions(state,month){return (Array.isArray(state?.transactions)?state.transactions:[]).filter(t=>String(t.date||'').slice(0,7)===month&&t.status==='realized');}
  function totals(state,month){
    const rows=transactions(state,month);let income=0,expense=0;const categories={};
    for(const t of rows){const n=money(t.amount);if(t.kind==='income')income+=n;else if(t.kind==='expense'){expense+=n;const name=String(t.category||'Outros');categories[name]=(categories[name]||0)+n;}}
    return {income,expense,balance:income-expense,count:rows.length,categories};
  }
  function analyze(state,month,input){
    const q=safeText(input).trim();const data=totals(state,month);const old=totals(state,monthBefore(month));
    if(!q)return 'Escolha uma pergunta para começar.';
    if(/(meta|objetivo)/.test(q)){
      const goals=(state?.financialGoals||[]).slice(0,8);
      return goals.length?goals.map(g=>{const target=money(g.targetAmount),current=money(g.currentAmount);return `${g.name||'Meta'}: ${brl(current)} de ${brl(target)} (acompanhamento ${g.source==='manual'?'manual':'vinculado'}).`;}).join('\n'):'Você ainda não cadastrou metas financeiras em Patrimônio.';
    }
    if(/(categoria|mais gastei|maiores gasto)/.test(q)){
      const items=Object.entries(data.categories).sort((a,b)=>b[1]-a[1]).slice(0,5);
      return items.length?`Maiores categorias em ${month}:\n`+items.map(([name,total])=>`${name}: ${brl(total)}`).join('\n'):'Não há despesas realizadas neste mês.';
    }
    if(/(anterior|compar|evolu|diferenc|mudou)/.test(q)){
      const diff=data.expense-old.expense;
      return `Despesas realizadas em ${month}: ${brl(data.expense)}.\nMês anterior: ${brl(old.expense)}.\nVariação: ${diff>=0?'+':''}${brl(diff)}.\nSaldo atual: ${brl(data.balance)}.`;
    }
    if(/(aliment|mercado|transporte|educa|moradia|saude|lazer|categoria )/.test(q)){
      const category=Object.entries(data.categories).find(([name])=>q.includes(safeText(name)));
      if(category)return `Gastos realizados com ${category[0]} em ${month}: ${brl(category[1])}.`;
    }
    if(/(guard|economiz|saldo|sobr|poup)/.test(q))return `Entradas realizadas: ${brl(data.income)}. Despesas realizadas: ${brl(data.expense)}. Saldo dessas movimentações: ${brl(data.balance)}. Não inclui projeções nem corrige automaticamente pagamentos duplicados de cartão.`;
    if(/(receit|entrada|ganhe|salari)/.test(q))return `Entradas realizadas em ${month}: ${brl(data.income)} (${data.count} lançamentos realizados no total).`;
    if(/(gast|despes|quanto)/.test(q))return `Despesas realizadas em ${month}: ${brl(data.expense)}. Entradas: ${brl(data.income)}. Saldo: ${brl(data.balance)}.`;
    return 'Ainda não tenho uma regra para essa pergunta. Experimente: “quanto gastei?”, “maiores categorias”, “mês anterior”, “saldo” ou “minhas metas”. As respostas usam somente seus dados locais.';
  }
  return {analyze,totals,monthBefore};
});
