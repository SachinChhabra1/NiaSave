// Copied from Central's synthetic presentation generator for the isolated showcase.
// This module is never a source of real jobs.
export function memberCommerceDemo(now = Date.now()) {
  const asOf = new Date(now).toISOString();
  const closesAt = new Date(now + 14 * 86400000).toISOString();
  const roles = [
    { id: 'DEMO-W2W-001', company: 'Demo · HSR neighbourhood store', title: 'Store assistant', lat: 12.9141, lng: 77.6448, demand: 6, payMin: 15000, payMax: 17000, shift: 'Day shift · 9 am–6 pm · weekly day off' },
    { id: 'DEMO-W2W-002', company: 'Demo · HSR community kitchen', title: 'Kitchen assistant', lat: 12.9188, lng: 77.6503, demand: 4, payMin: 16000, payMax: 18500, shift: 'Morning shift · 6 am–3 pm · meal included' },
    { id: 'DEMO-W2W-003', company: 'Demo · Silk Board fulfilment centre', title: 'Picker & packer', lat: 12.9208, lng: 77.6305, demand: 12, payMin: 18000, payMax: 21000, shift: 'Day shift · 8 am–5 pm · weekly day off' },
    { id: 'DEMO-W2W-004', company: 'Demo · Koramangala service team', title: 'Housekeeping associate', lat: 12.9352, lng: 77.6245, demand: 8, payMin: 17000, payMax: 19500, shift: 'Day shift · 7 am–4 pm · weekly day off' },
  ];
  return {
    memberId: 'preview-member',
    studio: { id: 'demo-hsr-residence', name: 'Demo · HSR Nest', lat: 12.9116, lng: 77.6474, verified: true },
    jobs: roles.map(r => ({
      source: { id: r.id, company: r.company, city: 'Bengaluru', demand: r.demand, preview: true, pulledAt: asOf, updatedAt: asOf, mandateStatus: 'open', openPositions: r.demand, workplace: { lat: r.lat, lng: r.lng, verified: true } },
      title: r.title, payMin: r.payMin, payMax: r.payMax, payPeriod: 'month', shift: r.shift,
      requirements: 'Demo eligibility: speak with the Walk2Work team about your skills and preferred shift.',
      terms: 'DEMO ONLY · Fictional employer, workplace and vacancy for presentation. No real job offer or application is sent.',
      closesAt, confirmed: true,
    })),
  };
}
