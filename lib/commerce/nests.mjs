import { CommerceError, hash } from './core.mjs';

const fail = (code, status = 400) => { throw new CommerceError(code, status); };
const day = time => new Date(time + 19800000).toISOString().slice(0, 10);
const plus = (date, days) => new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
const round = n => Math.round(n * 100) / 100;
const financialActivity = (s,b) => s.collectionPayments.some(p=>p.contractId===b.contractId) || s.receivables?.some(r=>r.contractId===b.contractId&&r.status!=='void') || (b.folio||[]).length>0;
const active = b => !['cancelled', 'out'].includes(b.status);
const overlaps = (b, start, end) => active(b) && b.arrive < end && start < b.depart;

export function expireNests(s, time) {
  for (const b of s.bookings) {
    if (b.source !== 'member_storefront' || b.status !== 'reserved' || Date.parse(b.memberReservation.expiresAt) > time) continue;
    // A desk may already have collected money. Those reservations need staff review.
    if (financialActivity(s,b)) continue;
    b.status = 'cancelled'; b.cancelledAt = new Date(time).toISOString(); b.memberReservation.expired = true;
    const contract = s.contracts.find(c => c.id === b.contractId);
    if (contract) contract.status = 'cancelled';
    s.auditLog.unshift({ at: b.cancelledAt, actor: 'reservation_expiry', action: 'member_nest_expired', ref: b.id });
  }
}

function offers(s, preview, time) {
  if (preview) return s.studios.filter(st => st.capacity > 0).filter((st, i, all) => all.findIndex(v => v.siteId === st.siteId) === i).slice(0, 3).map(st => ({
    studioId: st.id, name: st.name, address: st.city + ' · example location',
    nestIds: Array.from({ length: Math.min(st.capacity, 6) }, (_, i) => 'N' + (i + 1)),
    rent: 2200, deposit: 0, taxPct: 12, holdHours: 24,
    terms: 'Example 30-day stay. No online payment. Meet the Nia team before the hold expires to review the agreement and pay by UPI at move-in. Renewal and deposit terms must be confirmed before launch.',
    details: 'A Nest in a shared Nia studio. Photo is illustrative; facilities and exact address need confirmation.',
    validUntil: new Date(time + 86400000).toISOString()
  }));
  if (s.dummy !== false || s.memberCatalogue?.verified !== true) return [];
  return (s.memberCatalogue.offers || []).filter(o => Date.parse(o.validUntil) > time && s.studios.some(st => st.id === o.studioId));
}

export function configureNests(s, body, staff, time) {
  if (staff?.role !== 'admin') fail('admin_access_required', 403);
  if (s.dummy !== false) fail('preview_data_cannot_go_live', 409);
  if (body.verified !== true || !Array.isArray(body.offers) || body.offers.length > 100) fail('verified_nest_catalogue_required');
  const ids = new Set();
  const clean = body.offers.map(o => {
    const studio = s.studios.find(st => st.id === o.studioId);
    if (!studio || ids.has(o.studioId)) fail('invalid_studio'); ids.add(o.studioId);
    if (!Array.isArray(o.nestIds) || !o.nestIds.length || o.nestIds.length > studio.capacity || new Set(o.nestIds).size !== o.nestIds.length || o.nestIds.some(n => typeof n !== 'string' || !/^[A-Z0-9_-]{1,40}$/.test(n))) fail('verified_nest_ids_required');
    if (![o.rent,o.deposit,o.taxPct,o.holdHours].every(Number.isFinite) || o.rent <= 0 || o.deposit < 0 || o.taxPct < 0 || o.taxPct > 100 || o.holdHours < 1 || o.holdHours > 168) fail('invalid_nest_prices_or_hold');
    if (!['name','address','terms','details'].every(k => typeof o[k] === 'string' && o[k].trim() && o[k].length <= 1000) || !(Date.parse(o.validUntil) > time)) fail('verified_nest_details_required');
    return { studioId:studio.id, nestIds:o.nestIds, name:o.name, address:o.address, rent:round(o.rent), deposit:round(o.deposit), taxPct:o.taxPct, holdHours:o.holdHours, terms:o.terms, details:o.details, validUntil:new Date(o.validUntil).toISOString() };
  });
  s.memberCatalogue = { verified:true, offers:clean, verifiedBy:staff.id, verifiedAt:new Date(time).toISOString() };
  s.auditLog.unshift({at:new Date(time).toISOString(),actor:staff.id,action:'member_nest_catalogue_published'});
  return {ok:true,offers:clean.length};
}

