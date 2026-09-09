import {memberOwnerIds,ownsMemberRecord} from './member-ownership.mjs';
import { verifiedPoint } from '../../commerce-earn-map.js';
import { randomUUID } from 'node:crypto';
import { CommerceError, hash } from './core.mjs';

const fail = (message, status = 400) => { throw new CommerceError(message, status); };
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
export function earnState(s) { return s.commerce.earn ||= { jobs: [], applications: [], audit: [] }; }
export function publicJob(j) {
  return Object.fromEntries(['id','revision','employer','city','title','payMin','payMax','payPeriod','shift','requirements','terms','closesAt','preview','workplace','mandateStatus','openPositions'].map(k => [k,j[k]]));
}
export function jobs(s, preview, time, actor = null) {
  const demo=preview && earnState(s).demo;
  const map=demo && actor?.id===demo.memberId ? {status:'ready',demo:true,asOf:new Date(time).toISOString(),studio:demo.studio} : {status:'unavailable',reason:'central_member_map_not_connected'};
  return { preview, owner:'Walk2Work', map, jobs:earnState(s).jobs.filter(j => j.status === 'published' && Date.parse(j.closesAt) > time && (preview || !j.preview)).map(publicJob) };
}
export function publishJob(s, actor, body, preview, time) {
  if (!['admin','operator'].includes(actor.role)) fail('operator_access_required',403);
  const source=body.source;
  if (!source || !text(source.id,120) || !text(source.company,100) || !text(source.city,100) || !(source.demand > 0) || (!preview && source.preview !== false)) fail('verified_central_demand_required');
  if (!Number.isFinite(Date.parse(source.pulledAt)) || time-Date.parse(source.pulledAt)>3600000 || Date.parse(source.pulledAt)>time+60000) fail('central_source_stale',409);
  if (body.confirmed !== true || !text(body.title,100) || !text(body.shift,250) || !text(body.requirements,500) || !text(body.terms,1000)) fail('verified_job_terms_required');
  if (![body.payMin,body.payMax].every(v=>Number.isFinite(v)&&v>0&&v<=1000000) || body.payMax<body.payMin || !['day','month'].includes(body.payPeriod)) fail('verified_job_pay_required');
  if (!(Date.parse(body.closesAt)>time && Date.parse(body.closesAt)<=time+30*86400000)) fail('job_expiry_required');
  const e=earnState(s), id='job-'+hash(source.id).slice(0,24), existing=e.jobs.find(j=>j.id===id);
  if (existing && actor.role!=='admin' && existing.owner!==actor.id) fail('job_owner_required',403);
  const job={id,sourceId:source.id,sourceUpdatedAt:source.updatedAt,sourcePulledAt:source.pulledAt,owner:existing?.owner||actor.id,status:'published',employer:text(source.company,100),city:text(source.city,100),title:text(body.title,100),payMin:body.payMin,payMax:body.payMax,payPeriod:body.payPeriod,shift:text(body.shift,250),requirements:text(body.requirements,500),terms:text(body.terms,1000),closesAt:new Date(body.closesAt).toISOString(),preview:preview||source.preview===true,updatedAt:new Date(time).toISOString()};
  if(preview && source.preview===true && verifiedPoint(source.workplace) && source.mandateStatus==='open' && Number.isInteger(source.openPositions) && source.openPositions>0) {
    job.workplace={lat:source.workplace.lat,lng:source.workplace.lng,verified:true};job.mandateStatus='open';job.openPositions=source.openPositions;
  }
  job.revision=hash(JSON.stringify(job));
  if(existing)Object.assign(existing,job);else e.jobs.push(job);
  e.audit.push({action:'publish',jobId:id,actor:actor.id,at:job.updatedAt});
  return publicJob(job);
}
export function publicApplication(a) { return Object.fromEntries(['id','job','status','message','createdAt','updatedAt','preview'].map(k=>[k,a[k]])); }
export function ownApplications(s,actor) {
  if(actor?.role!=='member')fail(actor?'member_access_required':'sign_in_required',actor?403:401);
  return {applications:earnState(s).applications.filter(a=>ownsMemberRecord(actor,a.memberId)).map(publicApplication).reverse()};
}
export function applyForJob(s,actor,body,key,preview,time) {
  if(actor?.role!=='member')fail(actor?'member_access_required':'sign_in_required',actor?403:401);
  if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(key))fail('idempotency_key_required');
  const e=earnState(s), requestKey=hash(actor.id+':'+key), requestHash=hash(JSON.stringify(body));
  const requestKeys=memberOwnerIds(actor).map(id=>hash(id+':'+key));
  const retries=e.applications.filter(a=>ownsMemberRecord(actor,a.memberId)&&requestKeys.includes(a.requestKey));
  if(retries.length>1)fail('history_reconciliation_required',409);const retry=retries[0];
  if(retry){if(retry.requestHash!==requestHash)fail('idempotency_conflict',409);return publicApplication(retry);}
  if(body.consent!==true)fail('application_consent_required');
  const existing=e.applications.find(a=>ownsMemberRecord(actor,a.memberId) && a.job.id===body.jobId);
  if(existing)return publicApplication(existing);
  const job=jobs(s,preview,time).jobs.find(j=>j.id===body.jobId);
  if(!job)fail('job_not_available',409);
  if(job.revision!==body.revision)fail('job_details_changed',409);
  const a={id:'app-'+randomUUID(),memberId:actor.id,memberName:actor.name,job,status:'interested',message:'',createdAt:new Date(time).toISOString(),updatedAt:new Date(time).toISOString(),preview,requestKey,requestHash};
  e.applications.push(a); e.audit.push({action:'apply',applicationId:a.id,actor:actor.id,at:a.createdAt});return publicApplication(a);
}
export function workAction(s,actor,body,time) {
  const e=earnState(s), application=e.applications.find(a=>a.id===body.applicationId), job=e.jobs.find(j=>j.id===(application?.job.id||body.jobId));
  if(!job || !['admin','operator'].includes(actor.role) || (actor.role!=='admin'&&job.owner!==actor.id))fail('job_owner_required',403);
  if(body.action==='unpublish'){job.status='closed';e.audit.push({action:'unpublish',jobId:job.id,actor:actor.id,at:new Date(time).toISOString()});return {ok:true};}
  const next={interested:['contacted','closed'],contacted:['interview','closed'],interview:['selected','closed'],selected:['closed']};
  if(!application||body.expectedStatus!==application.status||!next[application.status]?.includes(body.action))fail('application_status_changed',409);
  if(!text(body.message,500))fail('member_update_required');
  application.status=body.action;application.message=text(body.message,500);application.updatedAt=new Date(time).toISOString();
  e.audit.push({action:body.action,applicationId:application.id,actor:actor.id,at:application.updatedAt});return publicApplication(application);
}

// Called only by the signed Central gateway, behind the local preview guard.
export function seedDemo(s,actor,body,preview,time) {
  if(!preview || actor.role!=='admin')fail('local_demo_only',403);
  if(body.memberId!=='preview-member' || !verifiedPoint(body.studio) || !Array.isArray(body.jobs) || body.jobs.length!==4 || !body.jobs.every(j=>j.source?.preview===true && j.source.id?.startsWith('DEMO-W2W-')))fail('invalid_demo_records');
  const e=earnState(s);
  // Loading twice must not reopen a closed job or invalidate an in-progress application.
  for(const input of body.jobs)if(!e.jobs.some(j=>j.sourceId===input.source.id))publishJob(s,actor,input,true,time);
  e.demo={memberId:body.memberId,studio:{id:text(body.studio.id,100),name:text(body.studio.name,100),lat:body.studio.lat,lng:body.studio.lng,verified:true},loadedAt:new Date(time).toISOString()};
  e.audit.push({action:'load_demo',actor:actor.id,at:new Date(time).toISOString()});
  return {ok:true,preview:true,jobs:e.jobs.length};
}
