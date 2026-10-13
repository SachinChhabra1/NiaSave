export const SUPPORT_KINDS = {
  missing_item: {unit:'pickup_operator', pillar:'save', related:'order'},
  quality: {unit:'pickup_operator', pillar:'save', related:'order'},
  late: {unit:'pickup_operator', pillar:'save', related:'order'},
  return_refund: {unit:'pickup_operator', pillar:'save', related:'order'},
  other: {unit:'pickup_operator', pillar:'save', related:'order'},
  move_in: {unit:'nest_operator', pillar:'live', related:'nest'},
  nest_details: {unit:'nest_operator', pillar:'live', related:'nest'},
  job_details: {unit:'walk2work_coordinator', pillar:'earn', related:'job'},
  application_update: {unit:'walk2work_coordinator', pillar:'earn', related:'job'},
  identity_access: {unit:'identity_owner', pillar:'identity', related:null}
};

export const SUPPORT_KIND_IDS = Object.keys(SUPPORT_KINDS);

export function supportRoute(kind) {
  return SUPPORT_KINDS[kind] || null;
}

export function publicSupportIssue(issue) {
  return {
    id: issue.id,
    reference: issue.reference || issue.id,
    kind: issue.kind,
    status: issue.status,
    note: issue.note || '',
    relatedType: issue.relatedType || null,
    relatedRef: issue.relatedRef || issue.orderId || null,
    unit: issue.unit,
    pillar: issue.pillar,
    refundApproved: issue.refundApproved === true,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt || issue.createdAt
  };
}

export function openSupportIssue({actor, body, order, time, id}) {
  const kind = String(body?.kind || '');
  const route = supportRoute(kind);
  if (!route) return {error:'issue_kind_required', status:400};
  if (route.related === 'order' && !order) return {error:'order_and_issue_required', status:400};
  const relatedRef = route.related === 'order'
    ? order.id
    : (typeof body.relatedRef === 'string' && body.relatedRef.trim() && body.relatedRef.length <= 120
      ? body.relatedRef.trim()
      : null);
  const issue = {
    id,
    reference: id,
    memberId: actor.id,
    orderId: route.related === 'order' ? order.id : null,
    kind,
    note: String(body.note || '').slice(0, 500),
    status: 'open',
    unit: route.unit,
    pillar: route.pillar,
    relatedType: route.related,
    relatedRef,
    refundApproved: false,
    createdAt: new Date(time).toISOString()
  };
  return {issue};
}