function dates(start, time) {
  const min = day(time);
  if (typeof start !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(Date.parse(start)) || new Date(start).toISOString().slice(0,10) !== start || start < min || start > plus(min,30)) fail('invalid_move_in_date');
  return { start, end:plus(start,30) };
}
function freeNests(s, o, start, end) {
  const studio = s.studios.find(st => st.id === o.studioId);
  const bookings = s.bookings.filter(b => b.studioId === o.studioId && overlaps(b,start,end));
  // Check the whole stay, including future arrivals and unnamed historical occupants.
  const boundaries = [start, ...bookings.map(b => b.arrive).filter(d => d >= start && d < end)];
  if (boundaries.some(d => bookings.filter(b => b.arrive <= d && d < b.depart).length >= studio.capacity)) return [];
  return o.nestIds.filter(n => !bookings.some(b => b.nestId === n));
}
function publicOffer(s, o, start, end) {
  const {nestIds,holdHours,validUntil,...details} = o;
  const tax = round(o.rent * o.taxPct / 100);
  return {...details, start, end, periodDays:30, tax, total:round(o.rent + tax + o.deposit), available:freeNests(s,o,start,end).length, holdHours};
}
export function nestCatalogue(s, preview, time, start = day(time)) {
  expireNests(s,time); const d = dates(start,time);
  return {preview, start:d.start, end:d.end, minDate:day(time), maxDate:plus(day(time),30), offers:offers(s,preview,time).map(o => publicOffer(s,o,d.start,d.end))};
}
export function nestQuote(s, actor, body, preview, time) {
  if (actor?.role !== 'member') fail(actor ? 'member_access_required':'sign_in_required', actor?403:401);
  expireNests(s,time); const d = dates(body.start,time);
  const offer = offers(s,preview,time).find(o => o.studioId === body.studioId);
  if (!offer) fail('nest_not_available',409);
  const q = publicOffer(s,offer,d.start,d.end);
  if (!q.available) fail('nest_not_available',409);
  const {available,...fixed} = q;
  return {...q,fingerprint:hash(JSON.stringify(fixed))};
}
function publicBooking(s,b) {
  const r = b.memberReservation;
  const contract = s.contracts.find(c => c.id === b.contractId);
  const payments = s.collectionPayments.filter(p => p.contractId === b.contractId);
  const paid = round(payments.reduce((n,p) => n + Number(p.amount||0),0));
  return {id:b.id,nestId:b.nestId,studioId:b.studioId,name:r.quote.name,address:r.quote.address,start:b.arrive,end:b.depart,status:r.expired?'expired':b.status,expiresAt:r.expiresAt,quote:r.quote,contractStatus:contract?.signedStatus||'pending',paidAmount:paid,paymentReferences:payments.map(p=>p.reference),canCancel:b.status==='reserved'&&!financialActivity(s,b)};
}
export function ownNests(s, actor, time) {
  if(actor?.role !== 'member') fail(actor?'member_access_required':'sign_in_required',actor?403:401);
  expireNests(s,time);
  return {bookings:s.bookings.filter(b=>b.source==='member_storefront'&&b.memberId===actor.id).map(b=>publicBooking(s,b))};
}
export function reserveNest(s, actor, body, key, preview, time, createContract) {
  if(actor?.role !== 'member') fail(actor?'member_access_required':'sign_in_required',actor?403:401);
  if(typeof key !== 'string'||!/^[a-zA-Z0-9_-]{16,100}$/.test(key)) fail('idempotency_key_required');
  const requestHash=hash(JSON.stringify({studioId:body.studioId,start:body.start,fingerprint:body.fingerprint}));
  const existing=s.bookings.find(b=>b.source==='member_storefront'&&b.memberId===actor.id&&b.memberReservation.key===key);
  if(existing){if(existing.memberReservation.requestHash!==requestHash)fail('idempotency_conflict',409);expireNests(s,time);return publicBooking(s,existing);}
  const q=nestQuote(s,actor,body,preview,time);
  if(q.fingerprint!==body.fingerprint) fail('price_or_details_changed',409);
  if(s.bookings.some(b=>b.memberId===actor.id&&overlaps(b,q.start,q.end)))fail('existing_nest_stay',409);
  const offer=offers(s,preview,time).find(o=>o.studioId===q.studioId);
  const nestId=freeNests(s,offer,q.start,q.end)[0];
  // Link to the same authenticated membership ID; never infer identity from a phone/name.
  if(!s.members.some(m=>m.id===actor.id))s.members.push({id:actor.id,name:actor.name,phone:'',verificationStatus:'needs_review',source:'authenticated_membership',createdAt:new Date(time).toISOString()});
  const result=createContract({memberId:actor.id,studioId:q.studioId,nestId,startDate:q.start,endDate:q.end,monthlyRent:q.rent,deposit:q.deposit,signedStatus:'pending',firstCharge:false,actor:actor.id});
  if(!result.ok)fail(result.error,409);
  const b=result.booking;
  b.source='member_storefront';b.taxPct=q.taxPct;
  result.contract.source='member_storefront';
  b.memberReservation={key,requestHash,quote:q,expiresAt:new Date(Math.min(time+offer.holdHours*3600000,Date.parse(q.start+'T23:59:59+05:30'))).toISOString()};
  return publicBooking(s,b);
}
export function cancelNest(s, actor, body, time, cancelBooking) {
  if(actor?.role!=='member')fail(actor?'member_access_required':'sign_in_required',actor?403:401);
  expireNests(s,time);
  const b=s.bookings.find(b=>b.id===body.bookingId&&b.memberId===actor.id&&b.source==='member_storefront');
  if(!b)fail('booking_not_found',404);
  if(b.status==='cancelled')return publicBooking(s,b);
  if(!publicBooking(s,b).canCancel)fail('contact_team_to_cancel',409);
  const result=cancelBooking({bookingId:b.id,actor:actor.id,reason:'Member cancelled before move-in'});
  if(!result.ok)fail(result.error,409);
  return publicBooking(s,b);
}
