// Catalogue locations already carry the server's fresh Save authorization.
// Residence grants remain required for legacy catalogues and other lines.
export function saveLocations(cat,account,fulfillment='pickup',cart={}) {
  const products=(cat?.products||[]).filter(p=>cart[p.id]);
  return (cat?.locations||[]).filter(location=>(cat?.owner==='niasave'||account?.locationIds?.includes(location.id))&&
    location.modes?.includes(fulfillment)&&products.every(p=>cat?.owner==='niasave'?Array.isArray(p.locationIds)&&p.locationIds.includes(location.id):!Array.isArray(p.locationIds)||p.locationIds.includes(location.id)));
}
export function reorderProduct(cat,order,line){
  const atSite=p=>!Array.isArray(p.locationIds)||p.locationIds.includes(order.location?.id);
  return (cat?.products||[]).find(p=>p.id===line.id&&atSite(p))||
    (cat?.owner==='niasave'?(cat.products||[]).find(p=>atSite(p)&&(line.sku?p.sourceSku===line.sku:p.sourceProductId===line.id)):undefined);
}
export function compatibleSaveBag(cat,cart){
  if(cat?.owner!=='niasave')return cart;
  const next={};
  for(const [id,quantity] of Object.entries(cart||{})){
    const exact=cat.products?.find(p=>p.id===id);
    const matches=exact?[exact]:(cat.products||[]).filter(p=>p.sourceProductId===id);
    // Ambiguous legacy IDs require reselecting a site-specific product.
    if(matches.length===1)next[matches[0].id]=quantity;
  }
  return next;
}
