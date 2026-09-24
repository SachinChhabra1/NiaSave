import {CommerceError} from './core.mjs';

const fail=()=>{throw new CommerceError('central_orders_unavailable',503);};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Format Central's saved order; every commitment and expiry decision remains in Central.
export function presentCentralOrder(row){
  if(!row||!uuid.test(row.orderId)||!Number.isInteger(row.revision)||row.revision<1||
    !Number.isSafeInteger(row.totalPaise)||row.totalPaise<1||
    !['reserved','cancelled','expired','completed'].includes(row.effectiveStatus)||
    !Array.isArray(row.lines)||!row.lines.length||
    typeof row.pickupCode!=='string'||!row.pickupCode||
    typeof row.siteCode!=='string'||!row.siteCode||
    !row.location||typeof row.location!=='object'||
    typeof row.location.name!=='string'||typeof row.location.address!=='string'||
    !Number.isFinite(Date.parse(row.location.windowStart))||
    !Number.isFinite(Date.parse(row.location.windowEnd))||
    !Number.isFinite(Date.parse(row.expiresAt)))fail();
  const lines=row.lines.map(line=>{
    if(!line||typeof line.sku!=='string'||!line.sku||
      typeof line.productId!=='string'||!line.productId||
      typeof line.name!=='string'||!line.name||typeof line.pack!=='string'||
      !Number.isInteger(line.revision)||line.revision<1||
      !Number.isInteger(line.qty)||line.qty<1||
      !Number.isSafeInteger(line.pricePaise)||line.pricePaise<1||
      !Number.isSafeInteger(line.subtotalPaise)||
      line.subtotalPaise!==line.pricePaise*line.qty)fail();
    return {id:line.productId,name:line.name,pack:line.pack,qty:line.qty,
      nia:line.pricePaise/100,sourceSku:line.sku,sourceSiteCode:row.siteCode,
      pricePaise:line.pricePaise,revision:line.revision};
  });
  if(lines.reduce((sum,line)=>sum+line.pricePaise*line.qty,0)!==row.totalPaise)fail();
  return {id:row.orderId,pickupCode:row.pickupCode,location:row.location,
    lines,amount:row.totalPaise/100,totalPaise:row.totalPaise,
    status:row.effectiveStatus,revision:row.revision,
    createdAt:row.reservedAt,updatedAt:row.updatedAt,expiresAt:row.expiresAt};
}

export async function readCentralOrders(central,subject){
  const orders=[];const seenOrders=new Set();const seenCursors=new Set();let cursor=null;
  for(let page=0;page<20;page++){
    const request=cursor?{...cursor}:{};
    const response=await central.centralMemberRequest('save.orders',subject,request);
    if(response.status!==200)return response;
    const body=response.body;
    if(!body||!Array.isArray(body.orders)||!Number.isFinite(Date.parse(body.asOf)))fail();
    for(const row of body.orders){
      const order=presentCentralOrder(row);
      if(seenOrders.has(order.id))fail();
      seenOrders.add(order.id);orders.push(order);
    }
    if(!body.nextCursor)return {status:200,body:{orders,paymentsEnabled:false}};
    const next=body.nextCursor;
    if(!uuid.test(next.beforeId)||!Number.isFinite(Date.parse(next.beforeAt)))fail();
    const key=`${next.beforeAt}:${next.beforeId}`;
    if(seenCursors.has(key))fail();
    seenCursors.add(key);cursor=next;
  }
  fail();
}
