# Niasave commerce pilot build

Status: working local preview, not a production release. No live site or production database was changed.

## Member-facing revision · 8 September 2026

The storefront has one public shopping experience. Separate enterprise/investor links, login choices, catalogue banners and alternate layouts have been removed. Visitors see the same products, prices and bag as members; member verification is still required to reserve. Existing server-side permission checks remain in place.

The header uses the existing Nia logo asset. Purpose copy is adapted from https://www.nia.one/workers (“Helping workers keep more of what they earn”) and https://www.nia.one/ (“Make leaving home worth it”). No numeric savings claims were added. This supersedes the earlier requirement for a separate enterprise/investor entry point.

## Payment boundary

The storefront reserves goods. The member scans the merchant's physical UPI QR at pickup or delivery to the configured member location. Staff enter the amount and 12-digit bank reference after checking receipt in the receiving account. Collection requires that verification and the correct collection code. Finance records statement reconciliation separately. Manual refunds can be recorded after they happen; this application does not initiate a payment or refund. No online gateway, wallet, cash collection or WhatsApp activation is included.

## Existing system integration

The implementation extends NiaSave's existing `rabbit/engine.mjs` Save state, under the existing `operation-polo` runtime key (or its configured override). Orders, reservations, scans, payments and settlements remain in that one snapshot. Rafiqi Central currently launches `/ops.html` and reads `/api/tower`; this work adds the member-order view to that same operations route at `/ops.html?view=commerce`. No Central repository changes or second order database were introduced.

The old pickup endpoint is blocked from changing storefront orders: it used to mark collection as payment automatically. Legacy dispatch/biker batch mutation is blocked while commerce orders exist, so that it cannot bypass the new lifecycle. Use the member-order view for pilot fulfilment; extending the old batch tooling to the new lifecycle is still a follow-up integration task. Existing prototype member checkout/payment endpoints return 410 when live commerce is enabled.

## Run locally

Use an isolated checkout without `DATABASE_URL`. Install the existing dependencies with `npm ci`.

Terminal 1: `COMMERCE_PREVIEW=1 PORT=8787 npm run dev:api`

Terminal 2: `npm run dev -- --port 5173`

Member/viewer preview: `http://127.0.0.1:5173/commerce.html`

Sikh Unit preview: `http://127.0.0.1:5173/ops.html?view=commerce`

Preview access is explicitly labelled. It uses memory, loses its examples on server restart, and is rejected in production/Vercel or when a database is present. Example product pack sizes, pictures, prices and locations are not verified offers. Hindi and English copy is provided for review; the pilot's actual languages have not been selected.

## Live configuration and identity contract

Live access fails closed unless all of these are present: `COMMERCE_ENABLED=1`, `DUMMY_DATA=0`, `DATABASE_URL`, `STAFF_AUTH_REQUIRED=1`, a configured `STAFF_PASSWORD`, `STAFF_TOKEN_SECRET` of at least 32 characters, `COMMERCE_IDENTITY_URL` using HTTPS, and `COMMERCE_IDENTITY_KEY`. Never use demo state as live data. The stored Save snapshot must have `dummy: false`; simply changing the environment does not relabel existing seed data.

The identity adapter is a contract, not a connected OTP provider. Implement/connect it against the approved member and viewer identity system before launch:

- `POST {COMMERCE_IDENTITY_URL}/request` receives `{phone: "+91…"}` and returns an opaque `{challenge}`. It must send the real OTP, rate-limit requests, expire challenges and give the same public response regardless of roster membership.
- `POST …/verify` receives `{challenge, code}` and returns `{account: {id, name, role, locationIds}}` only after real verification. `id` is the stable existing member/viewer identifier, never a phone number. `role` must come from approved server-side access and be `member`, `enterprise` or `investor`; location IDs must be authorised assignments.
- Requests carry the configured server-only bearer key. The adapter needs proper authentication, challenge replay prevention and revocation handling. Existing identity/roster integration and real SMS delivery remain to be connected and tested.
- Browser sessions are opaque, hashed in canonical state, HttpOnly, SameSite=Strict, Secure in production, expire after 12 hours and are revoked by sign-out or completed phone recovery.
- Number recovery creates an auditable request. Staff must verify identity and update the approved provider under the same ID before marking it resolved. Resolution revokes old browser sessions; it does not itself change a phone in an unconnected provider.

