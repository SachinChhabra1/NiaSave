# Production member storefront cutover

Prepared 9 September 2026. Sachin selected production Central records and passkey sign-in, with general member rollout still closed. Automatic approval review requires an additional explicit approval for the configuration bundle below before applying it.

## Result

www.niasave.com will open the real member sign-in screen behind the existing invitation password. It will use rafiqicentral.com for enrolment, passkeys, recovery, Earn, partner status and monthly plans. The shared fictional preview-member login will no longer work on this domain. UAT passkeys will remain scoped to their test hostname and will not become production credentials.

Central already runs the reviewed member-access code and its migrations. Its production email service remains unchanged. Production currently has zero member enrolments, approved access records, passkeys and fulfilment mappings. Staff must create and verify enrolment before the first member can sign in; no approval records will be fabricated by this release.

## Data preservation

NiaSave's existing production database is retained. The Jat book at the legacy operation-bison key contains 4,093 members and 82 studios (version 63 at preflight) and remains the Living source. The existing operation-polo book is marked dummy=true and contains 200 orders (version 6); it remains untouched. NIA_RUNTIME_STATE_KEY will select operation-polo-production as the single active production Save book for both member and operator routes. It starts without stock or orders and requires Sikh verification/publication. No demo records are converted into real transactions or removed.

The pre-cutover showcase deployment remains available at https://niasave-j7o0gwm7u-sachinchhabra37-8426s-projects.vercel.app with its existing isolated test database and invitation. The passkey UAT projects remain separate.

## Configuration requiring approval

Production scope only, on the existing rafiqi-central and niasave Vercel projects. Database URLs, Central staff auth secrets, email delivery keys, cron secrets and Preview settings are not changed.

Central:
- CENTRAL_COMMERCE_KEY: generate a new server-only shared signing key.
- MEMBER_PASSKEYS_ENABLED=1.
- MEMBER_PASSKEY_ORIGIN=https://www.niasave.com.
- VITE_AUTH_ENABLED=true.
- NIASAVE_STOREFRONT_ORIGIN and TWO_PARA_NIASAVE_ORIGIN=https://www.niasave.com.

NiaSave:
- CENTRAL_COMMERCE_KEY: the same new server-only key.
- CENTRAL_ORIGIN=https://rafiqicentral.com; EARN_SOURCE=central.
- COMMERCE_STOREFRONT=1; COMMERCE_ENABLED=1; COMMERCE_MEMBER_AUTH=passkey; COMMERCE_BOOKS_ENABLED=1.
- DUMMY_DATA=0; DEMO=0; NIA_SHOWCASE=0.
- STAFF_AUTH_REQUIRED=1; generate and store new strong STAFF_TOKEN_SECRET and STAFF_PASSWORD for the legacy operator gate. Generate a separate JAT_STAFF_PASSWORD for the named Living operator, so his password cannot sign in as any legacy administrator. Central's signed operator path remains the primary control surface.
- NIA_RUNTIME_STATE_KEY=operation-polo-production.
- MEMBER_INVITE_GATE=1; MEMBER_INVITE_PASSWORD reuses the current invitation password; MEMBER_SITE_ORIGIN=https://www.niasave.com.

## Jat operator handover

Sachin named ajay.mahawar@nia.one as the Jat data-entry owner. The release grants this named operator Living access, without Sikh or Dogra desk permissions, and adds an email/password prompt on protected legacy desks. Desk data requests wait for sign-in; an expired session requires sign-in again without automatically replaying a write. Central's staff sign-in remains unchanged.

Deliver only the new JAT_STAFF_PASSWORD privately to Sachin for handover to Ajay; retain the separate legacy administrator STAFF_PASSWORD with Sachin. Do not email or message credentials without Sachin's explicit instruction. The invitation password does not replace this operator password. Ajay's entry point is https://www.niasave.com/bison-data.html (legacy technical path retained). Ajay signs in with his Nia email and the new operator password.

Preflight passed: named-operator login, denied unauthenticated writes, denied other-unit access, and a dated booking entered in the browser, saved to an isolated UAT database book, then read after a full API restart and browser reload. The named-operator audit persisted too. Desktop and phone sign-in were checked with no browser runtime errors. The temporary test book was removed after verification. This is preflight evidence, not proof of a production save.

After cutover, confirm Ajay's login and Living reads. For the production write check, have Ajay submit one legitimate scheduled data correction through the desk; record its audit reference, persisted book version and successful reload. Do not create a fictitious member, booking, charge or payment in the real Jat book for testing. The production write check remains pending until that legitimate update occurs; a GET, dry run or local test does not satisfy it.

Keep the invitation gate on. Rotate its reused showcase password before member pilot invitations are distributed.

## Release and verification

After approval: apply this configuration, redeploy Central, stage the complete NiaSave release, check production challenges and unauthenticated boundaries, merge the reviewed member work into NiaSave main, and verify the live domain. Registration on a real phone still needs its owner and a staff-issued setup code; no synthetic member will be inserted into production for a smoke test.

Preflight checks passed: 79 commerce tests, the Sikh self-test, 18 Living/auth/cache tests, six Dogra tests and production build. Isolated UAT previously passed nine hosted WebAuthn checks. The added invitation tests cover direct API aliases, incomplete settings, canonical origin routing, and the signed Central gateway.

Rollback is the previous immutable deployment with its captured environment; do not mix its demo runtime with the new production member configuration. Keep the new production Save book and any subsequently created records intact during rollback. No online payments, bank remittances or unavailable partner adapters are enabled by this switch.
