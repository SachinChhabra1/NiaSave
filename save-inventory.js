export const CSV_COLUMNS=['siteCode','sku','productId','name','pack','pricePaise','onHand','countedAt','priceVerifiedAt','active','expectedRevision'];
const MAX_CSV_BYTES=200_000;
export function parseInventoryCsv(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>MAX_CSV_BYTES)throw Error('CSV must be no larger than 200 KB.');
  text=text.replace(/^\uFEFF/,'');
  const records=[];let record=[],value='',quoted=false,closed=false;
  const field=()=>{record.push(value);value='';closed=false;};
  const row=()=>{field();if(record.some(cell=>cell.trim()))records.push(record);record=[];};
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
    if(c==='"'){if(value||closed)throw Error('CSV has a misplaced quote.');quoted=true;continue;}
    if(c===','){field();continue;}
    if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row();continue;}
    if(closed)throw Error('CSV has text after a closing quote.');
    value+=c;
  }
  if(quoted)throw Error('CSV has an unclosed quoted field.');
  if(value||record.length||closed)row();
  const headers=records.shift()?.map(cell=>cell.trim());
  if(!headers||headers.length!==CSV_COLUMNS.length||new Set(headers).size!==headers.length||CSV_COLUMNS.some(key=>!headers.includes(key)))throw Error('Use exactly the 11 columns shown in the upload format.');
  if(!records.length||records.length>100)throw Error('Upload between 1 and 100 inventory rows.');
  return records.map((cells,index)=>{
    const fail=()=>{throw Error(`Check CSV row ${index+2}: every column needs a valid value.`);};
    if(cells.length!==headers.length)fail();
    const item=Object.fromEntries(headers.map((key,i)=>[key,cells[i].trim()]));
    for(const key of ['siteCode','sku','productId','name','pack'])if(!item[key])fail();
    for(const key of ['pricePaise','onHand','expectedRevision']){
      if(!/^\d+$/.test(item[key]))fail();
      item[key]=Number(item[key]);if(!Number.isSafeInteger(item[key]))fail();
    }
    for(const key of ['countedAt','priceVerifiedAt'])if(!/^\d{4}-\d{2}-\d{2}T/.test(item[key])||!Number.isFinite(Date.parse(item[key])))fail();
    if(!['true','false'].includes(item.active))fail();item.active=item.active==='true';
    return item;
  });
}
export function receivedAmountPaise(value){
  if(!/^\d+(?:\.\d{1,2})?$/.test(value))return null;
  const [whole,fraction='']=value.split('.');const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  return Number.isSafeInteger(result)?result:null;
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>Number.isSafeInteger(value)?new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(value/100):'Not recorded';
const recorded=value=>value==null?'Not recorded':escape(value);
const time=value=>{const date=new Date(value);return value&&Number.isFinite(date.getTime())?date.toLocaleString('en-IN',{timeZone:'Asia/Kolkata'})+' IST':'Not recorded';};
const errorText=error=>{
  if(error?.userMessage)return error.userMessage;
  const messages={staff_required:'Sign in again, then reload this page.',staff_access_required:'This Save workflow is not assigned to your account.',forbidden:'This action is not allowed for your account.',invalid_origin:'Reload this page before submitting.',inventory_revision_conflict:'Inventory changed. Refresh it and preview your upload again.',preview_hash_mismatch:'The preview no longer matches. Preview the upload again.',order_revision_conflict:'This order changed. Refresh the list before continuing.',invalid_pickup_code:'The pickup code did not match. Check it with the member.',payment_amount_mismatch:'The received amount must match the order total.'};
  if(/^invalid_inventory_row_\d+$/.test(error?.code||''))return 'The upload was rejected. Check inventory row '+error.code.match(/\d+$/)[0]+' and preview again.';
  return messages[error?.code]||'The request could not be completed. Check the details and try again.';
};

export function startSaveInventory(doc=document,request=window.fetch.bind(window)){
  const $=id=>doc.getElementById(id);let snapshot=null,preview=null,publishKey=null,publishing=false,loading=false,previewRun=0;
  const completions=new Map();
  const api=async(path,body)=>{
    let response;
    try{response=await request('/api/commerce/staff/save/'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'content-type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});}
    catch{throw {userMessage:'Connection interrupted. A submitted action may have succeeded. Retry the same action to check it safely.'};}
    let data;try{data=await response.json();}catch{throw {userMessage:'The server response was unavailable. Refresh before continuing.'};}
    if(!response.ok)throw {code:data?.error,userMessage:response.status===401?'Sign in again, then reload this page.':undefined};
    return data;
  };
  const status=(id,text,bad=false)=>{$(id).textContent=text;$(id).classList.toggle('save-error',bad);};
  const canPublish=()=>snapshot?.capabilities?.publish===true;
  const clearPreview=()=>{previewRun++;preview=null;publishKey=null;$('upload-preview').replaceChildren();$('publish-inventory').hidden=true;$('publish-inventory').disabled=true;$('publish-inventory').textContent='Publish reviewed inventory';status('upload-status','');};
  const inventoryTable=(rows,upload=false)=>'<table><thead><tr><th>Site / SKU</th><th>Product</th><th>Price</th><th>On hand</th>'+(!upload?'<th>Reserved</th><th>Available</th>':'')+'<th>Active</th><th>Revision</th><th>Stock counted</th><th>Price verified</th></tr></thead><tbody>'+rows.map(row=>'<tr><td>'+escape(row.siteCode)+'<br>'+escape(row.sku)+'</td><td>'+escape(row.name)+'<br><small>'+escape(row.pack)+' · '+escape(row.productId)+'</small></td><td>'+money(row.pricePaise)+'</td><td>'+recorded(row.onHand)+'</td>'+(!upload?'<td>'+recorded(row.reserved)+'</td><td>'+recorded(row.available)+'</td>':'')+'<td>'+(row.active===true?'Yes':row.active===false?'No':'Not recorded')+'</td><td>'+recorded(upload?row.expectedRevision:row.revision)+'</td><td>'+escape(time(row.countedAt))+'</td><td>'+escape(time(row.priceVerifiedAt))+'</td></tr>').join('')+'</tbody></table>';
  const renderOrders=()=>{
    const orders=snapshot.orders;
    $('orders-summary').textContent=orders.length+' orders · Read '+time(snapshot.asOf);
    $('order-list').innerHTML=orders.length?orders.map((order,index)=>{
      const pending=order.status==='reserved'&&snapshot.capabilities?.complete===true;
      const lines=(order.lines||[]).map(line=>'<li>'+escape(line.name||line.sku)+' · '+escape(line.pack)+' × '+recorded(line.qty)+'</li>').join('');
      const payment=order.payment?.status==='received'?'<p>Payment received at pickup: '+money(order.payment.amountPaise)+'. Bank settlement has not been verified here.</p>':'';
      return '<article class="card save-order"><h3>Order '+escape(order.id)+'</h3><div class="save-order-meta"><span>'+escape(order.siteCode)+'</span><span>'+escape(order.status)+'</span><strong>'+money(order.totalPaise)+'</strong></div><p>Created '+escape(time(order.createdAt))+(pending?' · Collect before '+escape(time(order.expiresAt)):'')+'</p><ul>'+lines+'</ul>'+payment+(pending?'<form data-order="'+index+'"><label for="pickup-'+index+'">Pickup code from the member</label><input id="pickup-'+index+'" name="pickupCode" autocomplete="off" required maxlength="80"><label for="amount-'+index+'">Amount received (INR)</label><input id="amount-'+index+'" name="amountPaise" inputmode="numeric" type="number" step="0.01" min="0" required><p>Order total: '+money(order.totalPaise)+'. Enter the amount actually received.</p><label for="payment-'+index+'">Payment evidence</label><input id="payment-'+index+'" name="paymentEvidence" required maxlength="500" placeholder="Receipt or payment reference"><label for="handover-'+index+'">Handover evidence</label><input id="handover-'+index+'" name="handoverEvidence" required maxlength="500" placeholder="Collection record or handover reference"><label><input type="checkbox" name="paymentConfirmed" required> I confirm payment was received.</label><label><input type="checkbox" name="handoverConfirmed" required> I confirm these items were handed to the member.</label><div class="actions"><button type="submit">Record payment and collection</button></div><p role="status" aria-live="polite"></p></form>':'')+'</article>';
    }).join(''):'<p>No orders are recorded for your assigned sites.</p>';
  };
  const refresh=async()=>{
    if(loading)return;loading=true;$('refresh-inventory').disabled=true;$('refresh-orders').disabled=true;
    status('save-status','Loading saved inventory and orders…');
    try{
      const data=await api('snapshot');
      if(data?.owner!=='niasave'||!Array.isArray(data.inventory)||!Array.isArray(data.orders)||!Array.isArray(data.sites))throw {};
      snapshot=data;status('save-status','Saved in NiaSave · Read '+time(data.asOf));
      $('inventory-summary').textContent=data.inventory.length+' product/site records · On-hand stock includes reserved units.';
      $('inventory-list').innerHTML=data.inventory.length?inventoryTable(data.inventory):'<p>No inventory has been published for your assigned sites.</p>';
      $('csv-help').innerHTML='<p><code>'+CSV_COLUMNS.join(',')+'</code></p><p>All 11 columns are required. Maximum 100 rows and 200 KB. Price is whole paise; stock is a non-negative whole physical count including reserved units. Use ISO timestamps, true/false for active, and the saved revision (0 for a new record). Quoted commas and double quotes are supported.</p><p>Assigned sites: '+(data.sites.map(site=>escape(site.name)+' (<code>'+escape(site.siteCode)+'</code>)').join(', ')||'None assigned')+'.</p><button type="button" id="download-template" class="ghost">Download blank CSV template</button>';
      $('download-template').onclick=()=>{const blob=new Blob([CSV_COLUMNS.join(',')+'\r\n'],{type:'text/csv'}),url=URL.createObjectURL(blob),link=doc.createElement('a');link.href=url;link.download='niasave-inventory-template.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
      renderOrders();
    }catch(error){snapshot=null;status('save-status',errorText(error),true);$('inventory-summary').textContent='Inventory unavailable';$('orders-summary').textContent='Orders unavailable';$('inventory-list').replaceChildren();$('order-list').replaceChildren();}
    finally{loading=false;$('refresh-inventory').disabled=false;$('refresh-orders').disabled=false;$('preview-inventory').disabled=!canPublish();if(snapshot&&!canPublish())status('upload-status','Inventory publishing is not enabled for your account.');}
  };
  for(const name of ['inventory','orders'])$(name+'-tab').onclick=()=>{
    for(const other of ['inventory','orders']){$(other+'-tab').setAttribute('aria-selected',String(other===name));$(other+'-tab').tabIndex=other===name?0:-1;$(other+'-panel').hidden=other!==name;}
  };
  doc.querySelector('.save-tabs').onkeydown=event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const name=event.key==='Home'?'inventory':event.key==='End'?'orders':$('inventory-tab').getAttribute('aria-selected')==='true'?'orders':'inventory';$(name+'-tab').click();$(name+'-tab').focus();}};
  $('inventory-csv').oninput=clearPreview;
  $('clear-inventory').onclick=()=>{$('inventory-csv').value='';$('inventory-file').value='';clearPreview();};
  $('inventory-file').onchange=async()=>{clearPreview();const run=previewRun,file=$('inventory-file').files[0];if(!file)return;if(file.size>MAX_CSV_BYTES){status('upload-status','CSV must be no larger than 200 KB.',true);return;}try{const text=await file.text();if(run===previewRun)$('inventory-csv').value=text;}catch{if(run===previewRun)status('upload-status','Could not read this file.',true);}};
  $('inventory-upload').onsubmit=async event=>{
    event.preventDefault();if(!canPublish())return;clearPreview();const run=previewRun;$('preview-inventory').disabled=true;
    try{const rows=parseInventoryCsv($('inventory-csv').value);const data=await api('inventory-preview',{rows});if(run!==previewRun)return;if(data.owner!=='niasave'||!Array.isArray(data.rows)||!data.previewHash||data.rowCount!==data.rows.length)throw {};preview=data;publishKey=crypto.randomUUID();$('upload-preview').innerHTML=inventoryTable(data.rows,true);status('upload-status',data.rowCount+' rows checked. Review the quantities, prices and revisions below.');$('publish-inventory').hidden=false;$('publish-inventory').disabled=false;}
    catch(error){if(run===previewRun)status('upload-status',error instanceof Error?error.message:errorText(error),true);}
    finally{$('preview-inventory').disabled=!canPublish();}
  };
  $('publish-inventory').onclick=async()=>{
    if(!preview||publishing||!canPublish())return;publishing=true;$('publish-inventory').disabled=true;$('preview-inventory').disabled=true;$('inventory-csv').disabled=true;$('inventory-file').disabled=true;$('clear-inventory').disabled=true;
    try{await api('inventory-publish',{rows:preview.rows,previewHash:preview.previewHash,idempotencyKey:publishKey});clearPreview();status('upload-status','Inventory published.');await refresh();}
    catch(error){status('upload-status',errorText(error),true);$('publish-inventory').textContent='Retry this publication';}
    finally{publishing=false;$('publish-inventory').disabled=!preview||!canPublish();$('preview-inventory').disabled=!canPublish();$('inventory-csv').disabled=false;$('inventory-file').disabled=false;$('clear-inventory').disabled=false;}
  };
  $('order-list').onsubmit=async event=>{
    const form=event.target.closest('form[data-order]');if(!form)return;event.preventDefault();const order=snapshot?.orders[Number(form.dataset.order)];if(!order)return;
    const fields=new FormData(form),button=form.querySelector('button'),message=form.querySelector('[role="status"]');
    const amountText=String(fields.get('amountPaise')||''),amountPaise=receivedAmountPaise(amountText);
    if(amountPaise==null||amountPaise!==order.totalPaise||!fields.get('paymentConfirmed')||!fields.get('handoverConfirmed')){message.textContent='Confirm payment and handover, and enter the exact received amount.';return;}
    const body={orderId:order.id,expectedRevision:order.revision,pickupCode:String(fields.get('pickupCode')||'').trim(),amountPaise,paymentEvidence:String(fields.get('paymentEvidence')||'').trim(),handoverEvidence:String(fields.get('handoverEvidence')||'').trim()};
    const fingerprint=JSON.stringify(body);if(!completions.has(fingerprint))completions.set(fingerprint,crypto.randomUUID());body.idempotencyKey=completions.get(fingerprint);button.disabled=true;
    try{await api('complete',body);message.textContent='Payment and collection recorded.';await refresh();}
    catch(error){message.textContent=errorText(error);}
    finally{button.disabled=false;}
  };
  $('refresh-inventory').onclick=refresh;$('refresh-orders').onclick=refresh;
  refresh();
}
if(typeof document!=='undefined')startSaveInventory();
