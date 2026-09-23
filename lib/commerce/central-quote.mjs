import {CommerceError} from './core.mjs';
import {presentCentralSave} from './central-save.mjs';

const fail=(message='central_quote_unavailable',status=503)=>{throw new CommerceError(message,status);};

// Only map the member's chosen identifiers to Central's signed catalogue.
// Central decides price, stock, site service, collection window and expiry.
export async function quoteFromCentral(central,subject,body,now=Date.now()){
  if(!body||typeof body.locationId!=='string'||!['pickup','delivery'].includes(body.fulfillment)||
    !Array.isArray(body.lines)||!body.lines.length||body.lines.length>20)fail('invalid_bag',400);
  const locations=await central.centralMemberRequest('save.locations',subject);
  if(locations.status!==200)return locations;
  const site=locations.body?.locations?.find(row=>row.locationId===body.locationId);
  if(!site)return {status:409,body:{error:'member_location_unverified'}};
  const catalogue=await central.centralMemberRequest('save.catalogue',subject,{siteCode:site.siteCode});
  if(catalogue.status!==200)return catalogue;
  const view=presentCentralSave(locations.body,catalogue.body,now);
  const mapped=body.lines.map(line=>{
    if(!line||typeof line.id!=='string'||!Number.isInteger(line.qty)||line.qty<1)fail('invalid_bag',400);
    const product=view.products.find(row=>row.id===line.id);
    if(!product)fail('catalogue_unavailable',409);
    return {sku:product.sourceSku,qty:line.qty};
  });
  if(new Set(mapped.map(line=>line.sku)).size!==mapped.length)fail('duplicate_sku',400);
  const response=await central.centralMemberRequest('save.quote',subject,
    {siteCode:site.siteCode,mode:body.fulfillment,lines:mapped});
  if(response.status!==200)return response;
  const q=response.body?.quote;
  if(!q||q.siteCode!==site.siteCode||q.mode!==body.fulfillment||
    !Array.isArray(q.lines)||q.lines.length!==mapped.length||
    !Number.isSafeInteger(q.totalPaise)||q.totalPaise<1||
    !Number.isFinite(Date.parse(q.quotedAt))||!Number.isFinite(Date.parse(q.quoteExpiresAt))||
    !Number.isFinite(Date.parse(q.reservationExpiresAt)))fail();
  for(const expected of mapped){
    const line=q.lines.find(row=>row.sku===expected.sku);
    if(!line||line.qty!==expected.qty||!Number.isSafeInteger(line.pricePaise)||
      line.pricePaise<1||!Number.isInteger(line.revision)||line.revision<1)fail();
  }
  return {status:200,body:{
    location:view.locations[0],lines:q.lines.map(line=>({id:line.productId,name:line.name,
      pack:line.pack,qty:line.qty,nia:line.pricePaise/100,
      pricePaise:line.pricePaise,revision:line.revision})),
    amount:q.totalPaise/100,totalPaise:q.totalPaise,expiresAt:q.reservationExpiresAt,
    fingerprint:JSON.stringify(q),pilotOpen:false}};
}
