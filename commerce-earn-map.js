// Read-only view of Central's member-scoped Walk2Work projection.
// See docs/central-member-map-contract.md. No geolocation or local job ledger.
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const verifiedPoint = p => p?.verified === true && typeof p.lat === 'number' && Number.isFinite(p.lat) && Math.abs(p.lat) <= 85.051129 && typeof p.lng === 'number' && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180;
export function distanceKm(a,b) {
  const rad = n => n*Math.PI/180;
  const d = Math.sin(rad(b.lat-a.lat)/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.min(1,d)));
}
export function mapModel(data, now=Date.now()) {
  const source=data?.map;
  if(source?.status !== 'ready') return {status:source?.status==='studio_missing'?'studio_missing':'unavailable',jobs:[]};
  const age=now-Date.parse(source.asOf);
  if(!Number.isFinite(age)||age>300000||age < -60000) return {status:'stale',jobs:[]};
  if(!verifiedPoint(source.studio)) return {status:'studio_missing',jobs:[]};
  const jobs=(data.jobs||[]).filter(j=>j.mandateStatus==='open' && Number.isInteger(j.openPositions) && j.openPositions>0 && Date.parse(j.closesAt)>now && verifiedPoint(j.workplace)).map(j=>({...j,distanceKm:distanceKm(source.studio,j.workplace)})).sort((a,b)=>a.distanceKm-b.distanceKm);
  return {status:'ready',studio:source.studio,asOf:source.asOf,jobs};
}
const rupees=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
export function jobTravel(job,studio,now=Date.now()){
  const c=job.commute;
  if(c&&c.studioId===studio?.id&&c.jobRevision===job.revision&&['walk','bus','shuttle','metro','auto'].includes(c.mode)&&Number.isFinite(c.returnMin)&&Number.isFinite(c.returnMax)&&c.returnMin>=0&&c.returnMax>=c.returnMin&&Date.parse(c.validUntil)>now&&Date.parse(c.asOf)<=now&&now-Date.parse(c.asOf)<=86400000&&typeof c.source==='string'&&c.source.trim()&&c.routeVerified===true)return {min:c.returnMin,max:c.returnMax,mode:c.mode,example:false,source:c.source};
  // Presentation assumptions only; never infer a live fare or walking route from aerial distance.
  if(job.preview===true&&String(job.employer).startsWith('Demo \u00b7')&&Number.isFinite(job.distanceKm))return job.distanceKm<1?{min:0,max:0,mode:'walk',example:true,source:'Example walk budget; route not verified'}:{min:30,max:50,mode:'bus',example:true,source:'Example bus budget; route and fare not verified'};
  return null;
}
export function mapJobDetails(job,index,studio,t){
  const commute=jobTravel(job,studio),range=(a,b)=>a===b?rupees(a):rupees(a)+'\u2013'+rupees(b);
  const pay=Number.isFinite(job.payMin)&&Number.isFinite(job.payMax)?`${range(job.payMin,job.payMax)} / ${job.payPeriod==='day'?t('day'):t('month')}`:t('Pay awaiting confirmation');
  const ctc=job.compensation?.type==='ctc'&&job.compensation?.verified===true&&Number.isFinite(job.compensation.min)&&Number.isFinite(job.compensation.max)&&job.compensation.min>=0&&job.compensation.max>=job.compensation.min&&['month','year'].includes(job.compensation.period)?`${t('CTC')}: ${range(job.compensation.min,job.compensation.max)} / ${t(job.compensation.period)}`:t('CTC not confirmed');
  return `<span class="map-job-company">${escape(job.employer)}</span><strong>${escape(t(job.title))}</strong><span>${t('Pay')}: ${escape(pay)}</span><small>${escape(ctc)}</small><span class="map-job-travel">${commute?`${escape(range(commute.min,commute.max))} ${t('return / workday')} \u00b7 ${escape(t(commute.mode))}`:t('Return fare awaiting route estimate')}</span>${commute?`<small>${commute.example?t('Example budget; route unverified'):t('Route-based estimate')}</small>`:''}`;
}
export function mapMarkup(model,t,icon) {
  const messages={studio_missing:['Your Nest location needs an update','आपके नेस्ट की जगह अपडेट करनी है'],stale:['Job locations need refreshing','नौकरियों की जगह ताज़ा करनी है'],unavailable:['Your neighbourhood map is being connected','आपके आसपास का नक्शा जोड़ा जा रहा है']};
  if(model.status!=='ready') {const m=messages[model.status]||messages.unavailable;return `<section class="earn-map-empty panel"><span class="earn-home-icon">${icon('live')}</span><h2>${t(...m)}</h2><p>${t('Your current Nest and nearby open jobs will appear here once their locations are verified.','जगहों की पुष्टि होने पर आपका मौजूदा नेस्ट और पास की खुली नौकरियाँ यहाँ दिखेंगी।')}</p><button data-action="help">${t('Ask your Nia team','अपनी निया टीम से पूछें')}</button></section>`;}
  return `<section class="earn-map-panel" aria-label="${t('Jobs around your Nest','आपके नेस्ट के पास नौकरियाँ')}"><div class="earn-map-heading"><span class="earn-home-icon">${icon('live')}</span><div><small>${t('YOUR CURRENT NEST','आपका मौजूदा नेस्ट')}</small><h2>${escape(model.studio.name)}</h2></div><button type="button" id="earn-map-reset">${t('Show all','सभी दिखाएँ')}</button></div><div id="earn-map" class="earn-map" role="region" aria-label="${t('Map of your Nest and open jobs','आपके नेस्ट और खुली नौकरियों का नक्शा')}"></div><div class="earn-map-key"><span>◆ ${t('Your Nest','आपका नेस्ट')}</span><span>● ${t('Open jobs','खुली नौकरियाँ')} · ${model.jobs.length}</span></div><p id="earn-map-status" class="earn-map-note" role="status">${t('Distances are straight-line, not walking routes. Use + and − to zoom.','दूरी सीधी रेखा में है, पैदल रास्ते की नहीं। ज़ूम के लिए + और − दबाएँ।')}</p></section>`;
}
let library;
function leaflet() {
  if(!library) library=new Promise((resolve,reject)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/leaflet/leaflet.css';
    const script=document.createElement('script');script.src='/assets/leaflet/leaflet.js';
    let stylesReady=false,scriptReady=false;
    const finish=()=>{if(stylesReady&&scriptReady)resolve(window.L);};
    const failed=()=>{script.remove();css.remove();library=null;reject(Error('map_unavailable'));};
    css.onload=()=>{stylesReady=true;finish();};script.onload=()=>{scriptReady=true;finish();};css.onerror=script.onerror=failed;
    document.head.append(css,script);
  });
  return library;
}
export function mountMap(model,t) {
  const container=document.querySelector('#earn-map');if(!container||model.status!=='ready')return ()=>{};
  let map,disposed=false;
  leaflet().then(L=>{
    if(disposed||!container.isConnected)return;
    map=L.map(container,{scrollWheelZoom:false,dragging:!matchMedia('(pointer: coarse)').matches,touchZoom:true,zoomControl:true});
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).on('tileerror',()=>{const note=document.querySelector('#earn-map-status');if(note)note.textContent=t('Map background unavailable. Your job list is still below.','नक्शे का बैकग्राउंड उपलब्ध नहीं है। नौकरियों की सूची नीचे है।');}).addTo(map);
    const points=[[model.studio.lat,model.studio.lng]];
    const home=L.divIcon({className:'earn-pin earn-pin-home',html:'<span aria-hidden="true">◆</span>',iconSize:[38,38],iconAnchor:[19,19]});
    L.marker(points[0],{icon:home,zIndexOffset:-1000,title:t('Your Nest','आपका नेस्ट')+': '+model.studio.name}).addTo(map).bindPopup(document.createTextNode(model.studio.name));
    model.jobs.forEach((job,index)=>{
      const point=[job.workplace.lat,job.workplace.lng];points.push(point);
      const marker=L.divIcon({className:'earn-pin earn-pin-job',html:`<span>${index+1}</span>`,iconSize:[38,38],iconAnchor:[19,19]});
      const node=document.createElement('div');node.className='map-job-popup';node.innerHTML=mapJobDetails(job,index,model.studio,t);
      const travel=jobTravel(job,model.studio);
      if(travel){const monthly=document.createElement('p');monthly.textContent=`${t('At 26 workdays')}: ${travel.min===travel.max?rupees(travel.min*26):rupees(travel.min*26)+'\u2013'+rupees(travel.max*26)} / ${t('month')}. ${t('Travel budget only; workdays may differ.')}`;node.append(monthly);}
      const button=document.createElement('button');button.textContent=t('View job','नौकरी देखें');button.onclick=()=>{const card=document.getElementById('earn-job-'+job.id);const details=card?.querySelector('details');if(details)details.open=true;card?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});card?.focus({preventScroll:true});};node.append(button);
      const pin=L.marker(point,{icon:marker,title:`${index+1}. ${job.title} \u00b7 ${job.employer}`,zIndexOffset:index}).addTo(map).bindPopup(node,{maxWidth:280});
      pin.bindTooltip(mapJobDetails(job,index,model.studio,t),{permanent:true,interactive:true,direction:index%2?'right':'left',offset:[index===2?-100:index%2?24:-24,index===1?-55:0],className:'map-job-label',opacity:1});pin.getTooltip().on('click',()=>pin.openPopup());
      document.querySelector(`[data-map-job="${index}"]`)?.addEventListener('click',()=>{pin.openPopup();container.scrollIntoView({behavior:'smooth',block:'center'});});

    });
    const reset=()=>{const narrow=container.clientWidth<600;map.fitBounds(points,{paddingTopLeft:narrow?[38,38]:[220,120],paddingBottomRight:narrow?[38,38]:[220,115],maxZoom:15});};reset();
    document.querySelector('#earn-map-reset')?.addEventListener('click',reset,{once:false});
  }).catch(()=>{if(!disposed&&container.isConnected)container.textContent=t('Map unavailable. Browse the jobs below.','नक्शा उपलब्ध नहीं है। नीचे नौकरियाँ देखें।');});
  return ()=>{if(disposed)return;disposed=true;map?.remove();map=null;};
}
