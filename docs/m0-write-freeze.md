# M0 — freeze NiaSave before Central owns commitments

The pilot remains closed. This change does not implement Central contracts, move
records, discard data, or prove M3. Reopening requires a reviewed code release
following the timeout, concurrency, revision-conflict and retry-status proofs.
There is intentionally no environment switch that re-enables the legacy writer.

## Closed paths

The freeze applies to direct paths, `/api` aliases, query-string rewrites and
trailing-slash aliases. It rejects requests before parsing bodies or opening a
state transaction. Normal authentication paths are outside the route policy.

- Commerce: staff configuration/action, quote, orders, cancellation, Nest
  configuration/quote/hold/cancellation, Earn submission and bulk Studio imports.
- Signed Central gateway: every action except snapshot and unit-overview. A
  valid signature does not permit a local operational mutation.
- Legacy Save: connector upload/sync, beat open/close, scans, stops, procurement,
  dispatch, invoices, biker actions, vendor catalogue/publication, reconciliation,
  payouts, cash, order and order-action routes.
- Prototype commitments: `/v1/save`, `/v1/orders`, `/v1/payments`, Nest writes,
  extra-work decisions and staff hub mutations.
- Living/Bison: all mutation methods and the GET-shaped `/data/sync` scheduler.
- Credential-free `/commerce/test/*` surfaces, including GET order creation.

HTTP refusal is 503 `pilot_commitments_paused`, with reserve/hold/apply false.
The member capability gate disables commitments and shows pause/help copy in
English, Hindi, Tamil and Bengali before submission. Existing pending requests
are not automatically replayed. Save/Live cancellation is paused too because
it changes stock/capacity; the notice directs existing requests to the Nia team.

## Reads and persistence

- Save expiry and Nest expiry do nothing during M0.
- Member fulfilment does not republish configuration or replenish opening stock.
- Catalogue, owner projections and other normal commerce GETs use detached read
  snapshots. Reads cannot persist projected changes.
- Loading an operational book uses SELECT only: no table creation or seed INSERT.
- The state runner rejects protected book changes even if a handler is missed.
- An allowed login/support save preserves the raw persisted operational fields;
  restore-time normalization cannot silently rewrite the frozen source book.
- Existing OTP/password/session implementation is unchanged. Existing session,
  password-profile, limiter, replay-nonce and support fields remain writable;
  recovery/support audit additions remain available. These are not stock writers.
- Explicitly TEST-marked catalogue rows and locations are excluded from the
  non-preview catalogue. This is not a claim of full pilot data-quality sign-off.

The old pure engine functions remain for historical compatibility/unit tests;
no mounted operational write path may call them successfully. Tests expecting
local HTTP ordering, TEST auto-session ordering, signed publication or local
expiry have been replaced by freeze coverage. No new Central contract is mocked.

## Validation

Production member build; Sikh self-test; Jat/staff access; Dogra; full commerce;
security and transaction tests. Tests include 512 method/path/alias combinations,
valid signed commands, read-triggered expiry, missed-handler persistence rejection,
authentication regression and raw-source preservation.

At 320px, browser checks cover Save/Live/Earn in all four languages: pause notice
present, zero enabled commitment controls, no uncaught page errors. Existing
narrow-layout overflow is not P10 sign-off; native-language review remains due.

The storage integration command skips without DATABASE_URL. No production-like
Postgres durability/concurrency claim is made from local protocol tests.

## Deployment and rollback

Merge/deploy only this freeze first; verify the deployed revision and refusal
responses before recording M0 as landed. Do not reopen commitments to diagnose
M1 access. Read-only M1 inventory must use the persisted JSON directly, not the
normalizing runtime loader. Count test flags, linked test provenance and unknown
provenance separately. No records may be discarded on the basis of an empty or
failed read.

If rollback is needed, keep the freeze active: fix forward, or take the member
service offline before restoring an older deployment. A blind rollback to the
previous build re-enables the duplicate writer and is not a safe rollback.

## Blockers

M1 production counts are unknown. The connected Vercel tool returned no teams;
the existing CLI session returned HTTP 403. No production secrets were printed.
The Central-owned Save contracts identified in the prior audit still need their
own separately tested/landed PRs before any NiaSave consumer is implemented.
