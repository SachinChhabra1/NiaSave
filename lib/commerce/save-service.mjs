import {CommerceError} from './core.mjs';
import {createHmac} from 'node:crypto';
import {saveLaunchEnabled} from '../../commerce-capabilities.js';
import {saveRepository,saveSmokeRepository} from './save-repository.mjs';
import {verifiedSmokeContext} from './save-smoke-context.mjs';
import {canAccessSaveStaff} from '../save-staff-access.mjs';
import {saveContext,saveStaffActor,catalogueFromBook,quoteFromBook,reserveFromBook,memberOrders,
  retrySaveRequest,cancelFromBook,previewInventory,publishInventory,completeFromBook,staffSaveSnapshot} from './save-book.mjs';

const fail=(code,status=400)=>{throw new CommerceError(code,status);};
export const SAVE_STAFF_ACTIONS=new Set(['snapshot','orders','inventory-preview','inventory-publish','complete']);
export async function memberSaveService({central,actor,path,method,body={},key,repository=saveRepository,smokeRepository=saveSmokeRepository,env=process.env}){
  if(!actor)fail('sign_in_required',401);
  if(actor.role!=='member')fail('member_access_required',403);
  const subject=actor.authSubject||actor.id;
  // Central determines current identity eligibility and allowed fulfilment sites.
  // Inventory, prices, holds and orders never come from Central or a Sheet.
  const verified=await central.centralMemberRequest('save.locations',subject);
  if(verified.status!==200)return verified;
  const context=saveContext(subject,verified.body);
  const smoke=verifiedSmokeContext(verified.body.testContext,context.locations,subject);
  if(smoke){
    if(actor.kind!=='customer')fail('test_scope_unverified',403);
    repository=smokeRepository;
    context.expiresAt=Math.min(context.expiresAt,Date.parse(smoke.expiresAt));
  }
  const label=value=>smoke?{...value,test:true,testContext:smoke.id}:value;
  const quoteKey=smoke&&typeof env.CENTRAL_COMMERCE_KEY==='string'&&env.CENTRAL_COMMERCE_KEY.length>=32
    ?createHmac('sha256',env.CENTRAL_COMMERCE_KEY).update('niasave-save-production-smoke-v1').digest('hex'):env.CENTRAL_COMMERCE_KEY;
  if(method==='GET'){
    if(path==='/catalogue')return {status:200,body:await repository.read(book=>({...catalogueFromBook(book,context),...(smoke?{test:true,testContext:smoke.id}:{})}))};
    if(path==='/orders/retry-status')return {status:200,body:label(await repository.read(book=>retrySaveRequest(book,context,key)))};
    if(path==='/orders'||path.startsWith('/orders/')){
      const result=await repository.read(book=>memberOrders(book,context));
      if(path==='/orders')return {status:200,body:label({...result,orders:result.orders.map(label)})};
      const order=result.orders.find(o=>o.id===path.slice('/orders/'.length));
      if(!order)fail('order_not_found',404);
      return {status:200,body:label(order)};
    }
  }
  if(!saveLaunchEnabled(env))fail('pilot_commitments_paused',503);
  if(method==='POST'&&path==='/quote')return {status:200,body:label(await repository.read(book=>quoteFromBook(book,context,body,quoteKey)))};
  if(method==='POST'&&path==='/orders'){
    const result=await repository.write(book=>reserveFromBook(book,context,body,key,quoteKey));
    return {...result,...(result.status===200?{status:201}:{}),body:label(result.body)};
  }
  if(method==='POST'&&path==='/cancel'){const result=await repository.write(book=>cancelFromBook(book,context,body,key));return {...result,body:label(result.body)};}
  fail('unknown_operation',404);
}

export async function staffSaveService({actor,action,body={},repository=saveRepository,smokeRepository=saveSmokeRepository,smoke=null,env=process.env}){
  if(!SAVE_STAFF_ACTIONS.has(action))fail('unknown_operation',404);
  if(smoke){
    verifiedSmokeContext(smoke,actor.sites);
    if(actor.role!=='admin')fail('test_scope_unverified',403);
    if(action==='complete')fail('test_payment_disabled',403);
    if(body.rows?.some(row=>!String(row.name||'').startsWith('TEST ')))fail('test_label_required');
    actor={...actor,scopeExpiresAt:Math.min(actor.scopeExpiresAt,Date.parse(smoke.expiresAt))};
    repository=smokeRepository;
  }
  if(['snapshot','orders'].includes(action)){
    if(action==='orders'&&!['admin','operator'].includes(actor.role)&&!actor.canWriteSave)fail('staff_access_required',403);
    return {status:200,body:await repository.read((book,version)=>({...staffSaveSnapshot(book,actor),version,sourceReady:version>0,
      ...(smoke?{test:true,testContext:smoke.id}:{}),capabilities:{publish:Boolean(actor.role==='admin'||actor.canWriteSave)&&saveLaunchEnabled(env),
        complete:!smoke&&Boolean(actor.role==='admin'||actor.canWriteSave)&&saveLaunchEnabled(env),saveReservations:saveLaunchEnabled(env)}}))};
  }
  if(!saveLaunchEnabled(env))fail('pilot_commitments_paused',503);
  if(action==='inventory-preview')return {status:200,body:await repository.read(book=>previewInventory(book,actor,body.rows))};
  if(action==='inventory-publish'){
    // Validate against current data before the only permitted empty-book creation.
    await repository.read((book,version)=>{
      // Existing books must reach the durable replay lookup before checking
      // the now-advanced revision. Preflight only the first book creation.
      if(version===0)publishInventory(book,actor,body);
    });
    return repository.write(book=>publishInventory(book,actor,body),{create:true});
  }
  return repository.write(book=>completeFromBook(book,actor,body));
}

export async function nativeSaveStaff({central,staff,action,body,repository,env}){
  if(!staff)fail('staff_required',401);
  if(!canAccessSaveStaff(staff,env)||typeof staff.email!=='string')fail('save_staff_access_required',403);
  const reply=await central.centralMemberRequest('save.staffScope','staff:'+staff.email.toLowerCase());
  if(reply.status!==200)return reply;
  if(!['admin','operator'].includes(reply.body?.role))fail('save_staff_access_required',403);
  const actor={...saveStaffActor({...staff,role:reply.body.role},reply.body),canWriteSave:true};
  return staffSaveService({actor,action,body,repository,env});
}
