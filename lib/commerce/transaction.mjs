import {isDeepStrictEqual} from 'node:util';
// Work is re-evaluated after a CAS conflict. Keep external side effects outside work().
export function createStateRunner({durable,load,save,snapshot,restore,skipRead=()=>false,validate=()=>true,prepareSave=(_loaded,candidate)=>candidate}) {
 let queue=Promise.resolve();
 return function run(mutating,work,forceRead=false) {
  async function execute() {
   for(let attempt=0;attempt<4;attempt++) {
    let loaded;
    if(durable() && (mutating||forceRead||!skipRead())) {
     try {loaded=await load();} catch {return {status:503,body:{error:'save_storage_unavailable'}};}
     if(loaded.storage!=='postgres'||loaded.version<1) return {status:503,body:{error:'save_storage_unavailable'}};
     restore(loaded.value,loaded.storage);
    }
    const before=structuredClone(snapshot());
    try {
     const result=await work();
     if(result?.status>=400){restore(before);return result;}
     if(!validate(before,snapshot())){restore(before);return {status:503,body:{error:'pilot_commitments_paused'}};}
     if(!mutating){if(!isDeepStrictEqual(before,snapshot()))restore(before);return result;}
     if(!loaded)return result;
     const saved=await save(prepareSave(loaded.value,snapshot()),loaded.version);
     if(saved.ok&&saved.storage==='postgres')return result;
     restore(before);
     if(!saved.conflict)return {status:503,body:{error:'save_storage_unavailable'}};
    }catch(error){restore(before);throw error;}
   }
   return {status:409,body:{error:'state_conflict'}};
  }
  const pending=queue.then(execute,execute);queue=pending.catch(()=>{});return pending;
 };
}
