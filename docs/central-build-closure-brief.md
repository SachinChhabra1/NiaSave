# Claude brief: close the Central ↔ NiaSave integration

Current naming and ownership: [Para 2 naming contract](para2-naming.md). This supersedes retired operation names and any conflicting KYC ownership below.

8 September 2026 · Build instruction and acceptance brief

## Outcome

Finish NiaSave as the member transaction surface governed by **2 Para in Rafiqi Central**. Operators control the service from Central; members browse, reserve, apply and follow status in NiaSave. Every action must use the same canonical records and references.

The four existing 2 Para units in Central are **Sikh, Jat, Dogra and Assam** (`src/lib/two-para.ts`). They are not the four LESS navigation tabs. Implement the responsibilities below using the current unit structure:

| Central unit | Responsibilities to expose/control | NiaSave experience |
|---|---|---|
| **Jat — Living operations** | Studios, current check-ins/residence, verified pins, bed inventory, rates/deposit/terms, holds, bookings, cancellations, check-in/out, approved property photos | **Live**, Nest reservations/history; the home location anchoring Earn |
| **Sikh — Save operations** | Product/category catalogue, packs, prices, inventory/holds, pickup and delivery eligibility/windows, orders, preparation, handover, merchant UPI verification, reconciliation, returns | **Save**, bag, Pickup/Delivery toggle and order history; insurance availability/approved content when integrated |
| **Dogra — Enterprise demand** | Verified employer/workplace demand and its link to open Walk2Work mandates; role, pay, shifts, positions, expiry, publication and withdrawals | **Earn / Walk2Work** job cards, map and applications. Preserve the Walk2Work operating workflow; make its demand ownership explicit under 2 Para |
| **Assam — Member acquisition** | Stable member identity and onboarding/activation linkage; connect the authoritative KYC result, active/suspended status, theatre and eligibility, credential enrolment/recovery controls | Access to all member services, member context and application eligibility. Acquisition/qualification alone must not be treated as completed KYC |

**Send is a payments-bank integration, not a fifth unit or a replacement for Assam.** Its partner configuration and activation belong to authorized Central administration, using the shared member identity and finance controls. Leave it disabled until the bank integration is complete. Insurance remains disabled until approved insurer products, disclosures, eligibility and servicing are integrated.

## Start from the shared work

These branches are now on GitHub:

