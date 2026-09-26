import {CommerceError} from './core.mjs';
import {saveLaunchEnabled} from '../../commerce-capabilities.js';
import {saveRepository} from './save-repository.mjs';
import {canAccessSaveStaff} from '../save-staff-access.mjs';
import {saveContext,saveStaffActor,catalogueFromBook,quoteFromBook,reserveFromBook,memberOrders,
  retrySaveRequest,cancelFromBook,previewInventory,publishInventory,completeFromBook,staffSaveSnapshot} from './save-book.mjs';

const fail=(code,status=400)=>{throw new CommerceError(code,status);};
export const SAVE_STAFF_ACTIONS=new Set(['snapshot','orders','inventory-preview','inventory-publish','complete']);
export async function memberSaveService({central,actor,path,method,body={},key,repository=saveRepository,env=process.env}){
  if(!actor)fail('sign_in_required',401);
  if(actor.role!=='member')fail('member_access_required',403);
  const subject=actor.authSubject||actor.id;
  // Central determines current identity eligibility and allowed fulfilment sites.
  // Inventory, prices, holds and orders never come from Central or a Sheet.
  const verified=await central.centralMemberRequest('save.locations',subject);
  if(verified.status!==200)return verified;
  const context=saveContext(subject,verified.body);
  if(method==='GET'){
    if(path==='/catalogue')return {status:200,body:await repository.read(book=>catalogueFromBook(book,context))};
    if(path==='/orders/retry-status')return {status:200,body:await repository.read(book=>retrySaveRequest(book,context,key))};
    if(path==='/orders'||path.startsWith('/orders/')){
      const result=await repository.read(book=>memberOrders(book,context));
      if(path==='/orders')return {status:200,body:result};
      const order=result.orders.find(o=>o.id===path.slice('/orders/'.length));
      if(!order)fail('order_not_found',404);
      return {status:200,body:order};
    }
  }
  if(!saveLaunchEnabled(env))fail('pilot_commitments_paused',503);
  if(method==='POST'&&path==='/quote')return {status:200,body:await repository.read(book=>quoteFromBook(book,context,body,env.CENTRAL_COMMERCE_KEY))};
  if(method==='POST'&&path==='/orders'){
    const result=await repository.write(book=>reserveFromBook(book,context,body,key,env.CENTRAL_COMMERCE_KEY));
    return result.status===200?{...result,status:201}:result;
  }
  if(method==='POST'&&path==='/cancel')return repository.write(book=>cancelFromBook(book,context,body,key));
  fail('unknown_operation',404);
}

export async function staffSaveService({actor,action,body={},repository=saveRepository,env=process.env}){
  if(!SAVE_STAFF_ACTIONS.has(action))fail('unknown_operation',404);
  if(['snapshot','orders'].includes(action)){
    if(action==='orders'&&!['admin','operator'].includes(actor.role)&&!actor.canWriteSave)fail('staff_access_required',403);
    return {status:200,body:await repository.read((book,version)=>({...staffSaveSnapshot(book,actor),version,sourceReady:version>0,
      capabilities:{publish:Boolean(actor.role==='admin'||actor.canWriteSave)&&saveLaunchEnabled(env),
        complete:Boolean(actor.role==='admin'||actor.canWriteSave)&&saveLaunchEnabled(env),saveReservations:saveLaunchEnabled(env)}}))};
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
