var BISON_PAGE=document.body.getAttribute('data-bison-page')||'control';
var DATA=null,CONTRACTS=null,COLLECTIONS=null,SELECTED_STUDIO=null,SELECTED_RECEIVABLE=null;
function byId(id){return document.getElementById(id);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function num(n){return n==null?0:n;}
function rupee(n){return '₹'+Number(n||0).toLocaleString('en-IN');}
function isoPlus(days){var d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10);}
function table(heads,rows,cls){
  return '<table><thead><tr>'+heads.map(function(h){return '<th>'+esc(h)+'</th>';}).join('')+'</tr></thead><tbody>'+
    (rows.map(function(r){return '<tr'+(cls?' class="'+cls+'"':'')+'>'+r.map(function(c){var raw=String(c==null?'':c),numeric=typeof c==='number'||/^₹[\d,.-]+$/.test(raw)||/^-?\d+(?:\.\d+)?$/.test(raw);return '<td class="'+(numeric?'num':'left')+'">'+esc(c)+'</td>';}).join('')+'</tr>';}).join('')||'<tr><td class="left" colspan="'+heads.length+'">None.</td></tr>')+
    '</tbody></table>';
}
function setStatus(id,message,bad){var el=byId(id);if(!el)return;el.textContent=message||'';el.className='statusline'+(bad?' bad':'');}
function currentStudios(){var select=byId('theatre'),theatre=select?(select.value||'All'):'All';return (DATA&&DATA.studios||[]).filter(function(s){return theatre==='All'||s.theatre===theatre;});}
function renderTop(){var t=DATA||{},k=t.kpis||{};byId('topmeta').innerHTML='Bison · '+num(k.studios)+' studios<br>'+num(k.committed)+' committed / '+num(k.capacity)+' capacity · '+num(k.bookingsOpen)+' open stays · as of '+esc(t.asOf||'-');}
function renderKpis(){var k=(DATA&&DATA.kpis)||{},el=byId('kpis');if(!el)return;el.innerHTML=[['In house',k.inHouse],['Reserved',k.reserved],['Vacant',k.vacant],['Studios',k.studios],['Overlap review',k.overlapReviews],['Overdue clocks',k.overdueClocks],['Active contracts',k.activeContracts],['Contract review',k.contractsNeedReview],['Pending',rupee(k.pending)],['Unallocated',rupee(k.unallocated)]].map(function(row){return '<div class="kpi"><div class="l">'+esc(row[0])+'</div><div class="n">'+esc(num(row[1]))+'</div></div>';}).join('');}
function renderRecon(){var r=(DATA&&DATA.reconciliation)||{},el=byId('recon');if(!el)return;el.textContent=(r.ok?'Reconciled':'Mismatch')+' · '+num(r.capacity)+' capacity = '+num(r.booked)+' committed + '+num(r.vacant)+' vacant · delta '+num(r.delta)+' · '+num(r.openStays)+' open stays, '+num(r.overlaps)+' overlaps to review · '+(r.source||'');}
function renderControl(){
  renderKpis();renderRecon();var k=DATA.kpis||{};
  [['control-studios',num(k.studios)+' studios'],['control-contracts',num(k.activeContracts)+' active'],['control-clocks',num(k.overdueClocks)+' overdue'],['control-collections',rupee(k.pending)+' pending'],['control-nests',num(k.bookingsOpen)+' open stays']].forEach(function(row){var el=byId(row[0]);if(el)el.textContent=row[1]+' →';});
}
function fillTheatre(){var th=byId('theatre');if(!th)return;var cur=th.value||'All',choices=(DATA.theatres||['All']).filter(function(x,i,a){return x&&a.indexOf(x)===i;});th.innerHTML=choices.map(function(x){return '<option'+(x===cur?' selected':'')+'>'+esc(x)+'</option>';}).join('');}
function renderStudios(){
  fillTheatre();var studios=currentStudios(),byTheatre={};
  studios.forEach(function(s){if(!byTheatre[s.theatre])byTheatre[s.theatre]={studios:0,capacity:0,booked:0,vacant:0};byTheatre[s.theatre].studios++;byTheatre[s.theatre].capacity+=num(s.capacity);byTheatre[s.theatre].booked+=num(s.booked);byTheatre[s.theatre].vacant+=num(s.vacant);});
  byId('theatre-tbl').innerHTML=table(['Theatre','Studios','Capacity','Committed','Vacant'],Object.keys(byTheatre).sort().map(function(name){var x=byTheatre[name];return[name,x.studios,x.capacity,x.booked,x.vacant];}));
  byId('studios-tbl').innerHTML=table(['Studio','Theatre','Committed','In','Reserved','Vacant','Clock'],studios.map(function(s){return[s.code,s.theatre,s.booked+'/'+s.capacity,s.inHouse,s.reserved,s.vacant,s.clock];}),'pick');
  document.querySelectorAll('#studios-tbl tr.pick').forEach(function(row,index){row.onclick=function(){location.href='/bison-clocks.html?studio='+encodeURIComponent(studios[index].id);};});
}
function fillStudioOptions(){var select=byId('contract-studio');if(!select)return;select.innerHTML='<option value="">Select studio</option>'+(DATA.studios||[]).map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.theatre+' · '+s.code+' · '+s.vacant+' vacant')+'</option>';}).join('');}
function renderContracts(){fillStudioOptions();var cs=CONTRACTS&&CONTRACTS.contracts||DATA.contracts||[];byId('contracts-tbl').innerHTML=table(['Member','Studio','Nest','Start','End','Rupee','Document','State'],cs.map(function(c){return[c.member,c.studio,c.nestId,c.startDate,c.endDate,rupee(c.monthlyRent),c.signedStatus,c.status];}));}
function selectStudio(id){
  SELECTED_STUDIO=(DATA.studios||[]).find(function(s){return s.id===id;})||null;var button=byId('close-clock');if(button)button.disabled=!SELECTED_STUDIO;
  if(byId('clock-title'))byId('clock-title').textContent=SELECTED_STUDIO?'Close '+SELECTED_STUDIO.code:'Close a studio clock';setStatus('clock-status',SELECTED_STUDIO?SELECTED_STUDIO.clock:'No studio selected.');
  if(SELECTED_STUDIO&&byId('counted-nests'))byId('counted-nests').value=SELECTED_STUDIO.capacity||'';
  if(SELECTED_STUDIO&&byId('vacant-nests'))byId('vacant-nests').value=SELECTED_STUDIO.vacant||'';
  if(SELECTED_STUDIO&&byId('clock-card'))byId('clock-card').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderClocks(){
  var overdue=(DATA.studios||[]).filter(function(s){return String(s.clock).indexOf('Overdue')===0;});byId('clocks-tbl').innerHTML=table(['Studio','Theatre','Clock','Owner','Committed','Vacant'],overdue.map(function(s){return[s.code,s.theatre,s.clock,s.owner,s.booked,s.vacant];}),'pick');
  document.querySelectorAll('#clocks-tbl tr.pick').forEach(function(row,index){row.onclick=function(){selectStudio(overdue[index].id);};});
  var requested=new URLSearchParams(location.search).get('studio');if(requested)selectStudio(requested);
}
function selectReceivable(row){
  SELECTED_RECEIVABLE=row;byId('collection-card').hidden=false;byId('collection-title').textContent='Work '+row.id+' · '+rupee(row.balance);byId('collection-contract').value=row.contractId||'';byId('allocation-amount').value=row.memberId?'':row.balance;byId('allocation-amount').max=row.balance||'';byId('collection-owner').value=row.owner||'';byId('collection-promise').value=row.promiseDate||'';byId('collection-state').value=['open','promised','disputed','waived'].indexOf(row.status)>=0?row.status:'open';byId('payment-amount').max=row.balance||'';setStatus('collection-status',row.memberId?'Member linked.':'Allocate only the supported amount to a contract before posting payment.');byId('collection-card').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderCollections(){
  var col=COLLECTIONS||{},age=col.ageing||{};byId('ageing-tbl').innerHTML=table(['Current','1–30','31–60','61–90','90+','Unallocated'],[[rupee(age.current),rupee(age.d1_30),rupee(age.d31_60),rupee(age.d61_90),rupee(age.d90plus),rupee(age.unallocated)]]);
  var rec=col.receivables||DATA.collections||[];byId('collections-tbl').innerHTML=table(['Member','Studio','Kind','Due','Balance','Owner','State'],rec.map(function(x){return[x.member,x.studio,x.kind,x.dueDate,rupee(x.balance),x.owner,x.status];}),'pick');document.querySelectorAll('#collections-tbl tr.pick').forEach(function(row,index){row.onclick=function(){selectReceivable(rec[index]);};});
}
function renderNests(){var nests=DATA.bookings||[];byId('nests-tbl').innerHTML=table(['Studio','Nest','Member','State','Arrive','Depart'],nests.map(function(b){var s=(DATA.studios||[]).find(function(x){return x.id===b.studioId;})||{};return[s.code||b.studioId,b.nestId,b.guest,b.status,b.arrive,b.depart];}));}
function paint(){renderTop();if(BISON_PAGE==='control')renderControl();else if(BISON_PAGE==='studios')renderStudios();else if(BISON_PAGE==='contracts')renderContracts();else if(BISON_PAGE==='clocks')renderClocks();else if(BISON_PAGE==='collections')renderCollections();else if(BISON_PAGE==='nests')renderNests();}
function api(url,body){var init=body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{};return fetch(url,init).then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.message||j.error||'Failed');return j;});});}
function load(){var calls=[api('/api/bison/tower?city=All')];if(BISON_PAGE==='contracts')calls.push(api('/api/bison/contracts?limit=100'));if(BISON_PAGE==='collections')calls.push(api('/api/bison/collections?limit=100'));return Promise.all(calls).then(function(rows){DATA=rows[0];if(BISON_PAGE==='contracts')CONTRACTS=rows[1];if(BISON_PAGE==='collections')COLLECTIONS=rows[1];paint();}).catch(function(e){setStatus('page-status','Could not load Bison · '+e.message,true);if(byId('topmeta'))byId('topmeta').textContent='Could not load Bison';});}
function bind(){
  if(byId('theatre'))byId('theatre').onchange=renderStudios;
  if(byId('contract-start')){byId('contract-start').value=new Date().toISOString().slice(0,10);byId('contract-end').value=isoPlus(30);}
  if(byId('create-contract'))byId('create-contract').onclick=function(){var button=this,studioId=byId('contract-studio').value;if(!studioId){setStatus('contract-status','Please select a studio before creating the contract.',true);byId('contract-studio').focus();return;}button.disabled=true;setStatus('contract-status','Creating member…');api('/api/bison/members',{name:byId('member-name').value,phone:byId('member-phone').value}).then(function(m){setStatus('contract-status','Creating contract…');return api('/api/bison/contracts',{memberId:m.member.id,studioId:studioId,nestId:byId('contract-nest').value,monthlyRent:Number(byId('contract-rent').value),deposit:Number(byId('contract-deposit').value||0),startDate:byId('contract-start').value,endDate:byId('contract-end').value,signedStatus:byId('contract-signed').value});}).then(function(c){setStatus('contract-status','Created '+c.contract.id+'.');return load();}).catch(function(e){setStatus('contract-status',e.message==='studio_not_found'?'The selected studio is no longer available. Refresh the page and select it again.':e.message,true);}).finally(function(){button.disabled=false;});};
  if(byId('close-clock'))byId('close-clock').onclick=function(){if(!SELECTED_STUDIO)return;var button=this;button.disabled=true;api('/api/bison/clock',{studioId:SELECTED_STUDIO.id,evidence:byId('clock-evidence').value,countedNests:byId('counted-nests').value,vacantNests:byId('vacant-nests').value,checks:{physicalCount:byId('physical-check').checked,vacantVerified:byId('vacant-check').checked,collectionsReviewed:byId('collection-check').checked},nextHours:18}).then(function(){setStatus('clock-status','Clock closed with staff identity and evidence.');return load();}).catch(function(e){setStatus('clock-status',e.message,true);}).finally(function(){button.disabled=false;});};
  if(byId('save-collection'))byId('save-collection').onclick=function(){if(!SELECTED_RECEIVABLE)return;api('/api/bison/collections/work',{receivableId:SELECTED_RECEIVABLE.id,contractId:byId('collection-contract').value,allocationAmount:byId('allocation-amount').value,owner:byId('collection-owner').value,promiseDate:byId('collection-promise').value,status:byId('collection-state').value,note:byId('collection-note').value}).then(function(){setStatus('collection-status','Collection work saved.');return load();}).catch(function(e){setStatus('collection-status',e.message,true);});};
  if(byId('post-payment'))byId('post-payment').onclick=function(){if(!SELECTED_RECEIVABLE)return;api('/api/bison/collections/payments',{receivableId:SELECTED_RECEIVABLE.id,amount:Number(byId('payment-amount').value),reference:byId('payment-ref').value,method:'upi'}).then(function(){setStatus('collection-status','Payment posted and balance updated.');return load();}).catch(function(e){setStatus('collection-status',e.message,true);});};
}
bind();load();
setInterval(function(){if(!document.hidden)load();},15000);
document.addEventListener('visibilitychange',function(){if(!document.hidden)load();});