- [Central: codex/niasave-commerce-pilot](https://github.com/SachinChhabra1/rafiqi-central/tree/codex/niasave-commerce-pilot)
- [NiaSave: codex/member-commerce-pilot](https://github.com/SachinChhabra1/NiaSave/tree/codex/member-commerce-pilot)

Read the latest branch heads and the earlier `docs/central-member-map-contract.md` / `docs/niasave-member-map-handoff.md` before changing contracts. Do not overwrite the member UI or create a second implementation alongside it.

Present: Central `/member-commerce?line=live|earn|save|send`, `src/lib/member-commerce.server.ts`, the server-signed NiaSave `/api/central/commerce` operation gateway, existing Save/Living operation books, durable/idempotent reservation/application logic, the Earn map renderer and connected local demo fixtures.

Still incomplete: the live member-residence/mandate projection, complete unit-owned editing/publication controls, production KYC/passkey access, approved production media and production integration verification. Local demo success is not production readiness.

The existing canonical operations runtime currently lives partly in the NiaSave repo. Central must own the operating controls and authoritative records; this does not justify copying those records into another ledger. Reuse that runtime behind Central or migrate ownership once with preserved IDs and reconciled history. Do not maintain two writable books.

## Build sequence

### PR A — records and operator controls

Extend the existing Jat and Walk2Work screens as already proposed: verified WGS84 studio/workplace pins; null coordinates stay null; one effective checked-in residence per member with an operator exception queue; mandates per workplace with explicit state, positions, verification evidence and revision. Join by stable IDs, not names, phone numbers or city strings.

Wire the four 2 Para unit cards to their relevant member controls and source health. Readers view; operators act within assigned units/theatres/locations; admins publish privileged configuration and perform finance actions. Enforce the same permissions server-side. Do not inherit a development auth-off flag in production.

Expose catalogue, pricing, stock/holds, delivery serviceability, expiry/cancellation terms, member eligibility, support ownership, approved content/translations and feature switches from Central. Disable duplicate staff publication routes outside that governed path. The member UI's mode toggle requests Pickup or Delivery; Central determines available locations/modes and the final quote.

### PR B — read projection and freshness

Implement the authenticated **Central → NiaSave member projection** and the NiaSave server adapter that reads it. The existing signed gateway currently accepts **Central-to-operations commands**; a reverse-direction read endpoint still needs to be implemented. Do not describe it as already built.

Reuse server-only signing and key management, with direction-specific signing context, timestamp/nonce/replay checks and strict service authorization. Derive the member ID from a verified session, not a browser parameter. Return only the member's own residence, eligibility and approved eligible jobs in their theatre.

Honor the existing Earn contract: `map.status` is `ready`, `studio_missing`, `unavailable` or `stale`; `asOf` is the successful authoritative source refresh timestamp. An empty jobs array means no matches only with a fresh successful source. Use bounded server-side caching and invalidation; no operator browser tab should have to remain open. Reject new actions when the necessary source cannot be validated.

All tabs need explicit loading, stale, unavailable and empty states. Central must show integration health and actionable failures per unit, including last successful sync and failed publication/action references.

### PR C — writes and feedback

Complete member intents through the existing canonical operation services: Nest reserve/cancel, essentials reserve/fulfil/return, Walk2Work apply/update, support and recovery cases. Use server prices/availability, revision checks, scoped permissions, exact idempotency and durable acknowledgement.

Recheck vacancy status, positions, eligibility/KYC and revision before a new application. Return 409 for changed or withdrawn mandates. Test closure between read and submit. Preserve an already-successful request's exact retry and historical application snapshot after closure. Central updates must appear against the same member reference.

Keep network calls outside retryable database/CAS callbacks. Model reservation expiry/release, stock returns and failed handover explicitly. A scan, a reservation and a payment are different events. No online payment gateway is required for this build: physical merchant UPI at handover/move-in is verified and reconciled by the authorized team.

### Separate access workstream — must finish before production member access

NiaSave is a website saved to the phone's home screen. It cannot safely generate its own independent login OTP before authentication. Use the separately proposed passkey approach only after resolving synced credentials and shared-phone policy.

Connect Assam's onboarding/member reference to the authoritative KYC and identity service. Implement audited first enrolment, active-member checks on every protected API, suspension/revocation, changed-number and lost-device recovery. No public catalogue/job/location access if the member-only KYC rule is in force. Do not assume an OTP contract or preview login satisfies this gate.

## Property media and presentation

Give every displayed Nest distinct media. The current local cards use illustrative artwork; their labels must remain clear. **Jat must own the production media records and publication**, keyed to the canonical studio ID, including image URL/asset ID, alt text, order, approval, source/rights and whether the image is an actual property photo or illustrative. NiaSave should render approved published media without maintaining a separate property gallery.

Use real verified location photos before describing the video as showing actual accommodation. Do not infer amenities from generated artwork. Preserve light theme, dark readable type, grey Nia branding, responsive layouts, the header above categories, the bag mode toggle and the same member experience across screen sizes.

## Acceptance and handover

- A Central unit change to an approved offer, price, inventory, current residence, mandate or service switch is reflected in NiaSave within the documented freshness bound.
- A member cannot retrieve another member's residence/history, select an unauthorized location or bypass KYC/role checks through a direct API call.
- Reserve → prepare → handover → verify merchant UPI → reconcile uses one order/reference. Retries never duplicate orders, bookings, applications or financial entries.
- A changed/closed/filled mandate cannot accept a new application; historical references and already-completed retries remain retrievable.
- Source failure never turns into invented availability, silently fresh data or a false “no jobs” state. Preview records cannot reach production.
- Repeated Live → Earn → Save → Send navigation, category selection, bag actions and map cleanup work on phone and desktop without console errors. Test weak network, offline/retry, expired sessions and changed-phone recovery.
- All currently enabled journeys pass end-to-end against durable storage. Send/insurance are visibly disabled until their real integrations are ready.
- Deliver PR links, contract/migration notes, environment variable **names only**, test evidence, remaining blockers and a repeatable demo setup. Keep the live-source work and local synthetic demo distinguishable.

## Investor-video readiness

After the enabled functionality and backend integration pass the checks, prepare a repeatable walkthrough: verified member sign-in → Live with distinct Nest images → current Nest and nearby Walk2Work jobs → member application and Central status update → Save categories, Pickup/Delivery, reservation and Central fulfilment → member history with matching references. Show Send/insurance as forthcoming if still inactive. Record only after an uninterrupted rehearsal on the final build. Creating the video itself is a subsequent task.


## NiaBooks follow-on

Send now includes a Central-controlled financial-statement demo and optional experimental cash-flow indicator. Read [niabooks-central-brief.md](niabooks-central-brief.md) for the additional data contract, reconciliation, consent, validation and launch requirements. Production financial sources and scoring remain disabled.
