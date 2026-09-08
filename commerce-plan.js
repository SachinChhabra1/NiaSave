// A planning calculator, not a payment instruction or a second transaction book.
// Central owns the saved plan (one per member and month); this module renders it
// and converts between the member's rupee inputs and Central's integer paise.
export const planFields=['income','essentials','debt','buffer','other','home'];
const centralKeys={income:'incomePaise',essentials:'essentialsPaise',debt:'debtPaise',buffer:'bufferPaise',other:'otherPaise',home:'homePaise'};
export function calculatePlan(values){
  const amounts={};
  for(const key of planFields){const raw=String(values[key]??'').trim();if(raw==='')return {status:'incomplete'};if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return {status:'invalid'};const value=Math.round(Number(raw)*100);if(!Number.isSafeInteger(value)||value>100000000)return {status:'invalid'};amounts[key]=value;}
  const available=amounts.income-amounts.essentials-amounts.debt-amounts.buffer-amounts.other;
  return {status:'ready',available,home:amounts.home,remaining:available-amounts.home,shortfall:Math.max(0,amounts.home-available),amounts};
}
// Central fields (paise or null) -> rupee strings for the inputs. null stays blank.
export function valuesFromFields(fields){
  const values={};
  for(const key of planFields){const paise=fields?.[centralKeys[key]];values[key]=Number.isSafeInteger(paise)?(paise/100).toFixed(2).replace(/\.00$/,''):'';}
  return values;
}
// Rupee strings -> Central fields. Blank stays null (unknown); a bad amount returns null overall.
export function fieldsFromValues(values){
  const fields={};
  for(const key of planFields){const raw=String(values?.[key]??'').trim();if(raw===''){fields[centralKeys[key]]=null;continue;}if(!/^\d+(?:\.\d{1,2})?$/.test(raw))return null;const paise=Math.round(Number(raw)*100);if(!Number.isSafeInteger(paise)||paise>100000000)return null;fields[centralKeys[key]]=paise;}
  return fields;
}
export function sameFields(a,b){return JSON.stringify(a??null)===JSON.stringify(b??null);}
export function planResult(values,{t,money}){
  const r=calculatePlan(values);
  if(r.status!=='ready')return `<p>${r.status==='invalid'?t('Use amounts from 0 to 10,00,000, with up to two decimal places.'):t('Fill every amount to see your plan. Enter 0 where there is no cost.')}</p>`;
  return `<div class="plan-result-grid"><div><span>${t('Estimated room to send home')}</span><strong>${money(Math.max(0,r.available)/100)}</strong></div><div><span>${t('Your send-home target')}</span><strong>${money(r.home/100)}</strong></div></div><p class="${r.shortfall?'plan-gap':'plan-ready'}">${r.shortfall?t('Budget shortfall')+': '+money(r.shortfall/100):t('Left after your target')+': '+money(r.remaining/100)}</p><small>${t('An estimate, not your bank balance or a transfer. Review your needs before sending money.')}</small>`;
}
// Saved-state line and save controls. `plan` is the adapter state kept by commerce.js:
// {status:'loading'|'ready'|'unavailable', canSave, revision, updatedAt, saveState:'saved'|'unsaved'|'saving'|'error'|'conflict', error}
export function planStatus(plan,{t,esc,when}){
  if(!plan||plan.status==='loading')return `<p class="plan-status" id="plan-status">${t('Checking your saved plan…')}</p>`;
  if(plan.status==='unavailable')return `<p class="plan-status" id="plan-status">${esc(plan.error||t('Account saving is not connected yet. The calculator still works; nothing is saved.'))}</p>`;
  if(!plan.canSave)return `<p class="plan-status" id="plan-status">${t('Saving needs an active, verified membership. The calculator still works; nothing is saved.')}</p>`;
  const lines={
    saving:t('Saving…'),
    saved:plan.updatedAt?t('Saved to your account')+' · '+esc(when(plan.updatedAt)):t('Nothing saved yet for this month.'),
    unsaved:t('Not saved yet. Your typed amounts stay here until you save.'),
    error:esc(plan.error||t('Could not save. Your typed amounts are still here; try again.')),
    conflict:t('Your plan changed elsewhere. Reload it, check the amounts, then save again.')
  };
  const buttons=plan.saveState==='conflict'
    ? `<button data-action="books-plan-reload">${t('Reload saved plan')}</button>`
    : `<button data-action="books-plan-save" ${plan.saveState==='saving'||plan.saveState==='saved'?'disabled':''}>${plan.saveState==='saving'?t('Saving…'):t('Save my plan')}</button>`;
  return `<p class="plan-status ${plan.saveState==='error'||plan.saveState==='conflict'?'plan-gap':''}" id="plan-status" aria-live="polite">${lines[plan.saveState]||lines.unsaved}</p><div class="plan-actions" id="plan-actions">${buttons}</div>`;
}
export function planForm(values,month,{t,esc,money,actual,plan,when=v=>v}){
  const fields=[['income',t('Expected take-home income')],['essentials',t('Food, rent, travel and bills')],['debt',t('Debt repayments')],['buffer',t('Emergency savings')],['other',t('Other planned spending')],['home',t('My send-home target')]];
  return `<div class="stack"><p>${esc(new Date(month+'-01T12:00:00Z').toLocaleDateString(document.documentElement.lang+'-IN',{month:'long',year:'numeric'}))} · ${t('Monthly totals in rupees')}</p><details class="plan-guidance"><summary>${t('What should I include?')}</summary><p>${t('Include income already received and costs already paid in these totals. Do not add them twice. Use take-home income, not CTC or borrowed money.')}</p></details>${actual?`<details class="plan-guidance"><summary>${t('Recorded this month')}</summary><p>${t('Earnings')}: ${actual.entries.some(e=>e.kind==='earning')?money(actual.totals.earned/100):t('Not recorded')}<br>${t('Expenses')}: ${money(actual.totals.spent/100)}<br>${t('Sent home')}: ${money(actual.totals.home/100)}</p><small>${t('Recorded amounts are already part of your monthly totals. Do not subtract them again.')} ${!actual.complete?t('Incomplete'):''}</small></details>`:''}<form id="books-plan-form" class="plan-inputs">${fields.map(([key,label])=>`<label>${label}<input name="${key}" type="number" inputmode="decimal" min="0" max="1000000" step="0.01" value="${esc(values[key]??'')}" placeholder="${t('Enter amount')}" ${plan?.saveState==='saving'?'disabled':''}></label>`).join('')}</form><div id="plan-result" class="plan-result" aria-live="polite">${planResult(values,{t,money})}</div>${planStatus(plan,{t,esc,when})}<small>${t('Blank amounts are unknown, not zero. A saved plan is a budget, not a transfer or a loan request.')}</small><button data-action="close">${t('Back to NiaBooks')}</button></div>`;
}
export function planCard(t){return `<section class="panel books-plan"><div><span class="eyebrow">${t('Monthly budget')}</span><h2>${t('My plan this month')}</h2><p>${t('Plan your essentials, a safety buffer and what you want to send home.')}</p></div><button data-action="books-plan">${t('Work out my plan')}</button></section>`;}
