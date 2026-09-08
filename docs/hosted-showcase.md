# Hosted NiaSave test backend

Built 8 September 2026 for internal testing and investor walkthroughs. This is not member launch.

## Deployment

- Dedicated Vercel project: `niasave-showcase` in `sachinchhabra37-8426s-projects`.
- Active Preview: https://niasave-showcase-edmhdvh4f-sachinchhabra37-8426s-projects.vercel.app/commerce.html
- Dedicated Neon Free database: `niasave-showcase-db`, Singapore. Connected only to this project's Preview environment, with `SHOWCASE_` variable prefix. No production database was copied or connected.
- Vercel team sign-in remains enabled. A second, application-level HTTP Basic invitation uses username `showcase` and a generated password stored privately in Vercel. Never put credentials or the Central signing key in this repository.
- The initial deployment on this new project's default alias intentionally returns 503: production environments cannot activate showcase mode. Use the Preview URL above.

## What runs online

The isolated `showcase/handler.mjs` exposes the existing `/api/commerce/*` member API and `/api/central/commerce` signed operator gateway. It does not expose the legacy member or staff APIs. Requests cannot choose an admin role. Staff mutations and phone recovery are blocked for showcase visitors; operations require a signed Central envelope. Cookies are secure and HTTP-only; writes require the same HTTPS origin.

Orders, inventory reservations, Nest bookings, job applications, dated personal entries, consent and sessions use the existing Postgres compare-and-swap state runner. Dedicated instance-prefixed state keys add isolation inside the separate test database. Storage failures cannot acknowledge successful writes. No memory fallback is accepted by the hosted entry.

One shared fictional member is used by all invited testers. Changes are visible to other testers. This is intentional for the walkthrough, not personal account isolation. Do not enter real phone numbers, KYC, bank records or private member data.

The initial Earn and statement fixtures are copied from Central's synthetic demo generators. The first successful authenticated visit bootstraps once; subsequent visits and deployments preserve edits and operator status changes. Four jobs, three prior statement months, Nest offers and Save products are available. Tests also created a fictional collected/reconciled Save order, a Nest booking, a contacted job application and a ₹120 dated travel entry.

Payments, bank transfers, insurance and lending integrations are inactive. A test receipt is an operator record of fictional money, not a real UPI transaction. “My plan this month” remains a calculator held only while the page is open; saving account plans is not implemented by this backend work.

## Central handoff for Claude

The signed gateway is deployed and verified against the same durable records. The hosted Central operator UI has NOT yet been pointed at this showcase; do not describe the two hosted sites as fully integrated yet.

Connect a separately authenticated Central test environment using:

- `TWO_PARA_NIASAVE_ORIGIN`: the Preview origin above.
- `NIASAVE_STOREFRONT_ORIGIN`: the same origin.
- `CENTRAL_COMMERCE_KEY`: the private value of `SHOWCASE_CENTRAL_KEY`, copied server-to-server through environment configuration, never through a document or client bundle.
- A deliberate hosted TEST mode in Central. Its existing `CENTRAL_COMMERCE_PREVIEW` remains local-only, and must not be widened into an auth bypass. Keep real operator login/roles and use only fictional source records.
- Vercel's additional deployment protection still applies to the gateway. A server-to-server test connection needs authorized deployment-protection access as well as the Central signature. Do not remove SSO or distribute bypass credentials without owner approval.

The gateway verifies the exact body signature, actor role, timestamp and one-use nonce, and checks operator ownership and state transitions. The page's Basic invitation is not a substitute for a Central signature. Gateway requests do not need the page's Basic credentials.

Demo data retains expiry/freshness rules: statement health becomes unavailable after the fixture refresh is stale; jobs close after their fixture expiry and pickup windows expire. Refresh fixtures explicitly through the signed admin gateway (`send/books-demo`, `earn/demo`); seedDemo preserves closed jobs. Do not rewrite timestamps to imply a real operational sync. A fresh `SHOWCASE_INSTANCE` creates a separate demonstration dataset; old state remains intact. Do not reset the active instance while a walkthrough is in progress.

## Rebuild

From the member commerce pilot branch:

```sh
npm run test:commerce
npm run build:production
node scripts/build-showcase.mjs ../niasave-showcase
cd ../niasave-showcase
npx vercel link --project niasave-showcase --scope sachinchhabra37-8426s-projects
npx vercel deploy --target=preview
```

The assembler copies the member front end, all five language files and their updates, planner, images, shared domain logic, and isolated API into a separate deployment directory. It never packages the broad legacy API entry. Environment/QA files are excluded. No cron jobs or live source syncs are deployed.

Required server settings: `NIA_SHOWCASE=1`, a `SHOWCASE_INSTANCE` matching `showcase-[a-z0-9-]{8,64}`, dedicated `SHOWCASE_DATABASE_URL`, `SHOWCASE_PASSWORD` of at least 24 characters, and `SHOWCASE_CENTRAL_KEY` of at least 32 characters. `NIA_SHOWCASE_ENTRY` is set internally by the isolated handler. Settings are Preview only.

## Verification evidence

- 53 commerce tests pass, including showcase configuration/auth checks; production build passes.
- Real test Postgres: order retry creates one order, signed Central updates the same record, Nest and job application are visible through the gateway, dated expense and consent persist.
- A fresh process reused the session and found the same order, booking, application status and dated entry.
- Fictional Central handover/reconciliation creates exactly one automatic NiaBooks Save expense.
- Hosted browser: all four tabs × five languages × desktop/mobile (40 combinations), no JS errors, missing assets or horizontal overflow. Planner, purpose dropdown and session reload checked.
- Hosted page returns 401 with the Basic challenge when its invitation is missing. Vercel team access remains enabled.
- Native-speaker review, real-device/network testing, production KYC/passkeys, durable monthly plans and production Central source integration remain outside this showcase verification.

The standard build also now copies `commerce-plan.js` and nested locale update modules, which were missing from the earlier deployment packaging.
