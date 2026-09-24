export const PARTNER_IDS = ['freed-shield','lending-low-cost','payments-pickup-upi','send-bank-transfer'];
export const REFERRAL_STATES = ['held','requested','forwarded','withdrawn','declined','closed'];

export function partnerIsActionable(partner={}) {
  return Boolean(
    partner &&
    PARTNER_IDS.includes(partner.partnerId) &&
    partner.contractId &&
    partner.connectorId &&
    Number.isSafeInteger(partner.consentVersion) && partner.consentVersion > 0 &&
    partner.operatorId &&
    partner.live === true &&
    partner.acceptsReferrals === true
  );
}

export function memberPartnerView(partner) {
  const actionable = partnerIsActionable(partner);
  return {
    partnerId: partner.partnerId,
    kind: partner.kind,
    name: partner.name,
    provider: partner.provider || '',
    live: actionable,
    acceptsReferrals: actionable,
    consentVersion: actionable ? partner.consentVersion : null,
    consentScope: Array.isArray(partner.consentScope) ? partner.consentScope.filter(k=>k!=='nia_health_score') : [],
    requiresKyc: Boolean(partner.requiresKyc),
    actionable,
    state: actionable ? 'live' : (partner.partnerId ? 'informational' : 'hidden')
  };
}

export function launchPartnersOrOmit(partners) {
  const required = ['lending-low-cost','freed-shield'];
  const views = (partners||[]).filter(p=>PARTNER_IDS.includes(p.partnerId)).map(memberPartnerView);
  const blocked = required.filter(id => {
    const row = views.find(v=>v.partnerId===id);
    return !row || !row.actionable;
  });
  return {
    partners: views.filter(v => !required.includes(v.partnerId) || v.actionable),
    omitted: blocked
  };
}

export function referralPublic(row) {
  return {
    referralId: row.referralId,
    partnerId: row.partnerId,
    status: REFERRAL_STATES.includes(row.status) ? row.status : 'held',
    referred: row.referred === true,
    partnerAcknowledged: row.partnerAcknowledged === true,
    consentVersion: row.consentVersion,
    fields: row.fields || [],
    withdrawable: ['held','requested','forwarded'].includes(row.status),
    cannotRecall: row.referred === true
      ? 'The partner already received the selected records. Withdrawal stops further sharing; it cannot unsend what was delivered.'
      : 'Withdrawal stops this request. Nothing has been delivered to the partner yet.'
  };
}
