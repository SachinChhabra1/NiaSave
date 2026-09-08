# Central → NiaSave: implementation handoff for Claude

Status: 8 September 2026. Build requirements, not a claim of completed production integration.

## Product decision

Rafiqi Central controls NiaSave. NiaSave is the member interface to Central's operations. Keep the canonical member, inventory, bookings, orders, applications and reconciliation records; do not introduce another ledger or independently maintained catalogue.

LESS ownership: Live → Jat / Nest operations; Earn → Walk2Work; Save → Sikh / goods and approved insurance; Send → payments-bank integration, disabled until operational. Online payments and WhatsApp remain off. Goods can be settled through the merchant's UPI scanner at handover, with operator verification and reconciliation recorded against the same order.

All members, including anyone viewing on a laptop, see the member experience. No separate enterprise or investor storefront.

## Deliver first: Earn around the member's actual Nest

The Earn page should show the studio the authenticated member currently lives in and open Walk2Work mandates around it. The user confirmed Central does not yet have the required location records and asked Claude to build that provision.

Use a quiet street map with one current-studio marker, numbered workplace markers, matching nearest-first job cards, pay and shift information. Mobile shows the map above the cards; desktop shows them alongside one another. Distances are straight-line kilometres until a routing service supplies actual routes. Do not label them walking time or walking distance. No GPS permission is necessary for this feature.

### Central records and operator screens to add

1. **Studio directory, Jat / Live:** canonical `studioId`, stable `sourceSiteCode`, display name, address, WGS84 `lat` and `lng`, `locationVerifiedAt`, `locationVerifiedBy`, active status and revision. Provide an operator pin editor with address context and explicit verification. Preserve zero as a legitimate coordinate; missing values must stay null. No automatic city-centre pins.
2. **Current residence:** canonical `memberId` → current checked-in `studioId`, effective start/end and checked-in status. A future reservation, pickup point or preferred location is not a current residence. Resolve using existing Jat occupancy/check-in records; enforce at most one effective current residence. Multiple matches produce an exception for operators to resolve.
3. **Walk2Work mandates:** stable `mandateId`, employer, role, verified workplace address/coordinates, city, shift, pay minimum/maximum and period, requirements, employer terms, opening/closing times, current `openPositions`, explicit status (`draft`, `open`, `paused`, `filled`, `closed`, `cancelled`), assigned operator, verification evidence and source revision. Model separate workplaces explicitly rather than one company/city aggregate.
4. **Publication controls:** Central operators approve complete verified mandates for members. Central is the sole place for approval, pause, closure and correction. Recheck vacancies and eligibility server-side when applying. Distinguish applicants from filled positions; an application does not consume a vacancy automatically.
5. **Member access:** canonical KYC state, member status, authentication subject mapping and credential/session revocation. Match stable IDs. Do not join members by display name or accept a browser-supplied member/studio ID.

Existing `flow_demand` contains aggregate company/city/counts. It is not the mandate source. Replace that Earn publication input; do not infer jobs from it. The existing Central source adapter is `src/lib/member-commerce.server.ts`, and the Central operator surface is `src/components/member-commerce.tsx`.

### Member API contract

Extend the existing same-origin NiaSave `GET /api/commerce/earn`. The following is a schema illustration; angle-bracket values are placeholders, not seed records.

```json
{
  "owner": "Walk2Work",
  "preview": false,
  "map": {
    "status": "ready",
    "asOf": "<last successful authoritative source refresh, ISO timestamp>",
    "revision": "<source revision>",
    "studio": {
      "id": "<canonical current studio ID>",
      "name": "<member-facing studio name>",
      "lat": "<number>",
      "lng": "<number>",
      "verified": true
    }
  },
  "jobs": [{
    "id": "<existing canonical published job ID>",
    "revision": "<current job revision>",
    "mandateStatus": "open",
    "openPositions": "<positive integer>",
    "employer": "<employer>",
    "city": "<city>",
    "title": "<role>",
    "payMin": "<number in INR>",
    "payMax": "<number in INR>",
    "payPeriod": "month",
    "shift": "<shift>",
    "requirements": "<requirements>",
    "terms": "<verified terms>",
    "closesAt": "<ISO timestamp>",
    "workplace": { "lat": "<number>", "lng": "<number>", "verified": true },
    "preview": false
  }]
}
```

`map.status` alternatives: `studio_missing`, `unavailable`, `stale`. Return an empty jobs array when the source is unavailable or stale; do not report that no jobs exist. `ready` with `jobs: []` means a successful fresh query found no matching open jobs.

Coordinates are numeric WGS84 latitude/longitude. The renderer supports the Web Mercator latitude range ±85.051129 and longitude ±180. Verify the actual workplace pin in Central; syntactic coordinate validation is not verification of a location.

Return only this member's current residence and approved eligible jobs in the member's operating theatre. Compute geographic ordering from that studio. If a radius is introduced, manage it in Central and disclose it in the response/UI; do not silently truncate the result set or hardcode a city. Do not expose the roster, other residents, internal employer notes, KYC documents or staff credentials.

`asOf` is the successful source refresh timestamp, never response generation time. The current map renderer refuses data older than five minutes or more than one minute in the future. Refresh automatically on source changes or on an authenticated read using a bounded cache; the connection must not require an operator to leave a browser tab open. A cron refresh must authenticate before any work. Do not reuse a fail-open cron route.

### Connection and writes

Use the existing server-only signed Central gateway at NiaSave `/api/central/commerce`, with `CENTRAL_COMMERCE_KEY`, timestamp, nonce, role checks and replay protection. The key never enters browser code. Extend its validated projection/read contract or use a scoped authenticated server-to-server read; settle that choice in code, not a browser-to-Sheets call.

