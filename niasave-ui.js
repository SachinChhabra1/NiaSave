const CLAIM_STATES = ['draft','queued','submitted','matching','confirmed','changed','declined'];
const VIEW_STATES = ['loading','ready','stale','source_missing','unavailable','empty','offline'];

const claimCopy = {
  draft: 'Saved on this phone. Not sent yet.',
  queued: 'Waiting for signal. We will send this once.',
  submitted: 'Reached Nia. Waiting for an answer.',
  matching: 'Nia is matching this request.',
  confirmed: 'Confirmed. The terms below are from Nia.',
  changed: 'This changed. Read the new terms and confirm again.',
  declined: 'Not available. Ask your Nia team for the next step.'
};

const viewCopy = {
  loading: 'Loading…',
  ready: '',
  stale: 'Checking again… These numbers are not current.',
  source_missing: 'This place is not connected yet. Call for help.',
  unavailable: 'Nia could not be reached. Call for help, or retry.',
  empty: 'Nothing here yet.',
  offline: 'Saved on your phone. We will send this when signal returns.'
};

export function claimStateMarkup(state, terms=''){
  const key = CLAIM_STATES.includes(state) ? state : 'submitted';
  const extra = key==='confirmed' && terms ? `<p class="nia-body">${terms}</p>` : '';
  return `<section class="nia-state nia-claim nia-claim-${key}" data-claim="${key}"><p class="nia-body">${claimCopy[key]}</p>${extra}</section>`;
}

export function viewStateMarkup(state, body=''){
  const key = VIEW_STATES.includes(state) ? state : 'unavailable';
  if(key==='loading') return `<div class="nia-state nia-skel" data-view="loading" aria-busy="true"><div class="nia-skel-line"></div><div class="nia-skel-line"></div><div class="nia-skel-card"></div></div>`;
  if(key==='ready') return `<div class="nia-state" data-view="ready">${body}</div>`;
  const cls = key==='stale' ? ' nia-state-stale' : '';
  return `<section class="nia-state${cls}" data-view="${key}"><p class="nia-body">${viewCopy[key]}</p>${body}</section>`;
}

export function youKeepMarkup(amount){
  if(amount==null || amount==='') return '';
  return `<p class="nia-keep">You keep ${amount}</p>`;
}

export { CLAIM_STATES, VIEW_STATES };
