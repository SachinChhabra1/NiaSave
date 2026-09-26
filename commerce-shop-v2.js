// Shop presents only the member-scoped catalogue received from its declared source.
// Do not infer categories, unit prices, or cheapest flags from pack text or sticker price.
export const SHOP_CATEGORY_IDS=Object.freeze(['rice','atta','oil','pulses','soap','tea']);
export function voiceLanguage(lang){return ({en:'en-IN',hi:'hi-IN',ta:'ta-IN',bn:'bn-IN'})[lang]||'en-IN';}
export function shopName(product,lang){const translated=product?.translations?.[lang]?.name;return typeof translated==='string'&&translated.trim()?translated.trim():String(product?.name||'');}
export function shopCategory(product){const category=product?.shopCategoryId??product?.category;return SHOP_CATEGORY_IDS.includes(category)?category:'other';}
export function shopSearch(products,query,lang){
  const term=String(query||'').trim().toLocaleLowerCase(lang).slice(0,40);
  if(!term)return products;
  return products.filter(p=>[shopName(p,lang),p.name,p.brand,p.pack].some(x=>typeof x==='string'&&x.toLocaleLowerCase(lang).includes(term)));
}
export function memberProducts(catalogue){
  const products=Array.isArray(catalogue?.products)?catalogue.products:[];
  return catalogue?.preview===true?products:products.filter(p=>p?.test!==true&&p?.preview!==true);
}
export function shopSourceCopy(owner){
  return owner==='niasave'?{
    heading:'Browse essentials from NiaSave',loading:'Loading NiaSave catalogue',ready:'Catalogue from NiaSave',
    missing:'Catalogue details not available',empty:'No essentials are available to reserve for your location right now.',
    photo:'Photo not available',unit:'Unit price not recorded',
    categories:'These products have no category assigned.',
    ranking:'Unit prices and lowest-price labels are not recorded. Products are shown without ranking.',
    review:'Final price and availability are checked by NiaSave at review.',
  }:{
    heading:'Browse Essentials from Central',loading:'Loading Central catalogue',ready:'Catalogue from Central',
    missing:'Catalogue details missing from Central',empty:'No products published yet',
    photo:'Photo not supplied by Central',unit:'Unit price not supplied by Central',
    categories:'Central has not assigned these products to the six Shop categories.',
    ranking:'Unit prices and lowest-price labels await Central. Products are shown without ranking.',
    review:'Final price and availability are checked by Central at review.',
  };
}
// Wording only: the existing server capability and stock guards still control actions.
export function shopReservationNotice({catalogue,signedIn,reservationsEnabled}){
  if(catalogue?.owner!=='niasave')return undefined;
  if(!signedIn)return 'Sign in to see essentials for your location and reserve.';
  if(!Array.isArray(catalogue.products))return 'Catalogue unavailable. Refresh to check reservations.';
  if(shopViewState({catalogue})==='stale')return 'Refresh the catalogue to check current availability.';
  const products=memberProducts(catalogue);
  if(!products.some(p=>Number.isSafeInteger(p.available)&&p.available>0)){
    if(products.some(p=>!Number.isSafeInteger(p.available)||p.available<0))return 'Refresh the catalogue to check current availability.';
    return 'No essentials are available to reserve for your location right now.';
  }
  return reservationsEnabled?null:'Reservations are unavailable right now. You can browse essentials or ask Nia for help.';
}
export function shopViewState({catalogue,online=true,loading=false,readFailed=false,now=Date.now()}){
  if(!online)return 'offline';
  if(loading)return 'loading';
  if(readFailed)return 'unavailable';
  if(!Array.isArray(catalogue?.products))return 'source_missing';
  const asOf=Date.parse(catalogue.asOf||'');
  if(Number.isFinite(asOf)&&(asOf>now+60000||now-asOf>300000))return 'stale';
  return memberProducts(catalogue).length?'ready':'empty';
}
export function shopUnit(product){
  const price=product?.unitPricePaise,unit=product?.unit;
  if(!Number.isSafeInteger(price)||price<=0||!['kg','litre'].includes(unit))return null;
  return {price:price/100,unit,lowest:product.lowestUnitPriceInCategory===true};
}
export function shopPhoto(product,{esc,name,t,sourceOwner}){
  const src=product?.photoUrl;
  if(typeof src==='string'&&/^https:\/\//i.test(src))return `<img src="${esc(src)}" alt="${esc(name)}" loading="lazy" width="320" height="320">`;
  return `<span class="shop-photo-missing">${esc(t(shopSourceCopy(sourceOwner).photo))}</span>`;
}
export function shopPrice(product,{t,esc,money,sourceOwner}){
  const sticker=Number.isFinite(product?.price)&&product.price>0?`<span>${esc(t('Sticker price'))}: <strong>${esc(money(product.price))}</strong></span>`:`<span>${esc(t('Sticker price unavailable'))}</span>`;
  const unit=shopUnit(product);
  return `<span class="shop-price-pair">${sticker}<span>${unit?`${esc(money(unit.price))} / ${esc(t(unit.unit==='kg'?'kg':'litre'))}`:esc(t(shopSourceCopy(sourceOwner).unit))}</span>${unit?.lowest?`<span class="shop-lowest">${esc(t('Lowest price'))}</span>`:''}</span>`;
}
const labels={rice:'Rice',atta:'Atta',oil:'Oil',pulses:'Pulses',soap:'Soap',tea:'Tea'};
export function shopCatalogueMarkup({catalogue,query='',aisle='',lang='en',state='ready',signedIn=false},{t,esc,money,bag}){
  const products=memberProducts(catalogue);
  const matching=shopSearch(products,query,lang);
  const category=SHOP_CATEGORY_IDS.includes(aisle)?aisle:'';
  const visible=category?matching.filter(p=>shopCategory(p)===category):matching;
  const sourceOwner=catalogue?.owner,copy=shopSourceCopy(sourceOwner);
  const moneyContext={t,esc,money,sourceOwner};
  const noRows=sourceOwner==='niasave'?(signedIn?'No available products':'Sign in to view availability'):'No published products';
  const stateText={loading:t(copy.loading),ready:t(copy.ready),stale:t('Catalogue needs refreshing'),source_missing:t(copy.missing),unavailable:t('Catalogue temporarily unavailable'),empty:t(sourceOwner==='niasave'&&!signedIn?'Sign in to see essentials for your location and reserve.':copy.empty),offline:t('Offline. Reconnect for current prices')};
  const item=p=>`<article class="shop-item"><div class="shop-item-photo">${shopPhoto(p,{esc,t,name:shopName(p,lang),sourceOwner})}</div><div class="shop-item-detail"><h3>${esc(shopName(p,lang))}</h3>${p.brand?`<p>${esc(p.brand)}</p>`:''}${p.pack?`<p>${esc(p.pack)}</p>`:''}${shopPrice(p,moneyContext)}<button type="button" data-action="open-buy" data-id="${esc(p.id)}">${esc(t('View item'))}</button></div></article>`;
  const tile=id=>{const rows=products.filter(p=>shopCategory(p)===id);const first=rows.find(p=>p.photoUrl);
    const lowest=rows.find(p=>shopUnit(p)?.lowest);
    return `<button type="button" class="shop-category" data-action="open-aisle" data-id="${id}"><span class="shop-category-photo">${first?shopPhoto(first,{esc,t,name:shopName(first,lang),sourceOwner}):`<span class="shop-photo-missing">${esc(t(copy.photo))}</span>`}</span><strong>${esc(t(labels[id]))}</strong><small>${lowest?`${esc(t('From'))} ${esc(money(shopUnit(lowest).price))} / ${esc(t(shopUnit(lowest).unit==='kg'?'kg':'litre'))}`:esc(rows.length?t(copy.unit):t(noRows))}</small></button>`;};
  const other=products.filter(p=>shopCategory(p)==='other');
  const content=query.trim()?`<section aria-label="${esc(t('Search results'))}"><h2>${esc(t('Search results'))}</h2><div class="shop-item-grid">${visible.map(item).join('')||`<p>${esc(t('No matching products'))}</p>`}</div></section>`:
    category?`<section aria-label="${esc(t(labels[category]))}"><button type="button" data-action="close-aisle">${esc(t('All categories'))}</button><h2>${esc(t(labels[category]))}</h2><div class="shop-item-grid">${visible.map(item).join('')||`<p>${esc(t(noRows))}</p>`}</div></section>`:
    `<section aria-label="${esc(t('Categories'))}"><h2>${esc(t('Categories'))}</h2><div class="shop-category-grid">${SHOP_CATEGORY_IDS.map(tile).join('')}</div></section>${other.length?`<section aria-label="${esc(t('Other essentials'))}"><h2>${esc(t('Other essentials'))}</h2><p>${esc(t(copy.categories))}</p><div class="shop-item-grid">${other.map(item).join('')}</div></section>`:''}`;
  return `<section class="shop-v2"><header><h1>${esc(t('Shop'))}</h1><p>${esc(t(copy.heading))}</p></header><form id="save-search-form" class="shop-search" role="search"><label for="shop-query">${esc(t('Search the catalogue'))}</label><div><input id="shop-query" type="search" name="q" value="${esc(query)}" maxlength="40" placeholder="${esc(t('Search rice, oil, soap'))}"><button type="button" data-action="voice-search" aria-label="${esc(t('Search by voice'))}" title="${esc(t('Search by voice'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg><span class="icon-word">${esc(t('Search by voice'))}</span></button><button type="submit">${esc(t('Search'))}</button></div></form><p class="shop-read-state" data-state="${esc(state)}" role="status">${esc(stateText[state]||stateText.unavailable)}</p><p class="shop-rank-note">${esc(t(copy.ranking))}</p><div class="shop-layout"><div class="shop-catalogue">${content}</div><aside class="shop-bag-inline" aria-label="${esc(t('Bag'))}">${bag}</aside></div></section>`;
}
