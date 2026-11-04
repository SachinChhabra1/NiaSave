import { randomBytes } from 'node:crypto';
import * as core from '../lib/commerce/core.mjs';
import { member, seedInvestorDemo } from './investor-fixtures.mjs';
import { investorDemo, demoHeaders } from './investor-mode.mjs';
const cookieName='nia_investor_demo';
const operator={id:'demo-operator',role:'admin',staff:true};
export function createInvestorHandler(run) {
 return async (req,res,path)=>{
  const send=(status,body,headers={})=>{res.writeHead(status,{'content-type':'application/json',...demoHeaders,...headers});res.end(JSON.stringify(body));};
  if(!investorDemo())return send(404,{error:'not_found'});
  if(!['GET','POST'].includes(req.method))return send(405,{error:'method_not_allowed'});
  // Browser mutations originate inside the demo frame, never at its parent.
  if(req.method==='POST'&&req.headers.origin!==`https://${req.headers.host}`&&!(process.env.NODE_ENV==='test'&&req.headers.origin===`http://${req.headers.host}`))return send(403,{error:'same_origin_required'});
  let body={};
  try {if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16384)return send(413,{error:'body_too_large'});}body=JSON.parse(raw||'{}');}}catch{return send(400,{error:'invalid_json'});}
  const now=Date.now();
  try {
   const result=await run(s=>{
    seedInvestorDemo(s,now);
    const c=s.commerce;
    const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    const session=c.sessions[core.hash(token||'')];
    let cookie;
    if(!session||session.expires<=now){
     for(const [k,v] of Object.entries(c.sessions))if(v.expires<=now)delete c.sessions[k];
     const fresh=randomBytes(32).toString('hex');
     c.sessions[core.hash(fresh)]={accountId:member.id,expires:now+43200000};
     cookie=`${cookieName}=${fresh}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=43200`;
    }
    let data,status=200;
    if(req.method==='GET'&&path==='/catalogue')data={...core.catalogue(s,[],true,now),account:member,capabilities:{saveShoppingOpen:true,saveReservations:true},demo:true};
    else if(req.method==='GET'&&path==='/orders')data={orders:core.listOrders(s,member)};
    else if(req.method==='POST'&&path==='/quote')data=core.quote(s,member,body,[],true,now);
    else if(req.method==='POST'&&path==='/orders'){data=core.reserve(s,member,body,req.headers['idempotency-key'],[],true,now);status=201;}
    else if(req.method==='GET'&&path==='/ops')data={orders:core.listOrders(s,member),demo:true,paymentsEnabled:false};
    else if(req.method==='POST'&&path==='/ops/payment'){
     const o=s.orders.find(o=>o.id===body.orderId);
     if(!o)throw new core.CommerceError('order_not_found',404);
     // Simulate packing and moving the bag to pickup through real transitions.
     for(let step=0;step<3;step++){
      if(['reserved','picked','packed','loaded'].includes(o.status)){
       const next={reserved:'packed',picked:'packed',packed:'loaded',loaded:'out_for_delivery'}[o.status];
       core.staffAction(s,operator,{orderId:o.id,action:next},now);
      }
     }
     data=core.staffAction(s,operator,{...body,action:'verify_payment',receiptVerified:true},now);
    }else if(req.method==='POST'&&path==='/ops/collect')data=core.staffAction(s,operator,{orderId:body.orderId,action:'collect_at_stop',pickupCode:body.pickupCode},now);
    else return {status:404,body:{error:'not_found'}};
    return {status,body:data,headers:cookie?{'set-cookie':cookie}:{}};
   });
   return send(result.status,result.body,result.headers);
  }catch(e){return send(e instanceof core.CommerceError?e.status:503,{error:e instanceof core.CommerceError?e.message:'demo_unavailable'});}
 };
}
