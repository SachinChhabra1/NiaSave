import {mapModel} from './commerce-earn-map.js';

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
  return {stay:{state:stayView,booking:stayView==='ready'?active:null},job:{state:jobView,job:jobView==='ready'?jobs[0]:null},fee:{state:feeView},tiles:{live:stayView,earn:jobView,shop:shopView,send:sendView}};
}

export function homeDashboardMarkup(model,{t,esc,icon,online}){
  const stateCopy={
    loading:t('Checking Central updates'),
    ready:t('Current information'),
    stale:t('Information needs refreshing'),
    source_missing:t('Central details missing'),
    unavailable:t('Temporarily unavailable'),
    empty:t('Nothing to show yet'),
    offline:t('Offline. Reconnect to check')
  };
  const copy=(state)=>esc(stateCopy[state]||stateCopy.unavailable);
  const card=(name,action,state,body)=>`<article class="home-attention-card" data-state="${esc(state)}"><div class="home-card-heading"><span aria-hidden="true">${icon(action)}</span><h3>${esc(name)}</h3></div><div role="status">${body||`<p>${copy(state)}</p>`}</div><button type="button" data-action="${action}">${esc(t('View details'))}</button></article>`;
  const stay=model.stay, job=model.job;
  const stayText=stay.state==='ready'?`<p><strong>${esc(stay.booking.name||t('Your Nest'))}</strong></p><p>${esc(stay.booking.status==='in'?t('Checked in'):t('Reservation recorded by Central'))}</p>`:stay.state==='empty'?'<p>'+esc(t('No current stay or reservation recorded'))+'</p>':'<p>'+copy(stay.state)+'</p>';
  const feeText='<p>'+copy(model.fee.state)+'</p>'+(model.fee.state==='source_missing'?'<p>'+esc(t('Membership fee details are not available from Central'))+'</p>':'');
  const jobText=job.state==='ready'?`<p><strong>${esc(t(job.job.title))}</strong></p><p>${esc(job.job.employer)}</p><p>${esc(t('Open role near your verified Nest'))}</p>`:job.state==='empty'?'<p>'+esc(t('No verified nearby open jobs right now'))+'</p>':'<p>'+copy(job.state)+'</p>';
  const tiles=[['live',t('Live'),t('See your Nest')],['earn',t('Earn'),t('See jobs')],['shop',t('Shop'),t('Browse Essentials')],['send',t('Send'),t('See your plan')]];
  return `<section class="home-dashboard" aria-label="${esc(t('Home dashboard'))}"><header><h1>${esc(t('Your NiaSave home'))}</h1><p>${esc(t('Updates shown here come from Central'))}</p></header><section aria-labelledby="home-attention-title"><h2 id="home-attention-title">${esc(t('Needs attention'))}</h2><div class="home-attention-grid"><article class="home-attention-card" data-state="${esc(stay.state)}"><div class="home-card-heading"><span aria-hidden="true">${icon('live')}</span><h3>${esc(t('Stay and membership fee'))}</h3></div><div role="status">${stayText}<p class="home-fee-label">${esc(t('Membership fee'))}</p>${feeText}</div><button type="button" data-action="live">${esc(t('View your stay'))}</button></article>${card(t('Nearby job'),'earn',job.state,jobText)}</div></section><section aria-labelledby="home-less-title"><h2 id="home-less-title">${esc(t('Explore LESS'))}</h2><div class="home-tiles">${tiles.map(([action,name,link])=>`<button type="button" class="home-tile" data-action="${action}" data-state="${esc(model.tiles[action])}"><span aria-hidden="true">${icon(action)}</span><strong>${esc(name)}</strong><small>${copy(model.tiles[action])}</small><span class="home-tile-link">${esc(link)}</span></button>`).join('')}</div></section></section>`;
}
