// Presentation only. Callers must supply Central acknowledgement for server states.
export function moneyStatusState({status,centralAcknowledged=false,offlineQueued=false}={}){
  if(offlineQueued)return 'queued';
  if(status==='confirmed'&&centralAcknowledged)return 'confirmed';
  if(status==='reserved'&&centralAcknowledged)return 'reserved';
  if(['requested','interested','contacted','interview','selected','confirmed','reserved'].includes(status))return 'requested';
  return null;
}
export function pickupOperatorName(record){
  const value=record?.heldForPickupBy??record?.pickupOperator?.name;
  const name=typeof value==='string'?value:typeof value?.name==='string'?value.name:'';
  return name.trim()||null;
}
export function moneyStatusMarkup(source,{t,esc}){
  const state=moneyStatusState(source);
  if(!state)return '';
  const label={requested:t('Requested'),reserved:t('Reserved'),confirmed:t('Confirmed'),queued:t('Queued on this phone')}[state];
  const operator=source.kind==='shop'&&state==='reserved'?pickupOperatorName(source.record):null;
  const operatorLine=source.kind==='shop'&&state==='reserved'
    ?`<small class="money-honesty-operator">${operator?`${esc(t('Held for pickup by'))} <strong>${esc(operator)}</strong>`:esc(t('Pickup operator not yet provided by Central'))}</small>`
    :'';
  return `<span class="money-honesty-wrap"><span class="money-honesty-chip" data-money-state="${state}" role="status">${esc(label)}</span>${operatorLine}</span>`;
}
