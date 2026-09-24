import {SUPPORT_KIND_IDS} from './lib/commerce/support.mjs';

const LABELS = {
  missing_item: 'Missing item',
  quality: 'Quality problem',
  late: 'Late or not ready',
  return_refund: 'Request a return / refund',
  other: 'Something else',
  move_in: 'Move-in problem',
  nest_details: 'Incorrect Nest details',
  job_details: 'Incorrect job details',
  application_update: 'Missing application update',
  identity_access: 'Identity or access problem'
};

export function supportKindLabel(kind, t) {
  return t(LABELS[kind] || kind);
}

export function supportFormMarkup({t, esc}, {orderId='', relatedRef='', kinds=SUPPORT_KIND_IDS}={}) {
  return `<form id="support-form" class="stack">
    ${orderId?`<input type="hidden" name="orderId" value="${esc(orderId)}">`:''}
    <label>${t('What happened?','क्या हुआ?')}<select name="kind">${kinds.map(k=>`<option value="${k}">${esc(supportKindLabel(k,t))}</option>`).join('')}</select></label>
    <label>${t('Related reference (optional)')}<input name="relatedRef" value="${esc(relatedRef)}" maxlength="120" placeholder="${esc(t('Order, Nest or job reference'))}"></label>
    <label>${t('Tell us more (optional)','और बताएँ (ज़रूरी नहीं)')}<textarea name="note" maxlength="500"></textarea></label>
    <p>${t('Submitting a request does not mean a refund has been approved or paid. Your Nia team will review it.','अनुरोध भेजने का मतलब रिफंड की मंज़ूरी या भुगतान नहीं है। निया टीम इसकी जाँच करेगी।')}</p>
    <div id="form-error" class="error-inline" role="alert"></div>
    <button class="primary">${t('Send request','अनुरोध भेजें')}</button>
  </form>`;
}

export function supportIssueLine(issue, {t, esc}) {
  const refund = issue.refundApproved === true
    ? t('Refund approved by the Nia team')
    : (issue.kind === 'return_refund' ? t('Refund request only · not approved') : '');
  return `<p class="info">${t('Help request','मदद का अनुरोध')} ${esc(issue.reference || issue.id)} · ${esc(t(issue.status))}${issue.relatedRef?`<br>${t('Related reference')}: ${esc(issue.relatedRef)}`:''}${refund?`<br>${esc(refund)}`:''}${issue.note?`<br>${esc(issue.note)}`:''}</p>`;
}
