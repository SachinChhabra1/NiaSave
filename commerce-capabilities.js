// M0: reopening requires the M3 proofs and a reviewed release, not an env toggle.
export const COMMITMENTS_FROZEN = true;
export const PILOT_CLOSED_COPY = 'Browsing is open. Reservations, stays and applications are paused while Nia prepares the pilot. Contact your Nia team for help with an existing request.';

// Owner (staff) storefront is off in the member production build unless the
// launch gate is explicitly enabled. Not a member session.
function flagOn(name) {
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name] === '1') return true;
  } catch {}
  try {
    if (typeof globalThis !== 'undefined' && globalThis['__' + name] === true) return true;
  } catch {}
  return false;
}
export const OWNER_VIEW_ENABLED = flagOn('NIASAVE_OWNER_VIEW');
