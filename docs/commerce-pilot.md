# Niasave commerce pilot build

Status: working local preview, not a production release. No live site or production database was changed.

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
- Existing Save self-test and 16 Bison/staff-auth tests pass.
- Production storefront build and naming checks pass. The pre-existing Tanot image resolution warning remains; the production build separately copies that asset.
- Browser: member reservation, same-order operations fulfilment, unpaid handover rejection, simulated receipt verification and bank close, plus investor read-only access.
- Catalogue layout inspected at 320, 360, 390, 412, 768, 1024 and 1440 CSS pixels; no horizontal page overflow in those checks.

Outstanding validation: real Postgres/restart/multi-worker integration, actual identity/SMS and role provisioning, full Hindi copy and recovery-flow review, low-brightness physical Android checks, 200% text scaling and screen-reader pass, and the PRD's throttled-network performance/retry gate. Existing database integration tests skipped because no test database was provided. Live merchant receipt and bank reconciliation must be exercised by operators in the physical pilot.
