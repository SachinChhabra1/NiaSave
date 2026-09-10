# Hosted NiaSave test backend

**10 September hardening update:** the historical no-bypass verification below predates Central preview protection being enabled. Follow [P0 connection recovery](hardening-p0-release.md) for the temporary server-only transport credential, paired rotation, repeatable acceptance, and eventual canonical-origin cutover. Hosted recovery is pending; do not interpret older acceptance results as verification of the current deployment.

Built 8 September 2026 for internal testing and investor walkthroughs. This is not member launch.

## Deployment

- Live showcase: https://www.niasave.com (niasave.com redirects here).
- Main Vercel project: `niasave`; deployment `dpl_14U777h6gNwsW7RPvKeCYbjWiVtU`.
- Access is the existing HTTP Basic invitation, username `showcase`. No Vercel team login is required on this domain. Credentials remain outside Git.
- Dedicated Neon test database: `niasave-showcase-db`, Singapore. The isolated showcase function also runs in Singapore. Existing operations database and environment settings were not replaced.
- Legacy operations were preserved from production revision `40482eaf9a72b9ec9b0ac225a2f46ecaea8fe7ed`; 39 existing API/runtime/operations files were verified unchanged.
- The separate `niasave-showcase` Preview remains available with Vercel team protection; it is not the primary invitation link.
- Hosting in Vercel Production is explicitly allowed only for the configured showcase project ID. This is still a test deployment, not member launch.

## What runs online

The isolated `showcase/handler.mjs` exposes the existing `/api/commerce/*` member API and `/api/central/commerce` signed operator gateway. It does not expose the legacy member or staff APIs. Requests cannot choose an admin role. Staff mutations and phone recovery are blocked for showcase visitors; operations require a signed Central envelope. Cookies are secure and HTTP-only; writes require the same HTTPS origin.

Orders, inventory reservations, Nest bookings, job applications, dated personal entries, consent and sessions use the existing Postgres compare-and-swap state runner. Dedicated instance-prefixed state keys add isolation inside the separate test database. Storage failures cannot acknowledge successful writes. No memory fallback is accepted by the hosted entry.

One shared fictional member is used by all invited testers. Changes are visible to other testers. This is intentional for the walkthrough, not personal account isolation. Do not enter real phone numbers, KYC, bank records or private member data.

The initial Earn and statement fixtures are copied from Central's synthetic demo generators. The first successful authenticated visit bootstraps once; subsequent visits and deployments preserve edits and operator status changes. Four jobs, three prior statement months, Nest offers and Save products are available. Tests also created a fictional collected/reconciled Save order, a Nest booking, a job application now at interview status and a ₹120 dated travel entry.

Payments, bank transfers, insurance and lending integrations are inactive. A test receipt is an operator record of fictional money, not a real UPI transaction. “My plan this month” reads and saves through the signed Central member service. Central owns the durable monthly plan, revision and active/KYC-approved access check. Conflicting edits return 409; reload preserves typed values so the member can review and save again.

## Central handoff for Claude

The Central test operator UI is connected to this showcase’s durable operations book. Verified through the authenticated Central UI: the same Save order, Nest booking and job application are visible; moving the application to interview is reflected in NiaSave on the same reference. The monthly plan uses the opposite direction: NiaSave calls Central’s signed member endpoint and Central stores the plan. These verified showcase flows do not establish production member readiness.

The separately authenticated Central test environment is configured using:

- `TWO_PARA_NIASAVE_ORIGIN`: `https://www.niasave.com`.
- `NIASAVE_STOREFRONT_ORIGIN`: the same origin.
- `CENTRAL_COMMERCE_KEY`: the private value of `SHOWCASE_CENTRAL_KEY`, copied server-to-server through environment configuration, never through a document or client bundle.
- A deliberate hosted TEST mode in Central. Its existing `CENTRAL_COMMERCE_PREVIEW` remains local-only, and must not be widened into an auth bypass. Keep real operator login/roles and use only fictional source records.
- The custom-domain gateway requires the Central signature, without Vercel SSO or page Basic credentials. Do not use a deployment-protection bypass for this connection.

The gateway verifies the exact body signature, actor role, timestamp and one-use nonce, and checks operator ownership and state transitions. The page's Basic invitation is not a substitute for a Central signature. Gateway requests do not need the page's Basic credentials.

Demo data retains expiry/freshness rules: statement health becomes unavailable after the fixture refresh is stale; jobs close after their fixture expiry and pickup windows expire. Refresh fixtures explicitly through the signed admin gateway (`send/books-demo`, `earn/demo`); seedDemo preserves closed jobs. Do not rewrite timestamps to imply a real operational sync. A fresh `SHOWCASE_INSTANCE` creates a separate demonstration dataset; old state remains intact. Do not reset the active instance while a walkthrough is in progress.

## Rebuild the domain release

From the member commerce pilot branch:

```sh
npm run test:commerce
npm run build:production
node scripts/build-domain-showcase.mjs 40482eaf9a72b9ec9b0ac225a2f46ecaea8fe7ed ../niasave-domain
cd ../niasave-domain
npx vercel deploy --prod --skip-domain
# Verify the resulting deployment before promoting its returned URL.
npx vercel promote <verified-deployment-url> --yes
```

The assembler overlays the storefront on the explicit existing production revision. It puts test logic in `showcase-runtime/` and a separate `api/showcase.mjs` function, retaining legacy operations and cron routes. The isolated handler uses module-local configuration, without changing legacy DUMMY_DATA, database selection or signing keys. Environment and QA files are excluded from deployment uploads.

