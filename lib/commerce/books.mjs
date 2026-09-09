import {memberOwnerIds,ownsMemberRecord} from './member-ownership.mjs';
import { randomUUID } from 'node:crypto';
import { CommerceError } from './core.mjs';
const fail=(message,status=400)=>{throw new CommerceError(message,status);};
export const booksState=s=>s.commerce.books||={projections:{},consents:{},audit:[]};
const currentMonth=time=>new Date(time).toISOString().slice(0,7);
const previousMonths=time=>Array.from({length:3},(_,i)=>{const d=new Date(time);return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-3+i,1)).toISOString().slice(0,7);});
const member=actor=>{if(actor?.role!=='member')fail(actor?'member_access_required':'sign_in_required',actor?403:401);};
// Rebuildable Central projection plus separately labelled member budget notes; no duplicate payment book.
// Production ingestion stays closed until the source adapters and consent gate are integrated.
export function loadBooksDemo(s,actor,body,preview,time){
  if(!preview||actor.role!=='admin')fail('local_demo_only',403);
  if(body.memberId!=='preview-member'||!Array.isArray(body.months)||body.months.length!==3)fail('invalid_books_projection');
  const expected=previousMonths(time),refs=new Set();
  const months=body.months.map((m,i)=>{
    if(m.month!==expected[i]||m.complete!==true||!Array.isArray(m.entries)||m.entries.length>100)fail('invalid_books_projection');
    const entries=m.entries.map(e=>{
      if(!['earning','expense','home','refund'].includes(e.kind)||!Number.isSafeInteger(e.amountPaise)||e.amountPaise<=0||e.amountPaise>100000000||!/^DEMO-BOOKS-[a-zA-Z0-9-]+$/.test(e.reference)||refs.has(e.reference)||!['settled','pending','failed'].includes(e.status)||typeof e.label!=='string'||e.label.length>100||typeof e.source!=='string'||e.source.length>100||typeof e.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date||!e.date.startsWith(m.month)||e.verified!==true)fail('invalid_books_entry');
      refs.add(e.reference);return Object.fromEntries(['reference','date','label','source','kind','amountPaise','status','verified'].map(k=>[k,e[k]]));
    });return {month:m.month,complete:true,entries};
  });
  const b=booksState(s),projection={memberId:body.memberId,preview:true,asOf:new Date(time).toISOString(),months};
  b.projections[body.memberId]=projection;b.audit.push({action:'load_demo_projection',actor:actor.id,at:projection.asOf});
  return {ok:true,months:months.length};
}
export function booksConsent(s,actor,body,time){member(actor);if(typeof body.enabled!=='boolean')fail('invalid_consent');const b=booksState(s);b.consents[actor.id]={enabled:body.enabled,version:'nia-health-experimental-v1',at:new Date(time).toISOString()};b.audit.push({action:body.enabled?'health_opt_in':'health_opt_out',memberId:actor.id,at:new Date(time).toISOString()});return {ok:true};}
export function monthlyStatement(m){
  const sum=kind=>m.entries.filter(e=>e.kind===kind&&e.status==='settled').reduce((n,e)=>n+e.amountPaise,0);
  const earned=sum('earning'),spent=sum('expense'),home=sum('home'),refunds=sum('refund');
  return {...m,totals:{earned,spent,home,refunds,left:earned-spent-home+refunds},pending:m.entries.filter(e=>e.status==='pending').length};
}
export function healthScore(months,asOf,time,consent){
  const unavailable=reason=>({status:'unavailable',reason,value:null,version:'nia-health-experimental-v1'});
  if(!consent)return unavailable('consent_required');
  if(!Number.isFinite(Date.parse(asOf))||time-Date.parse(asOf)>86400000||Date.parse(asOf)>time+60000)return unavailable('source_stale');
  const window=previousMonths(time).map(month=>months.find(m=>m.month===month));
  if(window.some(m=>!m?.complete||m.totals.earned<=0||m.entries.some(e=>e.status!=='settled'||!e.verified)))return unavailable('history_incomplete');
  const incomes=window.map(m=>m.totals.earned),income=incomes.reduce((a,b)=>a+b,0),left=window.reduce((n,m)=>n+m.totals.left,0);
  const retainedRatio=Math.max(0,Math.min(1,left/income));
  const stability=Math.min(...incomes)/Math.max(...incomes);
  const retainedPoints=Math.round(60*Math.min(1,retainedRatio/.2)),stabilityPoints=Math.round(40*stability);
  return {status:'ready',value:retainedPoints+stabilityPoints,version:'nia-health-experimental-v1',months:window.map(m=>m.month),retainedRatio,retainedPoints,stabilityPoints};
}
export function ownBooks(s,actor,preview,time){
  member(actor);const b=booksState(s),projections=memberOwnerIds(actor).map(id=>b.projections[id]).filter(Boolean),p=projections.length===1?projections[0]:null,consent=b.consents[actor.id]?.enabled===true;
  const active=preview&&p?.preview?p:null;
  const months=(active?.months||[]).filter(m=>m.month<currentMonth(time)).map(monthlyStatement);
  const personal=memberOwnerIds(actor).flatMap(id=>b.personal?.[id]||[]).filter(e=>!e.deleted);
  if(new Set(personal.map(e=>e.reference)).size!==personal.length)fail('history_reconciliation_required',409);
  const base={status:active?(time-Date.parse(active.asOf)>86400000?'stale':'ready'):'partial',preview,asOf:active?.asOf||null,months,consent};
  const result=mergeBooks(base,[...saveEntries(s,actor,preview),...personal],time);
  if(projections.length>1){result.historyReviewRequired=true;result.score={status:'unavailable',reason:'history_incomplete',value:null};}
  return result;
}
export function booksOverview(s,actor){const b=booksState(s);return {enabled:false,reason:'production_sources_pending',demoMembers:actor.role==='admin'?Object.keys(b.projections).length:0,asOf:actor.role==='admin'?Object.values(b.projections).map(p=>p.asOf).sort().at(-1)||null:null};}

