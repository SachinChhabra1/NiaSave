import { randomBytes } from 'node:crypto';
import { withSaveState, SKUS, DUMMY_DATA } from '../../rabbit/engine.mjs';
import { hasDurableStore } from '../runtime-store.mjs';
import * as core from './core.mjs';

export const previewMode = () => process.env.COMMERCE_PREVIEW === '1' && process.env.NODE_ENV !== 'production' && !process.env.VERCEL && !hasDurableStore();
const liveReady = () => process.env.COMMERCE_ENABLED === '1' && !DUMMY_DATA && hasDurableStore() && process.env.STAFF_AUTH_REQUIRED === '1' && (process.env.STAFF_TOKEN_SECRET||'').length >= 32 && Boolean(process.env.STAFF_PASSWORD) && /^https:\/\//.test(process.env.COMMERCE_IDENTITY_URL || '') && Boolean(process.env.COMMERCE_IDENTITY_KEY);
const cookieName = 'nia_commerce';
const cookieValue = req => String(req.headers.cookie||'').split(';').map(p => p.trim()).find(p => p.startsWith(cookieName+'='))?.slice(cookieName.length+1);
function sessionActor(s,req,time) {
  const key = core.hash(cookieValue(req)||''); const session = s.commerce.sessions[key];
  if (!session || session.expires <= time) return null;
  return s.commerce.accounts[session.accountId] || null;
}
async function identity(action,body) {
  const response = await fetch(process.env.COMMERCE_IDENTITY_URL.replace(/\/$/,'')+'/'+action, { method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+process.env.COMMERCE_IDENTITY_KEY},body:JSON.stringify(body),signal:AbortSignal.timeout(8000),redirect:'error' });
  if (!response.ok) throw new core.CommerceError('identity_verification_failed',401);
  return response.json();
}
async function read(req) {
  let length = 0; const chunks = [];
  for await (const chunk of req) { length += chunk.length; if(length > 16384) throw new core.CommerceError('request_too_large',413); chunks.push(chunk); }
  try { const body = JSON.parse(Buffer.concat(chunks).toString()||'{}'); if(!body || Array.isArray(body) || typeof body !== 'object') throw Error(); return body; } catch { throw new core.CommerceError('invalid_json'); }
}
export async function commerceHttp(req,res,path,getStaff) {
  const preview = previewMode();
  const send = (status,body,headers={}) => { res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}); res.end(JSON.stringify(body)); };
  if (!preview && !liveReady()) return send(503,{error:'commerce_not_configured',message:'Ordering is not open yet.'});
  if (!['GET','POST','PUT'].includes(req.method)) return send(405,{error:'method_not_allowed'});
  if (req.method !== 'GET' && (req.headers.origin !== `https://${req.headers.host}` && !(preview && ["http://127.0.0.1:5173", `http://${req.headers.host}`].includes(req.headers.origin)))) return send(403,{error:'same_origin_required'});
  let body;
  try { body = req.method === 'GET' ? {} : await read(req); } catch(e) { return send(e.status||400,{error:e.message}); }
  const time = Date.now();
  let providerResult;
  // Consume a rate-limit slot durably before calling a single-use external provider.
  // A CAS retry must never send a second SMS or verify the same code twice.
  if (!preview && req.method === 'POST' && ['/auth/request','/auth/verify'].includes(path)) {
    const allowed = await withSaveState(s => {
      core.initialise(s,SKUS,false,time);
      const ok = s.dummy === false && core.rateLimit(s,'identity-source:'+req.socket?.remoteAddress,time,100) && core.rateLimit(s,path+':'+String(body.phone||body.challenge),time,8);
      return {status:200,body:{ok}};
    });
    if (allowed.status >= 400) return send(allowed.status,allowed.body);
    if (!allowed.body.ok) return send(429,{error:'too_many_attempts'});
    if (path === '/auth/request' && !/^\+91[6-9]\d{9}$/.test(body.phone||'')) return send(400,{error:'invalid_phone'});
    if (path === '/auth/verify' && (typeof body.challenge !== 'string' || !/^\d{4,8}$/.test(body.code||''))) return send(400,{error:'invalid_code'});
    try { providerResult = await identity(path === '/auth/request'?'request':'verify',path === '/auth/request'?{phone:body.phone}:{challenge:body.challenge,code:body.code}); }
    catch { return send(401,{error:'identity_verification_failed'}); }
  }
  try {
    const result = await withSaveState(async s => {
      core.initialise(s,SKUS,preview,time);
      if (!preview && s.dummy !== false) return {status:200,body:{status:503,body:{error:'preview_data_cannot_go_live'}}};
      core.expire(s,time);
      const c=s.commerce; c.issues ||= []; const actor=sessionActor(s,req,time);
      const out = (body,status=200,headers={}) => ({status:200,body:{body,status,headers}});
      try {
        if(req.method === 'GET' && path === '/catalogue') return out({...core.catalogue(s,SKUS,preview,time),account:actor && {id:actor.id,name:actor.name,role:actor.role,locationIds:actor.locationIds}});
        if(req.method === 'POST' && ['/auth/preview','/recovery'].includes(path)) {
          if(!core.rateLimit(s,'source:'+req.socket?.remoteAddress,time,100) || !core.rateLimit(s,path+':'+String(body.phone||body.challenge||'preview'),time,8)) return out({error:'too_many_attempts'},429);
        }
        if(req.method === 'POST' && path === '/auth/request') {
          if(preview) return out({error:'use_preview_access'},409);
          if(!/^\+91[6-9]\d{9}$/.test(body.phone||'')) return out({error:'invalid_phone'},400);
          const result = providerResult;
          // Provider must return an opaque challenge, never expose roster membership here.
          if(typeof result.challenge !== 'string' || result.challenge.length > 300) return out({error:'identity_unavailable'},503);
          return out({challenge:result.challenge,message:'If this number has access, a code will arrive.'});
        }
        if(req.method === 'POST' && ['/auth/verify','/auth/preview'].includes(path)) {
          let account;
          if(path === '/auth/preview') {
            if(!preview) return out({error:'not_found'},404);
            const role = ['member','enterprise','investor'].includes(body.role) ? body.role : 'member';
            account={id:'preview-'+role,name:role==='member'?'Preview member':'Preview '+role,role,locationIds:['S01']};
          } else {
            if(preview || typeof body.challenge !== 'string' || !/^\d{4,8}$/.test(body.code||'')) return out({error:'invalid_code'},400);
            account = providerResult.account;
            if(!account || !/^[a-zA-Z0-9_-]{1,100}$/.test(account.id) || !['member','enterprise','investor'].includes(account.role) || !Array.isArray(account.locationIds)) return out({error:'access_not_granted'},403);
            account = {id:account.id,name:String(account.name||'Nia member').slice(0,80),role:account.role,locationIds:account.locationIds.filter(id => /^S\d{2}$/.test(id))};
          }
          c.accounts[account.id]=account;
          const token=randomBytes(32).toString('hex'); c.sessions[core.hash(token)]={accountId:account.id,expires:time+43200000};
          return out({account},200,{'set-cookie':`${cookieName}=${token}; Path=/api/commerce; HttpOnly; SameSite=Strict; Max-Age=43200${preview?'':'; Secure'}`});
        }
        if(req.method === 'POST' && path === '/auth/logout') {
          delete c.sessions[core.hash(cookieValue(req)||'')];
          return out({ok:true},200,{'set-cookie':`${cookieName}=; Path=/api/commerce; HttpOnly; SameSite=Strict; Max-Age=0${preview?'':'; Secure'}`});
        }
        if(req.method === 'POST' && path === '/recovery') {
          if(!/^\+91[6-9]\d{9}$/.test(body.newPhone||'') || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.memberId||'')) return out({error:'member_id_and_new_phone_required'},400);
          const ticket={id:'help-'+randomBytes(6).toString('hex'),memberId:body.memberId,newPhone:body.newPhone,status:'open',createdAt:new Date(time).toISOString()};
          c.tickets.push(ticket);
          return out({id:ticket.id,message:'Bring this reference and your member ID to the Nia team. Your account has not changed.'},201);
        }
        if(path.startsWith('/staff/')) {
          const staff = preview ? {id:'preview-operator',role:'admin',staff:true} : getStaff(req);
          if(!staff || (!preview && !staff.desks?.some(d => ['studio','hub','money','pilot'].includes(d)))) return out({error:'staff_access_required'},403);
          staff.staff=true;
          const assigned = preview || staff.role==='admin' ? null : (Object.hasOwn(c.config?.staffLocations||{},staff.id)?c.config.staffLocations[staff.id]:[]);
          const visibleOrders=s.orders.filter(o=>o.source==='commerce' && (!assigned || assigned.includes(o.stopId)));
          const visibleIds=new Set(visibleOrders.map(o=>o.id));
          if(req.method === 'GET' && path === '/staff/state') return out({preview,orders:visibleOrders.slice(-200).reverse(),tickets:staff.role==='admin'?c.tickets.filter(t => t.status==='open'):[],config:staff.role==='admin'?c.config:null,issues:c.issues.filter(v=>v.status!=='resolved' && visibleIds.has(v.orderId)),audit:c.audit.filter(v=>staff.role==='admin'||visibleIds.has(v.orderId)).slice(-100).reverse()});
          if(req.method === 'POST' && path === '/staff/action') {
            if(!visibleIds.has(body.orderId)) return out({error:'order_not_found'},404);
            if(['reconcile','record_refund'].includes(body.action) && !preview && staff.role!=='admin' && !staff.desks?.includes('money')) return out({error:'money_access_required'},403);
            if(['verify_payment'].includes(body.action) && !preview && staff.role!=='admin' && !staff.desks?.includes('money') && !staff.desks?.includes('studio')) return out({error:'money_access_required'},403);
            return out(core.staffAction(s,staff,body,time));
          }
          if(req.method === 'POST' && path === '/staff/support') {
            const issue=c.issues.find(v=>v.id===body.id);
            if(!issue || !visibleIds.has(issue.orderId) || !['assigned','resolved'].includes(body.status) || !String(body.note||'').trim()) return out({error:'issue_and_resolution_note_required'},400);
            Object.assign(issue,{status:body.status,owner:staff.id,note:String(body.note).slice(0,500),updatedAt:new Date(time).toISOString()});
            c.audit.push({action:'support_'+body.status,ticketId:issue.id,actor:staff.id,at:new Date(time).toISOString()});return out({ok:true});
          }
          if(req.method === 'PUT' && path === '/staff/config') return out(core.configure(s,SKUS,body,staff,time));
          if(req.method === 'POST' && path === '/staff/recovery') {
            if(staff.role!=='admin') return out({error:'admin_access_required'},403);
            const ticket=c.tickets.find(t => t.id===body.ticketId && t.status==='open');
            if(!ticket || !String(body.evidenceReference||'').trim() || body.providerUpdated!==true) return out({error:'verified_identity_provider_update_required'},400);
            // Phone ownership is changed in the trusted identity provider, not from an unverified request.
            for(const [key,value] of Object.entries(c.sessions)) if(value.accountId===ticket.memberId) delete c.sessions[key];
            Object.assign(ticket,{status:'resolved',resolvedBy:staff.id,resolvedAt:new Date(time).toISOString(),evidenceReference:String(body.evidenceReference).slice(0,250)});
            c.audit.push({action:'phone_recovery',ticketId:ticket.id,actor:staff.id,at:new Date(time).toISOString()});
            return out({ok:true});
          }
          return out({error:'not_found'},404);
        }
        if(!actor) return out({error:'sign_in_required'},401);
        if(req.method === 'GET' && path === '/support') return out({issues:c.issues.filter(v=>v.memberId===actor.id)});
        if(req.method === 'POST' && path === '/support') {
          if(actor.role!=='member') return out({error:'member_access_required'},403);
          const order=s.orders.find(o=>o.id===body.orderId && o.memberId===actor.id && o.source==='commerce');
          if(!order || !['missing_item','quality','late','return_refund','other'].includes(body.kind)) return out({error:'order_and_issue_required'},400);
          if(!core.rateLimit(s,'support:'+actor.id,time,6)) return out({error:'too_many_attempts'},429);
          const issue={id:'issue-'+randomBytes(6).toString('hex'),memberId:actor.id,orderId:order.id,kind:body.kind,note:String(body.note||'').slice(0,500),status:'open',createdAt:new Date(time).toISOString()};
          c.issues.push(issue);return out({id:issue.id,status:issue.status},201);
        }
        if(req.method === 'GET' && path === '/orders') return out({orders:core.listOrders(s,actor)});
        if(req.method === 'POST' && path === '/quote') return out(core.quote(s,actor,body,SKUS,preview,time));
        if(req.method === 'POST' && path === '/orders') return out(core.reserve(s,actor,body,req.headers['idempotency-key'],SKUS,preview,time),201);
        if(req.method === 'POST' && path === '/cancel') return out(core.cancel(s,actor,body.orderId,time));
        return out({error:'not_found'},404);
      } catch(error) {
        if(error instanceof core.CommerceError) return out({error:error.message},error.status);
        throw error;
      }
    });
    if(result.status >= 400) return send(result.status,result.body);
    return send(result.body.status,result.body.body,result.body.headers);
  } catch { return send(503,{error:'service_unavailable',message:'Please try again. No order is confirmed without a reference.'}); }
}
