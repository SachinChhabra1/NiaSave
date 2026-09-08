# Hosted NiaSave test backend

Built 8 September 2026 for internal testing and investor walkthroughs. This is not member launch.

## Deployment

- Live showcase: https://www.niasave.com (niasave.com redirects here).
- Main Vercel project: `niasave`; deployment `dpl_5HYBtZrZ1fdzk2N3wSXK5EcSSim9`.
- Access is the existing HTTP Basic invitation, username `showcase`. No Vercel team login is required on this domain. Credentials remain outside Git.
- Dedicated Neon test database: `niasave-showcase-db`, Singapore. The isolated showcase function also runs in Singapore. Existing operations database and environment settings were not replaced.
- Legacy operations were preserved from production revision `40482eaf9a72b9ec9b0ac225a2f46ecaea8fe7ed`; 39 existing API/runtime/operations files were verified unchanged.
- The separate `niasave-showcase` Preview remains available with Vercel team protection; it is not the primary invitation link.
- Hosting in Vercel Production is explicitly allowed only for the configured showcase project ID. This is still a test deployment, not member launch.

## What runs online

The isolated `showcase/handler.mjs` exposes the existing `/api/commerce/*` member API and `/api/central/commerce` signed operator gateway. It does not expose the legacy member or staff APIs. Requests cannot choose an admin role. Staff mutations and phone recovery are blocked for showcase visitors; operations require a signed Central envelope. Cookies are secure and HTTP-only; writes require the same HTTPS origin.

Orders, inventory reservations, Nest bookings, job applications, dated personal entries, consent and sessions use the existing Postgres compare-and-swap state runner. Dedicated instance-prefixed state keys add isolation inside the separate test database. Storage failures cannot acknowledge successful writes. No memory fallback is accepted by the hosted entry.

One shared fictional member is used by all invited testers. Changes are visible to other testers. This is intentional for the walkthrough, not personal account isolation. Do not enter real phone numbers, KYC, bank records or private member data.

The initial Earn and statement fixtures are copied from Central's synthetic demo generators. The first successful authenticated visit bootstraps once; subsequent visits and deployments preserve edits and operator status changes. Four jobs, three prior statement months, Nest offers and Save products are available. Tests also created a fictional collected/reconciled Save order, a Nest booking, a contacted job application and a ₹120 dated travel entry.

Payments, bank transfers, insurance and lending integrations are inactive. A test receipt is an operator record of fictional money, not a real UPI transaction. “My plan this month” remains a calculator held only while the page is open; saving account plans is not implemented by this backend work.

## Central handoff for Claude

The signed gateway is deployed and verified against the same durable records. The hosted Central operator UI has NOT yet been pointed at this showcase; do not describe the two hosted sites as fully integrated yet.

Connect a separately authenticated Central test environment using:

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

Do not replace this release with a normal main-branch deployment until the domain assembly and isolated routing have been incorporated. Claude's plan adapter must merge the latest pilot branch, including these domain changes, rather than assuming 6342d0f is still the latest base. The adapter reported in Claude's update has not been incorporated into this deployment.

Rollback target (the previous operations release): `https://niasave-90b6q8ucb-sachinchhabra37-8426s-projects.vercel.app`. Promote that deployment to restore the prior domain content.

## Verification evidence

- 53 commerce tests pass, including showcase configuration/auth checks; production build passes.
- Real test Postgres: order retry creates one order, signed Central updates the same record, Nest and job application are visible through the gateway, dated expense and consent persist.
- A fresh process reused the session and found the same order, booking, application status and dated entry.
- Fictional Central handover/reconciliation creates exactly one automatic NiaBooks Save expense.
- Hosted browser: all four tabs × five languages × desktop/mobile (40 combinations), no JS errors, missing assets or horizontal overflow. Planner, purpose dropdown and session reload checked.
- Custom-domain page and member API return 401 with the Basic challenge when the invitation is missing. Authenticated domain checks passed for all four tabs, saved orders and session reload; the existing operations page remains available. The bare domain redirects to www.
- Native-speaker review, real-device/network testing, production KYC/passkeys, durable monthly plans and production Central source integration remain outside this showcase verification.

The standard build also now copies `commerce-plan.js` and nested locale update modules, which were missing from the earlier deployment packaging.