export function saveEntries(s,actor,preview){
  if(!preview&&s.dummy!==false)return [];
  return (s.orders||[]).filter(o=>o.source==='commerce'&&ownsMemberRecord(actor,o.memberId)).flatMap(o=>[
    o.payment?.verifiedAt&&{reference:'save-payment-'+o.id,date:o.payment.verifiedAt.slice(0,10),label:'NiaSave purchase',source:'Sikh · confirmed payment',kind:'expense',amountPaise:Math.round(o.payment.amount*100),status:'settled',verified:true,origin:'save',editable:false},
    o.refund?.verifiedAt&&{reference:'save-refund-'+o.id,date:o.refund.verifiedAt.slice(0,10),label:'NiaSave refund',source:'Sikh · confirmed refund',kind:'refund',amountPaise:Math.round(o.refund.amount*100),status:'settled',verified:true,origin:'save',editable:false}
  ].filter(Boolean));
}
export function livingEntries(s,actor,preview){
  if(!preview&&s.dummy!==false)return [];
  // A member storefront contract is an exact identity bridge; names/phone matches are not sufficient.
  const contracts=new Set((s.bookings||[]).filter(b=>b.source==='member_storefront'&&ownsMemberRecord(actor,b.memberId)).map(b=>b.contractId));
  return (s.collectionPayments||[]).filter(p=>contracts.has(p.contractId)&&p.amount>0&&p.at&&p.reference&&['membership','rent'].includes((s.receivables||[]).find(r=>r.id===p.receivableId)?.kind)).map(p=>({reference:'live-payment-'+p.id,date:p.at.slice(0,10),label:'Nest payment',source:'Jat · recorded receipt',kind:'expense',amountPaise:Math.round(p.amount*100),status:'settled',verified:false,origin:'live',editable:false}));
}
export function mergeBooks(data,entries,time){
  const months=new Map(data.months.map(m=>[m.month,{...m,entries:[...m.entries]}]));
  const today=currentMonth(time);if(!months.has(today))months.set(today,{month:today,complete:false,entries:[]});
  const seen=new Set([...months.values()].flatMap(m=>m.entries.map(e=>e.reference)));
  for(const e of entries){if(seen.has(e.reference))continue;seen.add(e.reference);const key=e.date.slice(0,7);if(!months.has(key))months.set(key,{month:key,complete:false,entries:[]});const m=months.get(key);m.complete=false;m.entries.push(e);}
  const result=[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(monthlyStatement);
  return {...data,months:result,score:healthScore(result,data.asOf,time,data.consent)};
}
export function writePersonalEntry(s,actor,body,key,time){
  member(actor);const b=booksState(s);b.personal||={};b.requests||={};const list=b.personal[actor.id]||=[];
  if(typeof key!=='string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(key))fail('idempotency_key_required');
  const requestId=actor.id+':'+key,signature=JSON.stringify(body),priors=memberOwnerIds(actor).map(id=>b.requests[id+':'+key]).filter(Boolean);if(priors.some(p=>p.signature!==signature))fail('idempotency_conflict',409);const prior=priors[0];if(prior){if(prior.signature!==signature)fail('idempotency_conflict',409);return prior.result;}
  const matches=body.id?memberOwnerIds(actor).flatMap(id=>(b.personal[id]||[]).filter(e=>e.reference===body.id)):[];
  if(matches.length>1)fail('history_reconciliation_required',409);const existing=matches[0]||null;
  if(body.id&&!existing)fail('entry_not_found',404);
  if(existing&&body.revision!==existing.revision)fail('entry_changed',409);
  if(body.remove===true){if(!existing)fail('entry_not_found',404);existing.deleted=true;existing.revision++;}
  else{
    if(!['earning','expense','home'].includes(body.kind)||!/^\d{4}-\d{2}-\d{2}$/.test(body.date||'')||!Number.isFinite(Date.parse(body.date))||new Date(body.date).toISOString().slice(0,10)!==body.date||body.date>new Date(time+19800000).toISOString().slice(0,10)||body.date<'2020-01-01'||!Number.isSafeInteger(body.amountPaise)||body.amountPaise<=0||body.amountPaise>100000000||typeof body.label!=='string'||!body.label.trim()||body.label.length>100)fail('valid_date_amount_and_description_required');
    if(!existing&&list.length>=2000)fail('entry_limit_reached',409);
    const entry={reference:existing?.reference||'personal-'+randomUUID(),date:body.date,kind:body.kind,amountPaise:body.amountPaise,label:body.label.trim(),source:'Added by you',status:'settled',verified:false,origin:'personal',editable:true,revision:(existing?.revision||0)+1,updatedAt:new Date(time).toISOString(),deleted:false};
    if(existing)Object.assign(existing,entry);else list.push(entry);
  }
  const result={ok:true};b.requests[requestId]={signature,result};b.audit.push({action:body.remove?'personal_remove':existing?'personal_edit':'personal_add',memberId:actor.id,at:new Date(time).toISOString()});return result;
}
