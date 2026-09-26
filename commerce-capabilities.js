// M0: reopening requires the M3 proofs and a reviewed release, not an env toggle.
export const COMMITMENTS_FROZEN = true;
export const PILOT_CLOSED_COPY = 'Browsing is open. Reservations, stays and applications are paused while Nia prepares the pilot. Contact your Nia team for help with an existing request.';

// Save is a separately reviewed release. This public boolean contains no config
// values; the browser receives it from the current, uncached catalogue response.
export function saveLaunchEnabled(env = {}) {
  return env.NIASAVE_SAVE_ENABLED === '1' && env.COMMERCE_ENABLED === '1'
    && env.DUMMY_DATA === '0' && env.COMMERCE_PREVIEW !== '1'
    && env.NIA_SHOWCASE !== '1'
    && /^postgres(?:ql)?:\/\//.test(env.DATABASE_URL || '')
    && /^https:\/\//.test(env.CENTRAL_ORIGIN || '')
    && (env.CENTRAL_COMMERCE_KEY || '').length >= 32;
}
export const SAVE_PAUSED_COPY = 'Reservations are paused. You can browse essentials and ask your Nia team for help with an existing order.';
export const OTHER_COMMITMENTS_PAUSED_COPY = 'Stays and applications are paused. Contact your Nia team for help with an existing request.';
