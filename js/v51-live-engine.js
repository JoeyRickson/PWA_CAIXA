/* SaldoPlan v5.1 — núcleo determinístico de sincronização; sem rede e sem estado global. */
(function(root){
  'use strict';
  const EXCLUDED=new Set(['version','cloud']); // credenciais/preferências de backup permanecem no aparelho
  const KEYED_MAPS=new Set(['payrollMonths','thirteenthByYear','fgtsByYear']);
  const isObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const text=value=>JSON.stringify(value);
  function hash(value){
    // Identificador de fallback para arrays antigos que não têm ID.
    // Duas sequências FNV independentes reduzem colisões, mas não substituem UUIDs.
    const str=typeof value==='string'?value:text(value);
    let a=2166136261,b=267341227;for(let i=0;i<str.length;i++){
      a=Math.imul(a^str.charCodeAt(i),16777619)>>>0;
      b=Math.imul(b^str.charCodeAt(i),2246822519)>>>0;
    }
    return a.toString(16).padStart(8,'0')+b.toString(16).padStart(8,'0');
  }
  function recordKey(section,itemId){return `${section}|${itemId}`;}
  function idFor(section,itemId){return 'r_'+encodeURIComponent(recordKey(section,itemId));}
  function flatten(data){
    const out=new Map();
    if(!isObject(data))return out;
    for(const [section,value] of Object.entries(data)){
      if(EXCLUDED.has(section))continue;
      if(Array.isArray(value)){
        const duplicates=new Map();
        for(const item of value){
          // Para registros históricos sem ID, conteúdo + ordinal preservam duplicatas idênticas.
          const hasId=isObject(item)&&(typeof item.id==='string'||typeof item.id==='number')&&String(item.id).length>0;
          const base=hasId?`id:${item.id}`:`legacy:${hash(item)}`;
          const ordinal=duplicates.get(base)||0;duplicates.set(base,ordinal+1);
          const itemId=ordinal?`${base}#${ordinal}`:base;
          const key=recordKey(section,itemId);
          out.set(key,{section,itemId,payload:text(item),deleted:false});
        }
      }else if(KEYED_MAPS.has(section)&&isObject(value)){
        for(const [itemId,item] of Object.entries(value)){
          const key=recordKey(section,`map:${itemId}`);
          out.set(key,{section,itemId:`map:${itemId}`,payload:text(item),deleted:false});
        }
      }else{
        const key=recordKey(section,'value');
        out.set(key,{section,itemId:'value',payload:text(value),deleted:false});
      }
    }
    return out;
  }
  // Perfil novo criado pelo v4-features: somente dados iniciais; sem os exemplos da seed.
  // A comparação é estrita: QUALQUER alteração financeira/local não padrão impede auto-restauração.
  function blankProfileTemplate(seed,migrateState){
    const baseline=JSON.parse(JSON.stringify(seed));
    for(const section of ['transactions','savings','fixedTemplates','savingTemplates',
      'overtimeLogs','investments','financialGoals','fgtsAccounts','creditCards','cardPurchases'])baseline[section]=[];
    baseline.fgtsByYear={};
    return migrateState(baseline);
  }
  function isPristineProfile(current,baseline){
    if(!isObject(current)||!isObject(baseline))return false;
    const now=flatten(current),original=flatten(baseline);
    if(now.size!==original.size)return false;
    for(const [key,value] of original){
      const actual=now.get(key);
      if(!actual||actual.payload!==value.payload)return false;
    }
    return true;
  }
  // Perfis novos podem receber registros padrao como efeito colateral do render.
  // Aceitar apenas os formatos EXATOS emitidos automaticamente. Qualquer dado
  // adicional, historico real ou valor editado exige decisao do usuario.
  function isGeneratedFreshProfile(current,baseline,nowISO=new Date().toISOString().slice(0,10)){
    if(!isObject(current)||!isObject(baseline))return false;
    const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const plain=current.payrollMonths;
    if(!isObject(plain)||!Object.entries(plain).every(([key,value])=>
      /^\d{4}-\d{2}$/.test(key)&&exact(value,{holidayCount:0,referenceHours:null})))return false;
    const thirteenth=current.thirteenthByYear;
    if(!isObject(thirteenth)||!Object.entries(thirteenth).every(([key,value])=>{
      if(!/^\d{4}$/.test(key))return false;
      const year=Number(key);
      return exact(value,{
        startMonth:year===2026?5:1,endMonth:12,
        firstDate:year===2026?'2026-07-23':`${key}-11-30`,
        secondDate:`${key}-12-18`,firstAmount:null,secondAmount:null,
        firstPaid:year===2026,secondPaid:false
      });
    }))return false;
    const fgts=current.fgtsByYear;
    if(!isObject(fgts)||!Object.entries(fgts).every(([key,value])=>
      /^\d{4}$/.test(key)&&exact(value,{startMonth:Number(key)===2026?5:1,endMonth:12,deposits:{}})))return false;
    const snapshots=current.netWorthSnapshots;
    if(!Array.isArray(snapshots)||snapshots.length>1||!snapshots.every(snapshot=>
      isObject(snapshot)&&exact(snapshot,{
        date:nowISO,total:0,assets:0,liabilities:0
      })))return false;
    // Nada fora dessas quatro secoes pode divergir do perfil novo original.
    const normalized={...current,
      payrollMonths:baseline.payrollMonths,
      thirteenthByYear:baseline.thirteenthByYear,
      fgtsByYear:baseline.fgtsByYear,
      netWorthSnapshots:baseline.netWorthSnapshots};
    return isPristineProfile(normalized,baseline);
  }
  // A vinculação silenciosa também é segura se a nuvem já contém, sem
  // divergências, TODOS os registros locais. Registros extras na nuvem são
  // recuperados; registros exclusivos ou modificados neste aparelho bloqueiam.
  function isEntireLocalProfileOnCloud(local,cloud){
    if(!isObject(local)||!cloud||typeof cloud.get!=='function'||!cloud.size)return false;
    const own=flatten(local);
    if(!own.size)return false;
    for(const [key,item] of own){
      const online=cloud.get(key);
      if(!online||online.deleted||online.payload!==item.payload)return false;
    }
    return true;
  }
  function signature(record){return record&&!record.deleted?hash(record.payload):null;}
  function difference(before,after){
    const old=flatten(before),now=flatten(after),changes=[];
    for(const key of new Set([...old.keys(),...now.keys()])){
      const a=old.get(key),b=now.get(key);
      if((a?.payload??null)===(b?.payload??null))continue;
      const basis=b||a;
      changes.push({...basis,deleted:!b,payload:b?.payload||''});
    }
    return changes;
  }
  function matches(section,itemId,item,index){
    if(itemId.startsWith('id:')){
      const id=itemId.slice(3).replace(/#\d+$/,'');
      return String(item?.id)===id;
    }
    // A posição é calculada pelo retrato atual. IDs antigos sem id não são ótimos
    // para edições concorrentes; o aplicativo não descarta conflitos automaticamente.
    const flattened=flatten({[section]:[item]});
    return flattened.has(recordKey(section,itemId)) && index===0;
  }
  function applyRecord(target,record){
    const {section,itemId,deleted}=record;
    if(EXCLUDED.has(section)||!(section in target))return false;
    const value=deleted?undefined:JSON.parse(record.payload);
    if(Array.isArray(target[section])){
      let index=-1;
      const array=target[section];
      if(itemId.startsWith('id:')){
        const id=itemId.slice(3).replace(/#\d+$/,'');
        index=array.findIndex(x=>String(x?.id)===id);
      }else{
        const map=flatten({[section]:array});
        const current=map.get(recordKey(section,itemId));
        if(current){
          let i=0;
          for(const [k] of map){if(k===recordKey(section,itemId)){index=i;break;}i++;}
        }
      }
      if(deleted){if(index<0)return false;array.splice(index,1);return true;}
      if(index<0){array.push(value);return true;}
      if(text(array[index])===record.payload)return false;
      array[index]=value;return true;
    }
    if(KEYED_MAPS.has(section)){
      if(!isObject(target[section]))target[section]={};
      const key=itemId.replace(/^map:/,'');
      if(deleted){if(!(key in target[section]))return false;delete target[section][key];return true;}
      if(text(target[section][key])===record.payload)return false;
      target[section][key]=value;return true;
    }
    if(deleted)return false; // valores escalares têm sempre documento próprio
    if(text(target[section])===record.payload)return false;
    target[section]=value;return true;
  }
  function emptySynced(target){
    const clone=JSON.parse(JSON.stringify(target));
    for(const [key,value] of Object.entries(clone)){
      if(EXCLUDED.has(key))continue;
      if(Array.isArray(value))clone[key]=[];
      else if(isObject(value))clone[key]={};
      else clone[key]=null;
    }
    return clone;
  }
  const api={flatten,difference,signature,hash,applyRecord,emptySynced,blankProfileTemplate,isPristineProfile,isGeneratedFreshProfile,isEntireLocalProfileOnCloud,idFor,recordKey,EXCLUDED,KEYED_MAPS};
  root.SaldoPlanLiveEngine=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
