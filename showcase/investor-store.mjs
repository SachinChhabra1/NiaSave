import { hasDurableStore, loadRuntimeState, saveRuntimeState } from '../lib/runtime-store.mjs';
import { createStateRunner } from '../lib/commerce/transaction.mjs';
import { investorDemo } from './investor-mode.mjs';
let state={};
const run=createStateRunner({durable:()=>true,load:()=>loadRuntimeState('investor-demo-v1',{}),save:(s,v)=>saveRuntimeState('investor-demo-v1',s,v),snapshot:()=>state,restore:s=>{state=s;}});
export function withInvestorState(work){
 if(!investorDemo()||!hasDurableStore())return Promise.resolve({status:503,body:{error:'demo_storage_unavailable'}});
 return run(true,()=>work(state));
}
