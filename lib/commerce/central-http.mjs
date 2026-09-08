import { verifyCentralEnvelope } from './central-auth.mjs';
import { previewMode } from './http.mjs';
import { hasDurableStore } from '../runtime-store.mjs';
import { withSaveState, SKUS, DUMMY_DATA } from '../../rabbit/engine.mjs';
import { withLivingState } from '../../bison/engine.mjs';
import * as core from './core.mjs';
import * as nests from './nests.mjs';
import * as earn from './earn.mjs';

export async function centralCommerceHttp(req,res) {
  const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
  try {
    if(req.method!=='POST')return send(405,{error:'method_not_allowed'});
    const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>65536)throw new core.CommerceError('request_too_large',413);chunks.push(chunk);}
    const time=Date.now(), preview=previewMode(), envelope=verifyCentralEnvelope(Buffer.concat(chunks).toString(),req.headers['x-central-signature'],process.env.CENTRAL_COMMERCE_KEY,time);
    if(!preview&&(!hasDurableStore()||DUMMY_DATA||process.env.STAFF_AUTH_REQUIRED!=='1'))throw new core.CommerceError('durable_operations_required',503);
    const {actor,action,line,body={}}=envelope;
    if(!['live','earn','save','send'].includes(line))throw new core.CommerceError('invalid_member_line');
    if(action!=='snapshot'&&!['admin','operator'].includes(actor.role))throw new core.CommerceError('operator_access_required',403);
    // Consume the replay nonce separately; never replay a Living write in Save's CAS loop.
    const auth=await withSaveState(s=>{
      core.initialise(s,SKUS,preview,time);
      if(!preview&&s.dummy!==false)return {status:503,body:{error:'preview_data_cannot_go_live'}};
      const seen=s.commerce.centralNonces||={};for(const [k,v] of Object.entries(seen))if(v<time)delete seen[k];
      if(seen[envelope.nonce])return {status:409,body:{error:'central_request_replayed'}};
      if(!core.rateLimit(s,'central:'+actor.id,time,600))return {status:429,body:{error:'too_many_attempts'}};
      seen[envelope.nonce]=time+120000;return {status:200,body:{ok:true}};
    });
    if(auth.status!==200)return send(auth.status,auth.body);
    let result;
    if(line==='live')result=await withLivingState(s=>{
      if(!preview&&s.dummy!==false)return {status:503,body:{error:'preview_data_cannot_go_live'}};
      if(action==='configure')return {status:200,body:nests.configureNests(s,body,actor,time,preview)};
      if(action!=='snapshot')throw new core.CommerceError('unknown_operation');
      const catalogue=nests.nestCatalogue(s,preview,time);
      const assigned=s.memberCatalogue?.staffStudios?.[actor.id]||[];
      return {status:200,body:{preview,actor,line,owner:'Jat Unit',catalogue,config:actor.role==='admin'?s.memberCatalogue:null,
        studios:s.studios.map(st=>({id:st.id,name:st.name,city:st.city,capacity:st.capacity})),
        bookings:actor.role!=='reader'?s.bookings.filter(b=>b.source==='member_storefront'&&(actor.role==='admin'||assigned.includes(b.studioId))).map(b=>({id:b.id,contractId:b.contractId,studioId:b.studioId,nestId:b.nestId,arrive:b.arrive,depart:b.depart,status:b.status,expiresAt:b.memberReservation?.expiresAt})):[]}};
    });
    else result=await withSaveState(s=>{
      core.initialise(s,SKUS,preview,time);core.expire(s,time);
      if(!preview&&s.dummy!==false)return {status:503,body:{error:'preview_data_cannot_go_live'}};
      const out=body=>({status:200,body});
      if(line==='send'){if(action!=='snapshot')throw new core.CommerceError('send_not_enabled',409);return out({line,actor,preview,enabled:false,reason:'payments_bank_integration_pending'});}
      if(line==='earn'){
        if(action==='publish')return out(earn.publishJob(s,actor,body,preview,time));
        if(action==='action')return out(earn.workAction(s,actor,body,time));
        if(action!=='snapshot')throw new core.CommerceError('unknown_operation');
        const e=earn.earnState(s), owned=new Set(e.jobs.filter(j=>actor.role==='admin'||j.owner===actor.id).map(j=>j.id));
        return out({line,actor,preview,owner:'Walk2Work',catalogue:earn.jobs(s,preview,time),jobs:e.jobs.map(j=>({...earn.publicJob(j),status:j.status,sourceId:j.sourceId,canManage:owned.has(j.id)})),applications:actor.role==='reader'?[]:e.applications.filter(a=>owned.has(a.job.id)).map(a=>({...earn.publicApplication(a),memberId:a.memberId,memberName:a.memberName}))});
      }
      const assigned=actor.role==='admin'?null:(s.commerce.config?.staffLocations?.[actor.id]||[]);
      const visible=s.orders.filter(o=>o.source==='commerce'&&(!assigned||assigned.includes(o.stopId)));
      if(action==='configure')return out(core.configure(s,SKUS,body,actor,time));
      if(action==='action'){
        if(!visible.some(o=>o.id===body.orderId)||actor.role==='reader')throw new core.CommerceError('order_not_found',404);
        if(['verify_payment','reconcile','record_refund'].includes(body.action)&&actor.role!=='admin')throw new core.CommerceError('admin_finance_access_required',403);
        return out(core.staffAction(s,actor,body,time));
      }
      if(action!=='snapshot')throw new core.CommerceError('unknown_operation');
      return out({line,actor,preview,owner:'Sikh Unit',catalogue:core.catalogue(s,SKUS,preview,time),orders:actor.role==='reader'?[]:visible.slice(-200).reverse().map(o=>({...core.publicOrder(o),memberId:o.memberId,memberName:o.member,locationId:o.stopId})),config:actor.role==='admin'?s.commerce.config:null,insurance:{enabled:false,reason:'insurer_integration_pending'}});
    });
    return send(result.status,result.body);
  }catch(e){return send(e instanceof core.CommerceError?e.status:503,{error:e instanceof core.CommerceError?e.message:'operations_unavailable'});}
}
