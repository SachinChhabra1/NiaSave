import {CommerceError} from './core.mjs';
import {presentCentralOrder} from './central-orders.mjs';

const fail=(code='invalid_reservation_request',status=400)=>{throw new CommerceError(code,status);};
const keyPattern=/^[a-zA-Z0-9_-]{16,100}$/;

function requestFromQuote(body,key){
  if(!keyPattern.test(key||'')||typeof body?.fingerprint!=='string'||
    !Array.isArray(body.lines)||!body.lines.length)fail();
  let quote;
  try{quote=JSON.parse(body.fingerprint);}catch{fail();}
  if(!quote||typeof quote.siteCode!=='string'||!['pickup','delivery'].includes(quote.mode)||
    !Array.isArray(quote.lines)||quote.lines.length!==body.lines.length||
    !Number.isFinite(Date.parse(quote.quotedAt))||
    !Number.isFinite(Date.parse(quote.quoteExpiresAt)))fail();
  const selected=new Map();
  for(const line of body.lines){
    if(!line||typeof line.id!=='string'||!Number.isInteger(line.qty)||line.qty<1||
      selected.has(line.id))fail();
    selected.set(line.id,line.qty);
  }
  const lines=quote.lines.map(line=>{
    if(!line||selected.get(line.productId)!==line.qty||
      typeof line.sku!=='string'||!line.sku||
      !Number.isInteger(line.revision)||line.revision<1||
      !Number.isSafeInteger(line.pricePaise)||line.pricePaise<1)fail();
    return {sku:line.sku,qty:line.qty,expectedRevision:line.revision,pricePaise:line.pricePaise};
  });
  if(body.fulfillment!==quote.mode||
    new Set(lines.map(line=>line.sku)).size!==lines.length)fail();
  return {kind:'save.reserve',siteCode:quote.siteCode,mode:quote.mode,lines,
    quotedAt:quote.quotedAt,quoteExpiresAt:quote.quoteExpiresAt,idempotencyKey:key};
}

function receipt(status,body){
  if(!body?.order)return {status,body};
  const order=body.order;
  return {status,body:presentCentralOrder({...order,effectiveStatus:order.status,
    updatedAt:order.updatedAt??order.reservedAt})};
}

/** Exact retries return the committed Central receipt after a lost response. */
export async function reserveFromCentral(central,subject,body,idempotencyKey){
  const request=requestFromQuote(body,idempotencyKey);
  try{
    const result=await central.centralMemberRequest('save.reserve',subject,request);
    return receipt(result.status,result.body);
  }catch{
    try{
      const replay=await central.centralMemberRequest('save.retryStatus',subject,
        {idempotencyKey});
      if(replay.status===200&&replay.body?.kind==='save.reserve'&&
        replay.body?.committed===true)return receipt(replay.body.resultStatus,replay.body.result);
    }catch{}
    fail('service_unavailable',503);
  }
}

export async function retryReserveStatus(central,subject,idempotencyKey){
  if(!keyPattern.test(idempotencyKey||''))fail();
  const result=await central.centralMemberRequest('save.retryStatus',subject,{idempotencyKey});
  if(result.status!==200)return result;
  if(result.body?.kind!=='save.reserve'||result.body?.committed!==true)fail('retry_status_unavailable',503);
  return receipt(result.body.resultStatus,result.body.result);
}
