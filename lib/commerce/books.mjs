import { CommerceError } from './core.mjs';
const fail=(message,status=400)=>{throw new CommerceError(message,status);};
export const booksState=s=>s.commerce.books||={projections:{},consents:{},audit:[]};
const currentMonth=time=>new Date(time).toISOString().slice(0,7);
const previousMonths=time=>Array.from({length:3},(_,i)=>{const d=new Date(time);return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-3+i,1)).toISOString().slice(0,7);});
const member=actor=>{if(actor?.role!=='member')fail(actor?'member_access_required':'sign_in_required',actor?403:401);};
// A rebuildable Central projection, not a payment book. No member-created financial entries.
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
  member(actor);const b=booksState(s),p=b.projections[actor.id],consent=b.consents[actor.id]?.enabled===true;
  if(!p||!preview||!p.preview)return {status:'unavailable',reason:'central_books_not_connected',months:[],score:{status:'unavailable',value:null,reason:'history_incomplete'},consent};
  const months=p.months.filter(m=>m.month<currentMonth(time)).map(monthlyStatement);
  return {status:time-Date.parse(p.asOf)>86400000?'stale':'ready',preview:true,asOf:p.asOf,months,consent,score:healthScore(months,p.asOf,time,consent)};
}
export function booksOverview(s,actor){const b=booksState(s);return {enabled:false,reason:'production_sources_pending',demoMembers:actor.role==='admin'?Object.keys(b.projections).length:0,asOf:actor.role==='admin'?Object.values(b.projections).map(p=>p.asOf).sort().at(-1)||null:null};}
