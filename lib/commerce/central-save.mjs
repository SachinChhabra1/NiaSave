import { CommerceError } from './core.mjs';

const fail=()=>{throw new CommerceError('central_save_stale',503);};
function fresh(body,now){
  const asOf=Date.parse(body?.asOf||'');
  const seconds=body?.freshnessSeconds;
  if(!Number.isFinite(asOf)||asOf>now+1000||!Number.isInteger(seconds)||seconds<1||seconds>300||now-asOf>seconds*1000)fail();
}

// NiaSave only formats Central's revision-stamped read for its existing member view.
// It never substitutes a local price, count, delivery area or collection window.
export function presentCentralSave(locationsReply,catalogueReply,now=Date.now()){
  fresh(locationsReply,now);
  if(locationsReply.pilotOpen!==false)fail();
  const locations=locationsReply.locations;
  if(!Array.isArray(locations)||locations.length>1)fail();
  if(!locations.length)return {preview:false,ready:false,pilotOpen:false,locations:[],products:[],
    payment:'upi_at_handover',onlinePayment:false,whatsapp:false,asOf:locationsReply.asOf};
  fresh(catalogueReply,now);
  if(catalogueReply.pilotOpen!==false)fail();
  const site=locations[0];
  if(!site||typeof site.siteCode!=='string'||!site.siteCode||typeof site.locationId!=='string'||
     !site.locationId||catalogueReply.siteCode!==site.siteCode||!Array.isArray(catalogueReply.items))fail();
  if(catalogueReply.site?.siteCode!==site.siteCode||
     catalogueReply.site.serviceRevision!==site.serviceRevision)fail();
  const loc={id:site.locationId,sourceSiteCode:site.siteCode,name:site.name,address:site.address,
    modes:site.modes,windowStart:site.windowStartAt,windowEnd:site.windowEndAt,
    windowOpen:site.windowOpen,serviceRevision:site.serviceRevision,reserveMinutes:site.reserveMinutes};
  const products=catalogueReply.items.map(p=>{
    if(p.siteCode!==site.siteCode||typeof p.productId!=='string'||typeof p.sku!=='string'||
       !Number.isSafeInteger(p.pricePaise)||p.pricePaise<1||!Number.isInteger(p.available)||
       p.available<0||!Number.isInteger(p.revision)||p.revision<1)fail();
    return {id:p.productId,sourceSku:p.sku,sourceSiteCode:p.siteCode,name:p.name,pack:p.pack,
      pricePaise:p.pricePaise,price:p.pricePaise/100,available:p.available,revision:p.revision,
      modes:p.modes,category:p.category??null};
  });
  return {preview:false,ready:products.length>0,pilotOpen:false,payment:'upi_at_handover',
    onlinePayment:false,whatsapp:false,asOf:catalogueReply.asOf,
    reserveMinutes:site.reserveMinutes,locations:[loc],products};
}