Server settings: `NIA_SHOWCASE=1`, a `SHOWCASE_INSTANCE` matching `showcase-[a-z0-9-]{8,64}`, dedicated `SHOWCASE_DATABASE_URL`, `SHOWCASE_PASSWORD` of at least 24 characters, and `SHOWCASE_CENTRAL_KEY` of at least 32 characters. Custom-domain production additionally requires `SHOWCASE_ALLOW_CUSTOM_DOMAIN=1` and `SHOWCASE_PROJECT_ID` equal to Vercel's system `VERCEL_PROJECT_ID`. These settings do not activate showcase mode in the legacy operations runtime.

Do not replace this release with a normal main-branch deployment until the domain assembly and isolated routing have been incorporated. Claude's plan adapter must merge the latest pilot branch, including these domain changes, rather than assuming 6342d0f is still the latest base. PR #20 is merged (b9bf13e), with the domain packaging guard in 0fe88de. The deployed artifact contains both. Keep using the assembler for future releases; a normal Git preview does not reproduce the protected domain assembly.

Rollback target (the previous operations release): `https://niasave-90b6q8ucb-sachinchhabra37-8426s-projects.vercel.app`. Promote that deployment to restore the prior domain content.

## Verification evidence

- 62 commerce tests pass, including showcase configuration/auth checks; production build passes.
- Real test Postgres: order retry creates one order, signed Central updates the same record, Nest and job application are visible through the gateway, dated expense and consent persist.
- A fresh process reused the session and found the same order, booking, application status and dated entry.
- Fictional Central handover/reconciliation creates exactly one automatic NiaBooks Save expense.
- Hosted browser: all four tabs × five languages × desktop/mobile (40 combinations), no JS errors, missing assets or horizontal overflow. Planner, purpose dropdown and session reload checked.
- Custom-domain page and member API return 401 with the Basic challenge when the invitation is missing. Authenticated domain checks passed for all four tabs, saved orders and session reload; the existing operations page remains available. The bare domain redirects to www.
- Hosted monthly plan: initial save, simultaneous conflicting edit, reload with typed values retained, second save, full browser reload, and independent signed Central read all passed. Central revision advanced from 0 to 2; saved fictional income is ₹22,000 and send-home target ₹8,000. Mobile 390px and desktop 1440px passed.
- Native-speaker review, real-device/network testing, production KYC/passkeys and production Central source integration remain outside this showcase verification.

The standard build also now copies `commerce-plan.js` and nested locale update modules, which were missing from the earlier deployment packaging.

## Central-owned plan connection (verified 8 September 2026)

- Central origin: `https://rafiqi-central-git-test-showcase-sachinchhabra37-8426s-projects.vercel.app`.
- NiaSave `CENTRAL_ORIGIN` points to that isolated test environment. Central `CENTRAL_COMMERCE_KEY` is scoped to Preview / `test/showcase`, matching NiaSave `SHOWCASE_CENTRAL_KEY`. Secrets remain outside Git and handoff documents.
- Access mapping: `preview-member` → `showcase-member-001`, active, KYC approved, revision 1; created by an authenticated Central admin. This is fictional test approval only.
- A cookie-free unsigned service request returns Central's 401 `service_auth_required`; a signed plan read returns 200 with `canSave: true`. No Vercel bypass credential exists or is needed.
- `EARN_SOURCE=central` is enabled for the hosted showcase. Both the job list and all new application writes now use Central's signed service (`earn.projection`, `earn.applications`, `earn.apply`). Existing legacy applications remain visible as history; new applications are stored only in Central.
- Central source is `test/showcase` at `83054aa`, synchronized with main `3fd6856` after PR #16 merged. Migration 0008 owns applications, exact retry acknowledgements and audit records. Active/KYC access is rechecked; mandate closure/revision changes are checked atomically while writing.
- The current member residence is an explicit operator record in Central. Its authoritative database read time is the map snapshot time. Roster-derived residences still use the real upstream board timestamp and fail stale after seven minutes (five-minute refresh cadence plus two-minute grace).
- Four showcase vacancies were created and opened through authenticated Central forms. Tests confirmed NiaSave reads those exact mandate IDs; a browser application is visible in Central and an operator status update appears after NiaSave reload. Pausing a mandate removes it from Earn and rejects a stale application with 409. All four vacancies were reopened for the walkthrough.
- Walk2Work's member operations entry opens the Central mandate/application desk. PR #16 is deployed on Central production; its service key remains unconfigured there. The hosted showcase continues to use the isolated test environment.
- Previous protected showcase rollback: `https://niasave-f1hcnzctj-sachinchhabra37-8426s-projects.vercel.app`. It preserves the invitation gate but predates the Central planner adapter.

## Para 2 naming refresh

See [para2-naming.md](para2-naming.md). The assembler now updates archived operations labels and replaces their obsolete name lock; routes, API identifiers, persisted state and auth stay compatible. Future releases must keep this step, otherwise the old Bison/Polo/Tanot/Madras labels will return.

## Runtime transfer fix (9 September 2026)

NiaSave PR #21 adds version-first cache reads and version-only Jat/Sikh health probes; Jat desk polling is once per minute. The domain assembler applies the same reviewed cache algorithm to the archived operations function via `scripts/overlay-runtime-cache.mjs`, preserving its `DATABASE_URL` and unprefixed state keys. The isolated showcase keeps its own database selector and prefixed keys. Both cache variants pass the fake-SQL retry, invalidation, clone and conflict test.

The test's 480 bytes for 60 version reads is modeled payload size, not measured total HTTP/Postgres transfer. Cold instances and actual writes still transfer the document. This deployment reduces repeated downloads; it cannot lift an existing Neon quota suspension. Verify actual transfer after service is restored.