NiaSave application intent continues through `POST /api/commerce/earn/applications` with `jobId`, `revision`, `consent` and an idempotency key. Verify current member/KYC state, current mandate status, open positions, revision and expiry before creating an application in the existing canonical operations store. Return 409 for a withdrawn or changed mandate; preserve exact successful retries even if the mandate later closes. Keep application history after closure. Central changes the same application record and NiaSave reads that status.

Keep network reads outside replayable database/CAS transaction callbacks. Use bounded source freshness and reconcile updates against the source revision at write time; cached browser data cannot authorize an application. Explicitly test the race where a mandate closes between read and submit.

Remove or restrict independent NiaSave staff configuration paths so Central owns publication. Central controls products, prices, stock availability, pickup locations, Nest offers, eligibility, categories, policy copy/translations, service availability and feature switches. Brand presentation can remain in the shared code/design system. Never make activation a localStorage flag. Use existing canonical stock holds, bookings, order IDs and settlement records.

## Home-screen website authentication

The user clarified that “NiaSave App” means this website saved to a phone's home screen. There is no separate installed native authenticator app.

A home-screen shortcut cannot bootstrap its own authentication by showing an OTP before sign-in. Do not put a shared TOTP seed in localStorage, generate a self-verifiable browser code, use a permanent PIN as an OTP or assume a service worker can deliver secure independent codes.

Recommended SMS/WhatsApp-free implementation: **WebAuthn passkeys**, verified by the phone's fingerprint, face or screen lock. This recommendation is not implemented in the current build. A passkey is not an OTP; label the UI honestly as “Sign in with your phone”.

Central must control first activation after verified KYC using an audited, short-lived, single-use enrolment process conducted by an authorized operator. Bind the credential to a stable member ID, not just the entered phone number. Store credential public keys server-side; enforce RP ID/origin, unpredictable single-use challenges, expiry, rate limits and user verification. Never expose unknown-vs-known phone status on a public lookup.

Gate catalogue, Nest, Earn and account APIs server-side for active KYC-approved members. The public shell may show the sign-in/help page only. Revocation, suspension, changed phone and lost-device recovery must be controlled in Central, revoke prior credentials/sessions as appropriate and require a new verified enrolment. Provide an operator-assisted path for members whose browsers/devices do not support the chosen authenticator. Do not silently fall back to SMS or WhatsApp. Decide passkey sync/shared-phone policy before launch.

The current NiaSave identity adapter still has a generic request/verify OTP contract and SMS copy. It has not yet been converted to passkeys or a complete Central KYC gate. Do not enable production access on the assumption that these requirements are finished.

## Implementation already present in this branch

- `commerce-earn-map.js`: lazy-loaded local Leaflet 1.9.4, current-studio marker, numbered job pins, accessible cards, nearest-first straight-line distances, reset/zoom controls, mobile layout and missing/stale/tile-failure states. No geolocation request. Synthetic presentation records can now be loaded from Central under its explicit local preview guard; they do not substitute for the production source.
- `commerce.js`: Earn map-and-list layout consuming the contract above.
- `lib/commerce/earn.mjs`: reports `map.status: unavailable` in the absence of a member-scoped projection. The newly added local Central demo can supply a fictional HSR residence and four verified-for-demo workplace pins. Production projection remains unimplemented. The frontend alone is not the authorization layer.
- `commerce-categories.js`: Lucide icons matching Central, with bundled license and no React payload for the static storefront.

Current local branches are `codex/member-commerce-pilot` (NiaSave) and `codex/niasave-commerce-pilot` (Central). Integrate without overwriting other Central work. No production deployment was performed.

## Acceptance checks for Claude

- A checked-in member sees their actual studio; a member with only a reservation sees `studio_missing`. A second member never receives the first member's residence.
- Updating the studio pin or current residence in Central changes the next fresh member result. A Central closed/filled/paused/expired mandate disappears and cannot receive a new application.
- Unknown, stale, ambiguous and failed sources remain distinguishable from a fresh empty result. Missing coordinates never become zero or a city centroid.
- Concurrent application retries yield one canonical record. Central's status update appears on the member account using the same reference.
- No production preview rows, public roster fields, independent inventory/price ledger or browser activation switches.
- Unauthorized, non-KYC, suspended and revoked members cannot retrieve private APIs. Enrolment/recovery cannot be completed from possession of a phone number alone.
- Test at 390×844 and desktop: map keyboard controls, marker-to-card selection, overlap cases, pinch/scroll behavior, offline tiles, reduced motion and all pilot languages. Keep OpenStreetMap attribution visible; no tile prefetch/offline bulk download. Select a production tile provider if expected usage exceeds the public service's policy/capacity.

Reference: [WebAuthn](https://www.w3.org/TR/webauthn-3/), [Leaflet](https://leafletjs.com/reference.html), [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/).

## Connected demo added at user request

Central now supplies local-only fixture mandates through `member-commerce-demo.server.ts` and an admin **Load demo records** action. The NiaSave signed gateway accepts that action only in explicit local preview. The demo member residence references the existing HSR catalogue studio; the residence assignment and workplace coordinates are synthetic. Seeded applications, goods orders and Nest reservations use the existing shared operation books. The full setup script is `NiaSave/scripts/load-connected-demo.py`. It verifies preview mode, is safe to rerun without duplicate records and touches only localhost. Demo state is in memory and must be repopulated after restarting the API. This does not implement production KYC, passkeys, live mandate sync, Send or insurance.