An administrator publishes the verified pilot configuration from the existing operations view. It contains current Save beat, catalogue display metadata, permitted pickup/delivery locations, window start/end, expiry minutes and support instructions. `staffLocations` maps existing staff IDs to their permitted pilot stop IDs; non-admin staff without assignments see no orders. Existing staff desk permissions control receipt verification and finance-only reconciliation/refund records.

Prices come from existing Save SKUs, not browser input. Check and govern those real prices before launch. Merchant details, pack sizes, supplier/brand information, return policy and approved product images still require real inputs and integration into the published product detail view. Current non-preview product detail uses a clear missing-photo placeholder.

## Lifecycle and boundaries

Reservation -> packed -> loaded -> at stop -> collected. Reservation can be cancelled before packing. Unpacked expiry releases its hold; packed/dispatched expiry creates `return_pending`. Returned stock becomes available only after staff inspection. A paid return also requires a verified full refund and bank reconciliation. Partial fulfilment and partial refunds are not implemented; do not hand over or bill a partial bag. Handle those exceptions with support and a separately reviewed replacement order under the agreed pilot policy.

Stock and idempotency checks run inside the canonical mutation. Local requests are serialized, and Postgres compare-and-swap retries handle serverless conflicts. Storage failure never returns an order confirmation. Member retries retain the same request key and payload. Expiry runs before every commerce read/write; there is no dedicated scheduled expiry worker yet. A scheduled worker, grace/extension permissions and complete location-close integration remain to be finished before the operational launch gate is signed off.

## Release and rollback

`npm run build:production` preserves the current production member home by default. `COMMERCE_STOREFRONT=1 npm run build:production` publishes the new storefront as `dist/index.html`. The legacy member surface is copied to `/member-services.html`, with existing Live/Earn/Send behaviour preserved; member-facing navigation into those services still needs final product placement.

Keep the main-site switch off until the identity connection, clean canonical state, verified assortment, real operator assignments, merchant receipt process and launch checks are ready. Runtime `COMMERCE_ENABLED=0` stops new commerce API use. Reverting the homepage does not delete commerce orders: operations must still fulfil or resolve outstanding orders. Do not overwrite the order snapshot during rollback.

## Verification completed

- 21 commerce tests: server pricing, duplicate requests, concurrent last-unit competition, role and member isolation, origin checks, cancellation, expiry and physical return, independent UPI verification, refund/reconciliation records, recovery session revocation and production preview rejection.
- Injectable storage tests cover failed load/save, compare-and-swap conflict replay, exhausted retries and local concurrency/rollback. These do not replace a real Postgres integration run.
- Existing Save self-test and 16 Living/staff-auth tests pass.
- Production storefront build and naming checks pass. The pre-existing Dogra Unit image resolution warning remains; the production build separately copies that asset.
- Browser: member reservation, same-order operations fulfilment, unpaid handover rejection, simulated receipt verification and bank close, plus investor read-only access.
- Catalogue layout inspected at 320, 360, 390, 412, 768, 1024 and 1440 CSS pixels; no horizontal page overflow in those checks.

Outstanding validation: real Postgres/restart/multi-worker integration, actual identity/SMS and role provisioning, full Hindi copy and recovery-flow review, low-brightness physical Android checks, 200% text scaling and screen-reader pass, and the PRD's throttled-network performance/retry gate. Existing database integration tests skipped because no test database was provided. Live merchant receipt and bank reconciliation must be exercised by operators in the physical pilot.

## LESS revision · 8 September 2026

Primary navigation is now **Live, Earn, Save, Send — LESS · Less Spends**. The same four headers appear on desktop and phone. Bag, Orders & stays and Account are secondary controls. The member site opens on Live and retains the Nia logo and light Central theme.

