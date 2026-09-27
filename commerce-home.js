import {mapModel} from './commerce-earn-map.js';
import {NIA_HELP_PHONE,callNiaMarkup} from './commerce-support.js';

const CATEGORY_WORD={rice:'Rice',atta:'Atta',oil:'Oil',pulses:'Pulses',soap:'Soap',tea:'Tea'};

// The server marks one row. The first marked row is shown. Prices are not compared.
function shopPriceFact(catalogue){
  if(catalogue?.status!=='ready'||!catalogue.data||typeof catalogue.data!=='object')return null;
  const data=catalogue.data;
  if(typeof data.lowestUnitPriceLine==='string'&&data.lowestUnitPriceLine.trim())return {line:data.lowestUnitPriceLine.trim()};
  const products=Array.isArray(data.products)?data.products:[];
  const rows=data.preview===true?products:products.filter(product=>product&&product.test!==true&&product.preview!==true);
  for(const product of rows){
    if(typeof product.lowestUnitPriceLine==='string'&&product.lowestUnitPriceLine.trim())return {line:product.lowestUnitPriceLine.trim()};
  }
  const flagged=rows.find(product=>product.lowestUnitPriceInCategory===true);
  if(!flagged)return null;
  const category=CATEGORY_WORD[flagged.shopCategoryId||flagged.category];
  const paise=flagged.unitPricePaise;
  const unit=flagged.unit;
  if(!category||!Number.isSafeInteger(paise)||paise<=0||(unit!=='kg'&&unit!=='litre'))return null;
  return {category,paise,unit};
}

function rupees(paise){
  const value=paise/100;
  return Number.isInteger(value)?String(value):value.toFixed(2);
}

function priceChip(fact,t,esc){
  if(!fact)return '';
  const line=fact.line?fact.line:`${t(fact.category)}: ₹${rupees(fact.paise)} ${fact.unit==='kg'?t('a kilo'):t('a litre')}`;
  return `<span class="home-tile-price">${esc(line)}</span>`;
}

// A read-only presentation of responses already scoped by Central.
export function homeDashboardModel({stay,earn,fee,send,catalogue,online=true}){
  const status = source => !online?'offline':source?.status||'loading';
  const state = source => {
    const s=status(source);
    if(s!=='ready')return s;
    return source.data==null?'source_missing':'ready';
  };
  const stayState=state(stay);
  const bookings=stayState==='ready'&&Array.isArray(stay.data.bookings)?stay.data.bookings:null;
  const active=bookings?.find(b=>['reserved','in'].includes(b.status));
  const stayView=stayState==='ready'?(bookings===null?'source_missing':active?'ready':'empty'):stayState;
  const earnState=state(earn);
  const projection=earnState==='ready'?mapModel(earn.data):null;
  const jobs=projection?.status==='ready'?projection.jobs.filter(j=>j.preview!==true):[];
  const jobView=earnState!=='ready'?earnState:!projection?'source_missing':projection.status==='stale'?'stale':projection.status==='studio_missing'?'source_missing':projection.status!=='ready'?'unavailable':jobs.length?'ready':'empty';
  const shopView=state(catalogue)==='ready'?(Array.isArray(catalogue.data.products)?catalogue.data.products.length?'ready':'empty':'source_missing'):state(catalogue);
  const sendView=state(send)==='ready'?(Array.isArray(send.data.months)?'ready':'source_missing'):state(send);
  // The current membership response has no fee contract. Never infer a membership fee from a stay quote or payment.
  const feeView=state(fee)==='ready'?'source_missing':state(fee);
  return {stay:{state:stayView,booking:stayView==='ready'?active:null},job:{state:jobView,job:jobView==='ready'?jobs[0]:null},fee:{state:feeView},tiles:{live:stayView,earn:jobView,shop:shopView,send:sendView},shopPrice:shopPriceFact(catalogue)};
}

export function homeDashboardMarkup(model,{t,esc,icon}){
  const needs=[];
  const stay=model.stay;
  if(stay?.state==='ready'&&stay.booking){
    const booked=stay.booking.status==='in'?t('Checked in'):t('Your stay is booked.');
    needs.push(`<article class="home-attention-card" data-state="ready"><div class="home-card-heading"><span aria-hidden="true">${icon('live')}</span><h3>${esc(t('Your stay'))}</h3></div><div role="status"><p><strong>${esc(stay.booking.name||t('Your stay'))}</strong></p><p>${esc(booked)}</p></div><button type="button" data-action="live">${esc(t('View your stay'))}</button></article>`);
  }
  const job=model.job;
  if(job?.state==='ready'&&job.job){
    needs.push(`<article class="home-attention-card" data-state="ready"><div class="home-card-heading"><span aria-hidden="true">${icon('earn')}</span><h3>${esc(t('Nearby job'))}</h3></div><div role="status"><p><strong>${esc(t(job.job.title))}</strong></p><p>${esc(job.job.employer)}</p></div><button type="button" data-action="earn">${esc(t('See jobs'))}</button></article>`);
  }
  const attention=needs.length?`<section aria-labelledby="home-attention-title"><h2 id="home-attention-title">${esc(t('Needs attention'))}</h2><div class="home-attention-grid">${needs.join('')}</div></section>`:'';
  const phone=model.callPhone!=null?model.callPhone:NIA_HELP_PHONE;
  const tiles=[['live',t('Live'),t('A safe place to stay near work'),'/assets/studio-bunk-lockers.jpg',''],['earn',t('Earn'),t('Jobs near where you stay'),'/assets/earn.jpg',''],['shop',t('Shop'),t('Rice, atta, oil at low prices'),'/assets/home-rice.jpg',priceChip(model.shopPrice,t,esc)],['send',t('Send'),t('Save money to send home'),'/assets/send-purpose-family.jpg','']];
  const talk=callNiaMarkup({t,esc,icon,phone,label:t('Call'),className:'home-call'});
  return `<section class="home-dashboard" aria-label="${esc(t('Home dashboard'))}"><header class="home-title"><h1>${esc(t('What do you need today?'))}</h1></header>${attention}<div class="home-tiles">${tiles.map(([action,name,line,src,extra])=>`<button type="button" class="home-tile home-tile-${action}" data-action="${action}"><img src="${esc(src)}" alt="" width="640" height="360"><span class="home-tile-copy"><span class="home-tile-name">${icon(action)}<strong>${esc(name)}</strong></span><span class="home-tile-line">${esc(line)}</span>${extra}</span></button>`).join('')}</div><section class="home-talk"><span class="home-talk-mark" aria-hidden="true">${icon('phone')}</span><span class="home-talk-copy"><strong>${esc(t('Talk to us'))}</strong><span>${esc(t('The Nia team will help you.'))}</span></span>${talk}</section></section>`;
}
