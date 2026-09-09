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
- STAFF_AUTH_REQUIRED=1; generate and store new strong STAFF_TOKEN_SECRET and STAFF_PASSWORD for the legacy operator gate. Central's signed operator path remains the primary control surface.
- NIA_RUNTIME_STATE_KEY=operation-polo-production.
- MEMBER_INVITE_GATE=1; MEMBER_INVITE_PASSWORD reuses the current invitation password; MEMBER_SITE_ORIGIN=https://www.niasave.com.

## Release and verification

After approval: apply this configuration, redeploy Central, stage the complete NiaSave release, check production challenges and unauthenticated boundaries, merge the reviewed member work into NiaSave main, and verify the live domain. Registration on a real phone still needs its owner and a staff-issued setup code; no synthetic member will be inserted into production for a smoke test.

Preflight checks passed: 79 commerce tests, the Sikh self-test, 17 Living/auth/cache tests, six Dogra tests and production build. Isolated UAT previously passed nine hosted WebAuthn checks. The added invitation tests cover direct API aliases, incomplete settings, canonical origin routing, and the signed Central gateway.

Rollback is the previous immutable deployment with its captured environment; do not mix its demo runtime with the new production member configuration. Keep the new production Save book and any subsequently created records intact during rollback. No online payments, bank remittances or unavailable partner adapters are enabled by this switch.