| Header | Offering | Existing ownership / current connection |
| --- | --- | --- |
| Live | Nests | Jat Unit; writes the existing Jat Unit Living bookings and contracts |
| Earn | Work | Walk2Work; Central publishes verified demand as jobs, member applications share the operations record |
| Save | Essentials and insurance | Sikh Unit for essentials; medical and loss-of-pay insurance visible but purchase disabled pending insurer integration and policy terms |
| Send | Send money home | Payments-bank partner, not a separate module; method shown, transfers disabled until integration is complete |

Live uses the same `nia_commerce` member session and stable membership ID. Its new `/api/commerce/nests` routes authenticate against Save, then write only the canonical Living state under its existing runtime key. No nested cross-book transaction or duplicate goods order is created. Both books serialize local writers, retry Postgres version conflicts and fail closed on storage failures. Live mode no longer initializes seed Living bookings.

The preview implements move-in date selection, three illustrative studio offers, server-priced first-30-day review, full-stay physical-Nest and studio-capacity checks, idempotent reservation, pending canonical contract, own-stay status and unpaid cancellation. A hold expires at the earlier of its configured duration or the end of move-in day (India time). Recorded payments or posted charges prevent automatic expiry/cancellation and need team review. Existing Jat booking, contract and collection views use the same records. Initial booking does not post a charge, sign the agreement, collect money or check a member in; the team completes the existing collection/move-in process. Finance and agreement handling are not a new automated Nest checkout.

Live publication requires an authenticated admin `PUT /api/commerce/nests/config` with `verified: true` and `offers`. Each offer must identify `studioId`, actual unique `nestIds`, `name`, `address`, `rent` (first 30 days), `deposit`, `taxPct`, `holdHours` (1–168), `terms`, `details`, and `validUntil`. Seed state cannot be published. Expired offers disappear. The 30-day period and 30-day advance-booking window are provisional implementation choices that need pilot sign-off. Rates shown in preview are illustrative, not live offers or a tax determination. Live location photos are not supplied yet. Real member IDs must match the Living roster; there is no automatic historical identity merge by phone/name.

The Central revision below adds the Walk2Work job feed and application operations; production credentials and actual confirmed vacancies are still required. Insurance has no premium, insurer promise, enrolment or claims integration. Send collects no recipient/account details and cannot transfer funds. These are visible, explicitly inactive service states.

Validation for this revision: 28 commerce tests pass, including shared Nest identity/records, idempotency, concurrency for the last Nest, future overlaps, price-change review, expiry/payment protection, catalogue publication and ownership. The 16 Living/staff-auth regressions pass. Browser validation covered member sign-in → Nest review → reservation reference, all LESS sections, disabled insurance/Send actions, and responsive layouts. No real bank, insurer, Walk2Work, OTP provider or production database was exercised. The local preview remains a review build, not a production release.

