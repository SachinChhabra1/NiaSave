export const MEMBER_STATES = ['enrol','wait_for_review','contact_jat_unit','recovery_pending','ready'];

const NEXT = {
  enrol: 'Show your identity documents to your Nia team in person. Do not upload them here. Catalogue browsing is open; reserve, hold and apply stay off until membership is approved.',
  wait_for_review: 'Your enrolment is with the Nia team. They will review identity in person. Catalogue only until the status becomes ready.',
  contact_jat_unit: 'Contact your Jat unit before any reservation, stay or application. Catalogue browsing stays open.',
  recovery_pending: 'A phone or access recovery is with the Nia team. Catalogue only until recovery is complete.',
  ready: 'Membership is approved. Reserve, hold and apply follow Central.'
};

export function membershipSurface(state) {
  const next = MEMBER_STATES.includes(state?.next) ? state.next : (state?.ready ? 'ready' : 'enrol');
  const ready = next === 'ready';
  return {
    next,
    ready,
    catalogueOnly: !ready,
    canReserve: ready,
    canHold: ready,
    canApply: ready,
    access: ready ? 'full' : 'member_access_required',
    label: ({
      enrol: 'Join Nia',
      wait_for_review: 'Awaiting identity review',
      contact_jat_unit: 'Contact your Nia team',
      recovery_pending: 'Phone change awaiting review',
      ready: 'Membership approved'
    })[next],
    nextStep: NEXT[next],
    audit: state?.audit && typeof state.audit === 'object' ? {
      reviewer: state.audit.reviewer || null,
      at: state.audit.at || null,
      evidenceReference: state.audit.evidenceReference || null
    } : null
  };
}

export function enrolmentPayload(body, verifiedPhone) {
  return {
    fullName: String(body?.fullName || '').trim(),
    preferredLanguage: body?.preferredLanguage,
    consent: body?.consent === true,
    phone: verifiedPhone,
    documentsUploaded: false
  };
}
