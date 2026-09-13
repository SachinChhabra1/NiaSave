import {AsyncLocalStorage} from 'node:async_hooks';
const requests=new AsyncLocalStorage();
export const p0ReadOnly=()=>requests.getStore()?.readOnly===true;
export const withP0Request=(req,work)=>requests.run({readOnly:['GET','HEAD','OPTIONS'].includes(req.method)},work);