Header refinement: the NiaSave wordmark and existing logo now render in neutral grey (#6e6e6e), retaining about 5.1:1 contrast against the white header. The source logo artwork is unchanged; the monochrome colour is applied through CSS.

## Footer and language revision

“Why Nia” now links to `https://www.nia.one/`. The footer and Account offer English, हिन्दी, தமிழ், ಕನ್ನಡ and मराठी, using native-script labels. Selection persists across reloads. Tamil, Kannada and Marathi have translations for all 231 literal interface phrases, plus product categories, preview product names and example location/terms content. Language files load on demand. Dates use the selected locale; amounts, IDs and canonical transaction data are unchanged. Supplied live addresses, names and terms retain their source value where no approved translation exists. The translation drafts still need native-speaker review before a live language launch.

Validation: locale coverage check passed for all three new dictionaries; the production build includes the language files. Browser checks confirmed the Nia.one target, five choices, Tamil and Kannada small-phone layouts, Marathi Nest browsing, persisted Kannada after refresh and an unchanged bag across language changes. No payment, identity or inventory logic changed.

## Save category revision

Save now has one labelled icon navigation: All essentials, Food & snacks, Ration & cooking, Cleaning, Personal care, Clothing, Footwear and Insurance. This replaces the separate Everyday essentials/Insurance tabs and the old Cooking/Home care filter row. A shared taxonomy maps old Cooking and Home care records to Ration & cooking and Cleaning, and is used by both the member interface and canonical product configuration. Insurance remains outside goods checkout. Food & snacks covers prepared food/snacks; Ration & cooking covers cooking staples and oils; Personal care retains toiletries.

All category labels and empty states are available in English, Hindi, Tamil, Kannada and Marathi. Categories with no approved products show an empty state, not fabricated goods, prices or stock. Clothing sizes and footwear variants still require governed SKU/stock data before real products are published. Icons supplement text, and selected categories expose their state accessibly. Browser checks verified the oil, cleaning and personal-care filters, empty Footwear, disabled insurance and 320px layout. All 29 commerce tests and the production build pass.


## Central connection revision · 8 September 2026

Implemented in the NiaSave and Rafiqi Central local branches. This is a connected preview, not a deployed production connection.

| Member tab | Central surface | Shared record and behavior |
|---|---|---|
| Live | Living → NiaSave member operations → Live; Jat Unit card | Existing Living bookings/contracts. Central publishes a verified Nest catalogue against exact source site IDs. Member booking/cancellation appears with the same booking and contract IDs. Admins and assigned operators can read reservations; move-in/finance remain in the Jat desk. |
| Earn | Walk2Work → NiaSave member operations → Earn | Central reads its `flow_demand` source. An operator confirms role, pay, shift, requirements and terms before publishing. Applications, consent, exact retry keys, frozen job details and member-visible status messages are stored once in the existing durable operations state. This is an application queue, not a wage ledger or a MAT placement assertion. |
| Save | Essentials → NiaSave member operations → Save; Sikh Unit card | Existing Save order book, stock holds, UPI receipt and settlement. Central publishes catalogue names from exact source site/SKU mappings; its aggregated stock totals never overwrite bookable stock. Assigned operators prepare orders; admins verify receipts/reconcile through the same validated transitions. |
| Send | NiaSave member operations → Send | Disabled payments-bank status only. No Send module, beneficiary capture, payment initiation or ledger added. |

Medical and loss-of-pay insurance remain inactive. WhatsApp and online checkout payments remain off. Members keep one account and the existing grey brand/light theme. Earn and order history refresh while visible; quotes/reservations still recheck the authoritative operations state.

### Connection contract

Central authenticates a verified `@nia.one` session and resolves its existing reader/operator/admin lists on the server. The new gateway does **not** inherit the old auth-off production setting. It signs a short-lived, exact-body envelope with `CENTRAL_COMMERCE_KEY` and calls NiaSave `POST /api/central/commerce`. NiaSave verifies signature, timestamp, nonce replay, production storage mode and staff scope. Keys and staff authority never reach the member browser. Failed writes do not report confirmation.

Central routes: `/member-commerce?line=live|earn|save|send` and same-origin `/api/member-commerce?line=...`. Nia member Earn routes: `/api/commerce/earn` and `/api/commerce/earn/applications`. Job/application writes use existing Save runtime serialization/CAS; no additional order ledger or second database copy is created in Central.

Central configuration includes `sourceSiteCode` on each Live offer, and `sourceSiteCode` + `sourceSku` on each Save product. These must join exactly one current Central row. The server supplies published names and source provenance; the operator supplies verified pack/address/terms. Unit IDs remain unchanged. Prices still come from the existing Save SKU authority. Unmapped rows, ambiguous matches, stale/unavailable sources and preview-to-live publication fail closed.

Save `staffLocations` maps Central actor IDs to existing Save locations; Live `staffStudios` maps them to canonical studio IDs. Central shows the actor ID for assignment. Earn operators manage only their published jobs/applicants; admins can manage all. Readers can inspect catalogues but cannot read member application/order/booking records or write operations.

### Activation requirements and evidence

Read-only production check on 8 September: NiaSave `/health` reported `demo: true`, memory storage and no connected Postgres for Save or Living. `/api/commerce/catalogue` returned 404. Central `/api/2para/v1` returned 200. Therefore this work cannot honestly be called connected to live commerce yet.

Both apps need these reviewed changes deployed, a new shared server-only `CENTRAL_COMMERCE_KEY` of at least 32 characters, and Central's `TWO_PARA_NIASAVE_ORIGIN` pointing at the intended NiaSave deployment. `NIASAVE_STOREFRONT_ORIGIN` is optional when the public frontend and API use different origins; both must be HTTPS in production. Keep preview flags off in deployment. Central needs authenticated Nia users with configured access lists and live sheet credentials. NiaSave still needs its existing durable storage, dummy-off, staff authentication and member OTP/identity readiness gates satisfied.

Actual source IDs must be mapped, bookable stock reconciled, and real pack sizes/prices/stay terms/job terms approved. No real applicant or order was submitted. One explicitly labelled local QA job was used for browser interaction; it did not come from a real current vacancy. The local Central snapshot has no demand rows, so publishing its empty job source remains disabled.

Verification: 34 Nia commerce tests; 16 Living/staff-auth regression tests; 16 focused Central source/access/routing tests. Both production builds and Central typecheck pass. Browser checks verified the application → Central operator update → same member application reference/message loop and a 390px member layout with no horizontal overflow. Central's broader `npm test` is blocked by an existing migration-list assertion that expects three migrations while main now contains five; no migrations were added by this change. Real Postgres, live OTP, actual employers and operational handover remain untested.


Production-output rendering was also attempted locally. Central's existing PGlite fallback crashes because `pglite.data` is absent from the built server output when no database is configured. The production build itself succeeds, but this fallback rendering check is blocked; it is not counted as a passing production integration test. The new commerce route requires authenticated access and the real storage/identity setup in production. The repository's bundled browser checker also assumes `/workspace` Linux paths, so desktop/mobile rendering and console checks used installed Chrome/Playwright on this Mac, alongside the in-app interaction checks.

### 8 September: Earn geography and Central handoff

Added a data-contract-ready Earn map/list view and Central's Lucide icon set. The map lazily loads bundled Leaflet and uses only fresh verified workplace/studio coordinates. It distinguishes a missing feed/current residence from a successful query with no open jobs. No production map feed or sample map pins have been added. See `docs/central-member-map-contract.md` for Claude's Central implementation provision, including current checked-in residence, open mandates, publication/revocation and member access.

The user clarified the NiaSave App is the website saved to a phone's home screen. A Central-enrolled passkey is the recommended SMS-free sign-in path. Passkeys and the complete Central KYC gate remain unimplemented; the existing request/verify identity adapter must not be described as an app-generated OTP solution.

Validation: 38 commerce tests and production build pass. Desktop 1280×844 and mobile 390×844 tested on dev and built output; marker selection focuses its job card, refresh leaves one map, category selection works, and missing-data/failed-tile states retain usable content. Fixture map records exist only in the browser QA script. Existing production database/identity activation prerequisites still apply.

### Connected local presentation demo

At the user's request, Central now owns a synthetic HSR member-residence scenario and four Walk2Work mandates. Central's local Earn screen has **Load demo records**. This signed operation is rejected outside explicit local preview and requires the preview admin. Repeated loading preserves application history and operator closures. The demo residence references the existing HSR studio catalogue ID; the residence assignment, employers and workplace pins are fictional presentation data, not imported KYC or checked-in occupancy.

`python3 scripts/load-connected-demo.py` uses local Central :8080 and NiaSave :8787 APIs to populate the shared demo plus one member application, one packed essentials order and one future Nest reservation. It checks preview mode before writing and verifies the same references in Central. No secrets are embedded. Sign in with **Continue as preview member** on the NiaSave page to see the member-scoped map. Local data is in memory; after an API restart rerun this loader. Send and insurance remain disabled. Real identity/KYC and production source integration remain unimplemented.

Validation: 39 NiaSave commerce tests; 16 focused Central tests; Central typecheck and both builds pass. The connected demo is exercised through the real local APIs, without mocked browser responses.
