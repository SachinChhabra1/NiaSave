import {withSaveState, SKUS, DUMMY_DATA} from '../../rabbit/engine.mjs';
import {withLivingState} from '../../bison/engine.mjs';
import {catalogue, CommerceError} from './core.mjs';
import {nestCatalogue} from './nests.mjs';
import {centralMemberRequest} from './central-client.mjs';

// Staff authentication never creates or resolves a member identity. These are
// public offer projections only; no orders, statements or personal distances.
export async function ownerViewHttp(req,res,path,getStaff,dependencies={}) {
  const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
  try {
    const staff=await getStaff(req);
    if(!staff)return send(401,{error:'staff_auth_required'});
    if(staff.role!=='admin')return send(403,{error:'owner_access_required'});
    if(req.method!=='GET')return send(405,{error:'owner_view_read_only'});
    if(!['/catalogue','/nests','/earn'].includes(path))return send(404,{error:'not_found'});
    if(DUMMY_DATA)return send(503,{error:'production_catalogue_required'});
    const time=Date.now();
    if(path==='/earn') {
      const result=await (dependencies.centralRequest||centralMemberRequest)('owner.earn','staff:'+staff.id,{role:'admin'});
      return send(result.status,result.body);
    }
    if(path==='/catalogue') {
      const result=await (dependencies.saveState||withSaveState)(s=>{
        if(s.dummy!==false)throw new CommerceError('preview_data_cannot_go_live',503);
        return {status:200,body:{...catalogue(structuredClone(s),SKUS,false,time),account:null,memberAuth:'passkey',ownerView:true,owner:{name:staff.name},capabilities:{readOnly:true}}};
      });
      return send(result.status,result.body);
    }
    const start=new URL(req.url,'http://localhost').searchParams.get('start')||undefined;
    const result=await (dependencies.livingState||withLivingState)(s=>({status:200,body:nestCatalogue(structuredClone(s),false,time,start)}));
    return send(result.status,result.body);
  }catch(error){return send(error instanceof CommerceError?error.status:503,{error:error instanceof CommerceError?error.message:'owner_catalogue_unavailable'});}
}
