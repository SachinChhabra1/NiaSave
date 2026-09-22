# NiaSave spine — five architecture gaps

Status: **spec / runbook only.** 22 September 2026. Branch `grok/spine-architecture-gaps`. Grounded on `main` `92b1833` (WhatsApp OTP through Central, #107).

This document resolves the five open product-spine gaps **before UI work**. It is not live wiring. Do not treat merge of this file as a flag flip, a Meta template submit, or a payment GO.

## Constraints (binding)

- Do not flip `COMMERCE_MEMBER_AUTH`, `COMMERCE_REQUIRE_CENTRAL_MEMBER`, `COMMERCE_REQUIRE_CENTRAL_IDENTITY`, `DEMO`, `DUMMY_DATA`, or any payment flag.
- `paymentsEnabled` stays `false`. No live UPI gateway. No prepaid capture without founder GO.
- Do not break Central connectors or the Catalogue sheet schema. Frozen columns stay frozen.
- Do not invent SKUs, prices, packs, or UTRs. Branded items (Tata Salt, Fortune, and any new product master) must not reach the member shop. Save goods stay unbranded editorial mill SKUs.
- Physical pickup is **Nests or hubs only**. Never a kirana, warehouse, or unnamed “store”.
- Member UI stays Apple-HIG / Apple Store clarity. Operator chrome stays Central light (`nia-operator.css`). Do not retouch Home copy or member stills in the work that implements these gaps.
- Central is the eligibility and commerce-config master. Member browsers talk only to NiaSave APIs. NiaSave holds the session cookie; it does not own the identity record.

## Decision lock

| # | Gap | Decision | Live-today code? |
|---|---|---|---|
| 1 | Snapshot attestation | New Central→NiaSave write `action=catalog.snapshot` on the **existing** `niasave-central-v1` HMAC. Content SHA-256 over frozen Catalogue columns. Unsigned sheet/CSV overlay must not become the live shop once attestation is on. Fail closed to last good attested revision. | Spec. Sheet pull stays until a later implement PR + founder GO on the require-attestation flag. |
| 2 | Session cookie Path | **UI-alias-only.** Do **not** widen `nia_member_setup` Path. Guest bag is `localStorage['nia-commerce-bag']`, not a cookie — merge does not need Path=`/`. | Already true. This spec freezes the choice. |
| 3 | Auth backdoor | Deprecate shared env `MEMBER_PASSWORD` after WhatsApp identity is trusted. Keep labelled TEST phone `+917000000001` and TEST prove routes. Per-phone `passwordDigest` after OTP is stay-signed-in, not the backdoor. | Spec. Do not delete the env var in this PR. |
| 4 | Payment rails | Prepaid UPI at Nest checkout is **future**. Live money remains UPI-at-handover + 12-digit UTR. No provider, no webhook, no `paymentsEnabled=true` without founder GO. | Spec only. |
| 5 | Identity timeout | Checkout fail-closed. Request timeout → `otp_unavailable`. Confirm 5xx / identity refresh 5xx → `identity_unavailable`. No password fallback once the shared-secret backdoor is gone. Pickup = Nests/hubs. | Mostly live after #107. Copy + fallback-removal ride the backdoor PR. |

Priority (founder): Snapshot 100 · Cookie 95 · Backdoor 90 · Payments 85 · Identity 80.

**Merge of this PR unblocks nothing on production flags.** Recommended sequence after this spec lands: (1) catalog attestation implement PR, (2) MEMBER_PASSWORD deprecation PR after the WhatsApp done-test passes, (3) prepaid UPI only on founder GO, (4) identity copy cleanup with the backdoor PR. Cookie Path is closed — no implement PR.

---

## 1. Snapshot attestation

### What is true today

Two HMAC directions already exist. **Neither signs Catalogue sheet content.**

| Direction | Context string | Header | Key | Where |
|---|---|---|---|---|
| Central → NiaSave (operator commands) | `niasave-central-v1\n` | `x-central-signature` | `CENTRAL_COMMERCE_KEY` (≥32; showcase: `SHOWCASE_CENTRAL_KEY`) | `POST /api/central/commerce` · `lib/commerce/central-auth.mjs` |
| NiaSave → Central (member kinds) | `niasave-to-central-v1\n` | `x-niasave-signature` | same pair | `{CENTRAL_ORIGIN}/api/service/member` · `lib/commerce/central-client.mjs` |

Envelope rules (already fail-closed): HMAC-SHA256 of the exact body, 64-hex signature, ±60s `at`, nonce, actor `admin|operator|reader`. See `verifyCentralEnvelope`.

Central can already **write** a verified Save catalogue through that envelope:

- `POST /api/central/commerce` `{ line: "save", action: "configure" }` → `core.configure()` (`lib/commerce/core.mjs`). Admin-only. SKU must exist in mill `SKUS`, prices/stock timestamps, optional `centralSource.system === 'rafiqi-central'`.
- Existing `{ action: "snapshot", line: "save" }` is an operator **read** of current NiaSave state (Command Center). Do not overload it.

**That is not how the member shop is filled today.** Live overlay is:

1. Google Sheet pull — `POST /api/connectors/sync-catalogue` → `pullCatalogueSheet()`. Auth is a Google service-account JWT (`BISON_GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_SERVICE_ACCOUNT_JSON`), **not** Central HMAC. Default spreadsheet `1ziaBVmk85RVW5SpvLnPD9o6q2s2IR9mcrYCxRm2TzmA`, tab `Catalogue`. Override `NIASAVE_CATALOGUE_SHEET_ID`. 8s abort. `lib/commerce/catalogue-connector.mjs`.
2. Staff CSV — `POST /api/connectors/upload` `kind=catalogue`. Staff gate only. No content signature.
3. Local mill stamp — `applyMemberFulfillment()` sets `config.verified: true` and TEST lane packs + Nest Ompal `S01` **without Central**, then overlays the sheet.

Honesty filter already drops branded / unknown SKUs and requires `nia_price_inr === SKUS.nia` when mill `skus` are passed (`overlayCatalogueProducts`). `status=hold` hidden; `status=test` TEST-lane only; `status=active` shop.

**Hole:** HMAC authenticates *who called*, not *which SKU/price reached the phone*. Sheet rows are trusted after column parse + mill-id/price filter.

Frozen columns — **do not add, rename, or reorder**:

```
sku_id, item_name, category, pack_size, unit,
nia_price_inr, kirana_price_inr, you_keep_inr,
source_site_code, source_sku, studio_site_code, status
```

(`CATALOGUE_COLUMNS` in `catalogue-connector.mjs`.)

### Required: cryptographic verification runbook

Reuse the existing Central→NiaSave envelope. Do not invent a third HMAC context. Do not change the sheet.

#### 1. Canonical bytes

For a snapshot body, build canonical UTF-8 JSON:

1. Keep only keys in `CATALOGUE_COLUMNS`, in that order.
2. Sort rows by `sku_id` ascending (ASCII).
3. Trim strings. Money as JSON numbers (not strings). Empty optional fields as `""`.
4. No extra keys, no mill fields, no member copy, no photos.
5. `contentSha256 = SHA-256 hex` (64 lowercase) of those bytes. This is the integrity hash. The envelope HMAC authenticates the whole POST; the content hash authenticates the catalogue rows independently of envelope wrapping (so an operator cannot swap rows inside a captured envelope without retargeting `at`/`nonce` *and* the hash).

#### 2. Push (Central → NiaSave)

Central (not the member browser, not a Google client in NiaSave) POSTs `POST /api/central/commerce` with header `x-central-signature` over context `niasave-central-v1\n`.

```json
{
  "at": 0,
  "nonce": "<16–100 [A-Za-z0-9_-]>",
  "actor": { "id": "<central-admin>", "role": "admin" },
  "line": "save",
  "action": "catalog.snapshot",
  "body": {
    "schemaVersion": 1,
    "source": "rafiqi-central",
    "spreadsheetId": "1ziaBVmk85RVW5SpvLnPD9o6q2s2IR9mcrYCxRm2TzmA",
    "tab": "Catalogue",
    "revision": 1,
    "contentSha256": "<64 lowercase hex>",
    "beatDate": "<YYYY-MM-DD matching open beat>",
    "rows": [ { "sku_id": "…", "item_name": "…", "status": "active" } ],
    "locations": [ { "id": "S01", "name": "Nia Nest Ompal", "modes": ["pickup"] } ]
  }
}
```

- `action` is **`catalog.snapshot`** (write). Distinct from existing read `snapshot`.
- Actor role **admin**. Operator/reader → 403.
- `source` must be `"rafiqi-central"`. Anything else → 400 `invalid_snapshot`.
- `spreadsheetId` / `tab` are **references**, not a new product master. Default id and tab stay as today. A different id is 400 unless founder sets `NIASAVE_CATALOGUE_SHEET_ID` to that same value — do not fork sheets.
- `locations[].id` must already exist as a Nest or hub in the Save/Jat studio list (`S01` Nia Nest Ompal today). No new pickup types.
- Rows use frozen columns only. Unknown keys ignored. Missing required (`sku_id`, `item_name`, `status`, `nia_price_inr`) → row dropped before hash is checked? **No** — hash is over the bytes Central signed. Verify hash first on the `rows` array as sent; then parse.

#### 3. NiaSave verify steps (in order, fail-closed)

1. `verifyCentralEnvelope` — key ≥32, 64-hex HMAC, ±60s, nonce format. Fail 401 `central_auth_required` / `central_request_expired` / 503 `central_connection_not_configured`.
2. Replay nonce (existing `s.commerce.centralNonces`, 120s). Fail 409 `central_request_replayed`.
3. `line === "save"` and `action === "catalog.snapshot"`. Else existing `unknown_operation`.
4. `body.schemaVersion === 1` and `body.source === "rafiqi-central"`.
5. `contentSha256` is `/^[a-f0-9]{64}$/` and equals SHA-256 of canonical bytes of `body.rows`. Mismatch → 400 `catalog_hash_mismatch`. **Do not apply the rows.**
6. `revision` is a safe integer ≥ 1. If `revision < lastAttested.revision` → 409 `catalog_revision_stale`. If `revision === lastAttested.revision` and hash differs → 409 `catalog_revision_conflict`. Same revision + same hash is idempotent 200.
7. Parse through existing `parseCatalogueRows` + `overlayCatalogueProducts(..., { skus: SKUS })`. Honesty still drops branded / unknown / price-mismatched rows. If **every** row is dropped → 400 `catalog_honesty_rejected` and keep last good.
8. Locations: Nest/hub ids only; `modes` include `pickup`. Delivery remains a location mode on that Nest/hub, not a new pickup type.
9. Persist `{ revision, contentSha256, at, actorId, rows: parsed, locations }` as `s.commerce.attestedCatalogue`. Existing `configure()` may still stamp `config.verified` from this attested body — do not introduce a second catalogue ledger.
10. Audit `{ action: "catalog.snapshot", revision, contentSha256, actor }`. Never log row prices in full if avoidable; never log the HMAC key.

Unsigned Google Sheet pull and staff CSV remain **operator staging** after attestation is required. They must not overlay the member shop.

#### 4. Serving the shop

| Flag (future, default unset) | Member `GET /catalogue` |
|---|---|
| Unset / not `"true"` | Today: mill stamp + sheet/CSV overlay. **Do not flip in the implement PR without founder GO.** |
| `CATALOGUE_REQUIRE_ATTESTATION=true` | Serve only `attestedCatalogue`. If none → 503 `catalog_unattested` (browse may still show the empty “Ask Nia” wall, never unsigned rows). If a new snapshot fails, keep last good and 200 the last good. |

Last-good rule: a bad push never blanks a working shop. A missing first snapshot with the flag on **does** fail closed.

TEST `status=test` rows may live inside the attested snapshot. They stay labelled `(TEST)` and visible only on the TEST lane. Dummy stays dummy.

#### 5. What Central still owns

Central (or its operator) is the one that reads the Catalogue tab and signs. NiaSave may keep `pullCatalogueSheet` for staff desks / bison as a convenience **read**, but the member phone must not trust that pull once the flag is on.

Do not:

- Add sheet columns.
- HMAC the Google JWT response in place of Central’s envelope (Google is not Central).
- Let `applyMemberFulfillment()` set `verified: true` for **non-TEST** mill packs once attestation is required. TEST mill stamp may remain as the labelled TEST lane.
- Create a new SKU master in code.

#### 6. Prove (implement PR, not this one)

- Tampered row (price +1) with a captured valid envelope hash → `catalog_hash_mismatch`, last good unchanged.
- Valid envelope, branded SKU only → `catalog_honesty_rejected`.
- Replay nonce → 409.
- Stale revision → 409.
- Happy path: frozen mill SKU, matching price, Nest `S01` → shop serves attested pack; `paymentsEnabled` still false.

---

## 2. Session cookie scope — Path widening vs UI-alias-only

### What is true today

| Cookie | Path | Flags | TTL | Role |
|---|---|---|---|---|
| `nia_member` | `/api/commerce` | HttpOnly; Secure; SameSite=Strict | 30d remember / 12h | Signed-in member session |
| `nia_member_setup` | `/api/commerce/auth/password` | same | 10 min | OTP → set-password |
| `nia_commerce` | `/api/commerce` | HttpOnly; SameSite=Strict; Secure unless local preview | 12h | Legacy OTP / passkey |
| `__Host-nia_staff_page` | `/` | HttpOnly; Secure; SameSite=Strict; no Domain | ≤12h | Staff HTML desks only |

Setup cookie Path is **narrower** than `/api/commerce/auth/set-password`. Live #47 documented this. The client already tries aliases **under** the setup Path first:

```143:150:commerce-member-auth.js
  // Live #47 setup cookie is Path=/api/commerce/auth/password and is not sent to /auth/set-password.
  return [...new Set([
    '/auth/password',
    '/auth/password/set',
    ...named,
    '/auth/set-password',
```

Server aliases the same three POSTs (`http.mjs` `setPasswordPath`). Capabilities advertise `setPasswordPath: '/api/commerce/auth/set-password'` plus aliases `/auth/password` and `/auth/password/set` (`member-password.mjs`).

**Guest bag is not a cookie.** `commerce.js` loads/saves `localStorage['nia-commerce-bag']`. Same key before and after sign-in. Copy: “Only asked at checkout · bag stays on this phone.” After OTP, `finishMemberSession()` → `refresh()` prunes invalid SKUs from that same object → if `checkoutPending` and the bag still has lines, `review()` continues. Logout **clears** the bag (intentional: the next person on that phone does not inherit it).

There is no server-side bag merge. There is no bag cookie.

### Decision: UI-alias-only. Do not widen Path.

Widening `nia_member_setup` to `Path=/` or even `Path=/api/commerce` would send a 10-minute setup token on every commerce GET (catalogue, quote, orders). That is extra CSRF/session surface for zero merge benefit: the bag never rode that cookie.

Widening `nia_member` to `Path=/` would put the member session on every static asset and staff HTML document. Staff already uses `__Host-nia_staff_page` at `/`. Member and staff cookies stay split.

Seamless guest → member merge on **this phone**:

1. Guest adds to `nia-commerce-bag` (localStorage, same origin).
2. Checkout asks for phone (`checkoutPending = true`).
3. OTP + set-password mint `nia_member` at `Path=/api/commerce`.
4. Client keeps the same localStorage key. `refresh()` drops SKUs the attested catalogue no longer sells.
5. `review()` resumes. Quote/reserve require the session cookie; they never read the bag from a cookie.

Do not:

- Set member cookies `Path=/`.
- Promote member cookies to `__Host-` (that forces Path=`/`).
- Put the bag in a cookie.
- Merge bags across devices or phone numbers.
- Change SameSite=Strict / Secure / HttpOnly.

Apple-clear copy (already on the phone; keep):

| State | Copy |
|---|---|
| Checkout, signed out | “Only asked at checkout · bag stays on this phone” |
| After sign-in, bag intact | Resume review. No “your bag was restored” toast unless a SKU dropped. |
| SKU dropped on refresh | Silent prune (already). If the bag empties: empty-bag sheet, not an error. |
| Sign out | Bag cleared. Next guest starts empty. |

**Implement PR: none.** Documented choice. Client alias order stays.

---

## 3. Auth backdoor — deprecating `MEMBER_PASSWORD`

### What is true today

Three bypasses, plus Polo skip-OTP which is already 410 on live:

**A. Shared env `MEMBER_PASSWORD`.** Enabled when `SESSION_SECRET` ≥16 **and** (`MEMBER_PASSWORD` ≥8 **or** `COMMERCE_MEMBER_AUTH=password`). Compare is HMAC-SHA256 + `timingSafeEqual`. `POST /api/commerce/auth/login` accepts that shared password **with or without a phone** if no per-phone profile exists (`memberPasswordLogin` → `passwordMatches`). Sets `nia_member`. Documented in `docs/secrets.md`.

**B. Labelled TEST phone `+917000000001`.** Real `/auth/request` → `/verify` → `/set-password` path, local HMAC OTP, never Central, never WhatsApp. `test:true`.

**C. Credential-free TEST prove routes** (`GET /api/commerce/test/member-login`, `/test/session`, `/test/place-one`, `/test/orders/:id?sig=`). Labelled. Payments still off.

**Not the backdoor:** per-phone `passwordDigest` written after a successful OTP + set-password. That is “stay signed in on this phone.” `identitySource: 'central-whatsapp'` profiles refresh through `member.identity` on each login.

`COMMERCE_REQUIRE_CENTRAL_MEMBER` unset → testers can request OTP without Central enrolment. Set `true` to restore `not_registered` (today the public pre-lookup is already skipped so the roster does not leak; Central still decides on confirm).

UI still offers password as a fallback on `otp_unavailable` (`commerce-member-auth.js`).

### Deprecation sequence (after WhatsApp identity is trusted)

**Trust gate (unfakeable, from `docs/whatsapp-cloud-login.md`):** a real non-TEST Indian mobile, typed into Sign in on niasave.com, receives a WhatsApp AUTHENTICATION code from the existing Nia Cloud API number, the member enters that code, and lands in a member session keyed to Central’s member id. `otp_unavailable` is gone for that number. TEST `+917000000001` is not this test.

Until that gate passes, keep A.

| Phase | What | Flags / ops | Member copy |
|---|---|---|---|
| 0 — today | A + B + C live. Per-phone digest after OTP. | Do not flip anything in this spec PR. | `otp_unavailable` may still mention password. |
| 1 — WhatsApp trusted | Prove the done-test. Leave A in place for one soak. | No flag yet. Watch `/auth/login` shared-secret hits (no phone / no profile). | Unchanged. |
| 2 — disable shared secret | `passwordMatches()` returns false when `COMMERCE_DISABLE_SHARED_MEMBER_PASSWORD=true` **or** when `MEMBER_PASSWORD` is deleted from Vercel (length < 8 already disables it). Prefer **delete the Vercel var** — no new flag if the existing length gate is enough. | Human deletes `MEMBER_PASSWORD` from Vercel Production. Redeploy. Per-phone digest still works. `COMMERCE_MEMBER_AUTH` stays. | Drop “or sign in with your password if you already have one” from `otp_unavailable`. Keep set-password after OTP. |
| 3 — refuse shared-secret sessions | Existing `nia_member` cookies minted via A (`id: 'nia-member'` / `identitySource: 'member-password'` without Central) fail closed on the next request when `COMMERCE_REQUIRE_CENTRAL_MEMBER=true`. Labelled TEST actors stay. | Founder GO to set `COMMERCE_REQUIRE_CENTRAL_MEMBER=true`. Not this PR. | Signed-out sheet: “Sign in with your WhatsApp code.” |
| 4 — code removal | Delete `passwordMatches` shared-secret branch, `MEMBER_ACCOUNT` generic id path, secrets.md row for `MEMBER_PASSWORD`. Keep B and C labelled. | Separate PR after 14 days of zero shared-secret logins. | — |

Do not:

- Delete TEST phone bypass or TEST prove routes as part of deprecating A. They are labelled TEST, not a production member backdoor.
- Treat per-phone `passwordDigest` as the backdoor. After OTP it is the stay-signed-in secret for that phone on that deployment.
- Flip `COMMERCE_MEMBER_AUTH` off — password_otp mode is the WhatsApp + stay-signed-in shell.
- Bypass OTP with password once A is gone. `otp_unavailable` / `identity_unavailable` fail closed at checkout (gap 5).

Apple-clear states after phase 2:

| Kind | Copy (en) |
|---|---|
| signed out | “Enter your phone. Pay when you collect.” |
| OTP sent | “Enter the 4 to 8 digit code from WhatsApp.” |
| `otp_unavailable` | “A verification code could not be sent. Try again.” (no password clause) |
| `identity_unavailable` | “The sign-in service is unavailable. Please try again.” |
| `bad_otp` | “That code is not correct. Try again.” |
| session expired | existing stayErrorKind `expired` |
| network | existing stayErrorKind `network` |

---

## 4. Payment rails — future prepaid UPI at Nest checkout

### What is true today

`paymentsEnabled: false` is hardcoded on every catalogue / staff / TEST payload. Tests assert it is never `true`.

Live money model:

- Catalogue: `payment: 'upi_at_handover'`, `onlinePayment: false` (`core.catalogue`).
- `POST /orders` (`core.reserve`) persists `payStatus: 'unpaid'`, `paid: 0`, `method: 'upi'`.
- Staff `verify_payment` only at `out_for_delivery` | `collect_at_stop`. 12-digit UTR, exact amount, `receiptVerified: true`, UTR unique. Then collect needs pickup code **and** paid. `reconcile` needs `statementVerified` + note.
- Member copy: “Nothing online. Pay by UPI when you collect.” Pickup at **Nia Nest Ompal (S01)** and other published Nests/hubs only.
- Polo `/v1/payments` is 410 `use_member_storefront` on live. `docs/UPI.md` is a skipped contract. `.env.example` UPI_* keys are unused.

No provider. No webhook. No member-initiated charge.

### Future state (founder GO required before any of this is coded)

Prepaid capture at **Save Nest checkout** — the member pays UPI before the bag is reserved for pickup at that Nest/hub. Not a new product. Not a wallet. Not WhatsApp pay. Not cash.

```
member bag (localStorage) → sign-in (WhatsApp / stay-signed-in)
        │
        ▼
NiaSave POST /quote   (server reloads attested catalogue, Nest, amounts)
        │
        ▼
NiaSave POST /api/commerce/payments/upi/orders
        │  server creates provider order from quote fingerprint
        │  amount NEVER from the browser
        ▼
member approves UPI (intent / dynamic QR — provider TBD)
        │
        ▼
provider webhook → NiaSave (signature, timestamp, replay, amount, order id)
        │
        ▼
only then core.reserve with payStatus=paid, paid=amount
        │
        ▼
member collects at the Nest/hub with pickup code
        │  staff collect_at_stop: pickup code only (already paid)
        ▼
reconcile: provider settlement + bank credit + Sikh desk (existing statementVerified)
```

Rules that stay even after GO:

1. **No client-supplied amount** can change the charge (`docs/UPI.md`).
2. Duplicate idempotency keys cannot double-charge or double-reserve.
3. Webhook (or provider status lookup) is source of truth, not a browser redirect.
4. Pickup remains Nests/hubs. Delivery, if offered, is to the Central-verified Nest pin, never a typed address.
5. TEST orders stay labelled; dummy UTRs stay dummy.
6. Honesty catalogue still applies — branded SKUs cannot be charged because they cannot be quoted.
7. `paymentsEnabled` flips to `true` only in the GO PR, with tests updated in the same PR. Until then every payload keeps `false`.
8. Fail closed: provider down → member sees “Payment is not available. Pay when you collect is also paused until the team is ready.” Do **not** silently fall back to unpaid reserve in prepaid mode. (The handover UTR path is a different product mode, selected by founder, not a hidden fallback.)

Decide before coding (from `docs/UPI.md`, still open): provider, contracting Nia entity, settlement account, intent vs dynamic QR vs collect request, refund owner. This spec does not pick a vendor.

**This spec PR does not implement any of the above.** Live stays UPI-at-handover.

---

## 5. Identity provider — timeout at the checkout gate

### What is true today (after #107)

NiaSave no longer POSTs `COMMERCE_IDENTITY_URL`. `identity()` in `http.mjs` is:

- `request` → `centralIdentityVerifyRequest` kind `identity.verify.request`
- `verify` → `centralIdentityVerifyConfirm` kind `identity.verify.confirm`

Signed NiaSave→Central envelope (`niasave-to-central-v1\n`, `x-niasave-signature`). Subject `phone-bootstrap`. Channel `"whatsapp"` only. Client IP from `x-vercel-forwarded-for` (Vercel) or the socket, never the body.

Timeouts (`centralMemberRequest`):

| Kind | AbortSignal |
|---|---|
| `identity.verify.request` | **30s** (WhatsApp send on Central) |
| `identity.verify.confirm` | **8s** |
| `member.identity` refresh | **8s** |
| every other Central kind | **8s** |

HTTP mapping (`http.mjs`):

| Event | Status | `error` | Checkout |
|---|---|---|---|
| Request throw / non-challenge | 503 | `otp_unavailable` | Do not reserve. Stay on phone sheet. |
| Request 429 | 429 | `too_many_attempts` | Stay. |
| Confirm 5xx | 503 | `identity_unavailable` | Do not reserve. |
| Confirm 401 / missing `account.id` | 401 | `bad_otp` | Stay on code sheet. |
| Confirm 429 | 429 | `too_many_attempts` | Stay. |
| Setup cookie missing/expired | 401 | `setup_expired` | Restart phone. |
| Signed-in `central-whatsapp` refresh 401 | 401 | `sign_in_required` | Session dead. Bag still on phone until logout. |
| Signed-in refresh 5xx | 503 | `identity_unavailable` | **Fail closed: do not quote or reserve.** |
| Guest `POST /quote` or `/orders` | 401 | `sign_in_required` | UI sets `checkoutPending` and opens phone sheet. |
| TEST phone | local HMAC OTP | never Central | Labelled. |

Guest `GET /catalogue` remains allowed (`COMMERCE_PUBLIC_BROWSE` default on). Checkout is the gate.

`docs/whatsapp-cloud-login.md` remap table still lists `COMMERCE_IDENTITY_URL` as “today”. That row is **stale after #107**. Live path is Central kinds. `COMMERCE_IDENTITY_URL` / `COMMERCE_IDENTITY_KEY` are leftover env names — do not point them at Graph; do not use them for new work. Drain in a later secrets audit.

Central allowlist / WhatsApp send still have to land on rafiqi-central for the done-test (`docs/central-identity-verify-kinds.md`). Until then real phones can still see `otp_unavailable`. That is fail-closed, not a reason to reopen `MEMBER_PASSWORD`.

### Required fallback logic (checkout)

```
review() / confirm()
  │
  ├─ no nia_member cookie → sign_in_required → phone sheet. Bag stays in localStorage.
  │
  ├─ cookie present, identitySource central-whatsapp
  │     refresh member.identity (8s)
  │       ├─ 200 ready + KYC approved + authVersion match → quote/reserve
  │       ├─ 401 → sign_in_required (expired). Do not use password.
  │       └─ timeout / 5xx → identity_unavailable. Do not quote. Do not reserve.
  │
  ├─ otp request (30s)
  │     ├─ challenge → code sheet
  │     ├─ timeout / 5xx → otp_unavailable. Stay. After backdoor gone: no password link.
  │     └─ 429 → too_many_attempts
  │
  └─ TEST phone / TEST prove → labelled path only. Never a real-member fallback.
```

No fallback to:

- Shared `MEMBER_PASSWORD` (gap 3, after deprecation).
- `COMMERCE_IDENTITY_URL`.
- Guest reserve.
- A guessed Nest, studio, or member id.
- SMS / DLT / passkey (out of v1).

Pickup locations on the review sheet stay Central-granted `locationIds` that exist as Nests/hubs. `S01` Nia Nest Ompal is the current TEST/pilot Nest. Do not add a “store” picker.

Apple-clear checkout states (member Save, Apple Store pattern — one sentence, one action):

| Kind | Title | Body | Action |
|---|---|---|---|
| signedOut | Your phone | Enter your phone. Pay when you collect. | Continue |
| loading | — | Loading… | disabled Continue |
| otp_unavailable | — | A verification code could not be sent. Try again. | Try again |
| identity_unavailable | — | The sign-in service is unavailable. Please try again. | Try again |
| bad_otp | — | That code is not correct. Try again. | Try again |
| expired | Sign in | Please sign in again. Your bag is still on this phone. | Sign in |
| network | — | Check your connection and try again. | Try again |
| ready (in) | Pay when you collect | Pick up your bag here. Pay when you collect. | Check price |

`stayErrorKind` already classifies signedOut / expired / network / failed. Do not invent a fifth visual language.

`COMMERCE_REQUIRE_CENTRAL_IDENTITY=true` already fail-closes `GET /api/commerce/identity` when Central is mute. Unset returns `status: 'unavailable'` with nulls (never a guessed studio). Checkout must not treat `unavailable` as enrolled. Quote/reserve already require a member actor; they do not read that identity document to price the bag.

---

## Implementation order (after this spec)

| Order | Work | Depends on | Flag flips |
|---|---|---|---|
| 0 | **This document** | — | None |
| 1 | Catalog attestation implement: `action=catalog.snapshot`, hash, last-good, honesty | Central can POST the envelope (Assam/Central). Sheet columns unchanged. | `CATALOGUE_REQUIRE_ATTESTATION` default unset. Founder GO to require. |
| 2 | Cookie Path | — | **No PR.** Decision is alias-only. |
| 3 | WhatsApp done-test on a real phone | Central allowlist + AUTHENTICATION template | None on NiaSave |
| 4 | Delete Vercel `MEMBER_PASSWORD`; drop password clause from `otp_unavailable` | Step 3 | No new flag if the length gate is enough |
| 5 | `COMMERCE_REQUIRE_CENTRAL_MEMBER=true` soak | Step 4 | Founder GO |
| 6 | Prepaid UPI at Nest checkout | Founder GO + provider + attested catalogue | `paymentsEnabled` only in that PR |
| 7 | Identity copy polish (password clause, stale remap table in `whatsapp-cloud-login.md`) | Step 4 | None |

None of 1–7 is “live today unblock.” TEST member order spine, sheet connector, and Central-light operator desks stay as they are.

## Explicitly out of this PR

- Code, tests, env, sheet columns, connectors, Meta template submit, Home copy, member stills, operator CSS.
- Flipping `paymentsEnabled`, `COMMERCE_MEMBER_AUTH`, `COMMERCE_REQUIRE_CENTRAL_*`, `DEMO`, `DUMMY_DATA`.
- New product masters or branded editorial SKUs.
- Pickup points that are not Nests or hubs.

## File map (citations)

| Topic | Files |
|---|---|
| Central HMAC in | `lib/commerce/central-auth.mjs`, `lib/commerce/central-http.mjs` |
| Central HMAC out + identity kinds | `lib/commerce/central-client.mjs` |
| Auth HTTP + fail-closed | `lib/commerce/http.mjs` |
| Cookies, shared password, per-phone digest | `lib/commerce/member-password.mjs` |
| Setup Path aliases | `commerce-member-auth.js` |
| Guest bag | `commerce.js` (`nia-commerce-bag`) |
| Sheet overlay, frozen columns | `lib/commerce/catalogue-connector.mjs` |
| Mill stamp / Nest Ompal | `lib/commerce/member-fulfillment.mjs` |
| Reserve unpaid UPI | `lib/commerce/core.mjs` |
| Apple stay states | `commerce-truth.js` `stayErrorKind` |
| WhatsApp v1 / kinds | `docs/whatsapp-cloud-login.md`, `docs/central-identity-verify-kinds.md` |
| Skipped prepaid UPI | `docs/UPI.md` |
| Secrets | `docs/secrets.md` (`MEMBER_PASSWORD`, `CENTRAL_COMMERCE_KEY`) |
