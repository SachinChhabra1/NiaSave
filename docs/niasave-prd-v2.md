# NiaSave: the member app

## Product requirements, build-ready

For: Codex and Claude Code · Reviewer: Sachin · Date: 13 September 2026 · Version 2 (regenerated)

Scope: the whole member app. Home plus the four member journeys Live, Earn, Save, Send. Written at engineer-executable depth: every screen has a contract, a degraded state and named acceptance tests.

Companion documents: `rafiqi-central-console-prd.md` (the staff console), `grok-build-gates-central.md` (Central's build order and gates). Where this document and either of those disagree on a member-facing contract, this document governs; where they disagree on what Central owns, Central's PRD governs.

---

## 0. The one sentence

**NiaSave collects orders. Central decides everything.**

A member tap is a claim, not a transaction. NiaSave captures intent, hands it to RafiQi Central, and renders the state Central hands back. It does not price, allocate, schedule, reserve, approve or settle anything, ever, including when the network is down.

---

## 1. Why this build exists

NiaSave today holds fragments of a second brain: its own Save book, its own catalogue reads, staff routes that can write a price, a local notion of what is available. Central is being rebuilt as the operating authority for the whole company. Two writable books for the same fact is the failure mode that ends with a member being told one price on the phone and charged another at handover, and with no single record anyone can be held to.

This build removes the second brain. What is left on the phone is a renderer, a bounded cache and a queue.

**Sequence.** Central finishes first. Then NiaSave is built against these contracts. Not in parallel. The single exception, to be done now regardless, is **N0** below.

---

## 2. The twelve locks

Break one and the PR is rejected regardless of everything else.

**L1. NiaSave collects orders only.** The app captures member intent and renders returned state. No decision logic on the phone.

**L2. All brains sit in Central.** Pricing, stock, serviceability, PIN coverage, eligibility, allocation, reservation expiry, holds, reconciliation, and delivery scheduling. Delivery windows and pickup slots are computed wholly in Central. NiaSave never computes one, never suggests one, never defaults one.

**L3. One writable book.** Central is the sole writer of every operating record. The NiaSave Save book becomes a read cache, not a book. NiaBooks personal entries move to Central ownership; until each cutover, NiaSave's runtime is the sole writer of that one table and the cutover is a real migration with preserved IDs. Never dual-write. Never describe a migration as a no-op.

**L4. No duplicate staff write routes.** Any NiaSave route that accepts a price, stock level, serviceability flag, PIN coverage or publication switch is a contract violation, not a cleanup item. Closed in N0, before anything else.

**L5. Two phone-only exceptions, both about the device, neither about logic.**
  (a) A bounded, revision-stamped read cache that refuses to render data past its freshness rule.
  (b) An unsynced queue that holds a tap on the device until it reaches Central. Nothing is decided locally, nothing is confirmed locally, nothing is priced locally.

**L6. Month, not week.** The member's planning unit is one calendar month. One versioned plan per member per calendar month. No weekly plan, no rolling 30 days, no pay-cycle variant.

**L7. The card rule.** One member action per card. Every card carries: what it is, its state, its as-of time, and what happens next. A card that cannot say what happens next is not shipped.

**L8. Honesty labels.** Every figure renders with its source and its freshness. Estimated, unverified, stale, partial and unknown are visible words, not silent omissions. A number never renders as verified unless Central returned it verified. "Not in source" is a valid and preferred display value.

**L9. The service boundary is member-facing.** Every member action needs a Central round trip, so Central's availability is the member's experience. Every screen has a defined degraded state, specified per screen below, and none of them is a blank page or a spinner without a deadline.

**L10. No money moves in NiaSave.** Send is dark. Online payments are off. Insurance is off. Goods may settle at handover against the merchant's UPI scanner, with operator verification recorded in Central, and the app shows that as a settlement record, never as a payment it processed.

**L11. Member identity is Central's.** Access state, KYC state and enrolment live in Central (KYC collected in the Living Unit enrolment form; the identity unit links to that record and does not certify it separately). NiaSave holds a session, nothing more. Central staff login is a separate system from member identity. No external KYC vendor is invented.

**L12. Five languages, low-end phone.** Every string ships in English, Hindi, Kannada, Marathi and Tamil before the screen ships. Nothing goes to members English-only. The device budget in §5.7 is a gate, not an aspiration.

### Terminology (enforced in code and copy)

Member or Nian, never resident or tenant. Nest, never bed. Studio for the physical site only. Membership fee, never rent. Service request, never complaint. Membership activation and end, never check-in or check-out. Member navigation is **Live · Earn · Save · Send** and does not change.

---

## 3. Who this is for

A migrant worker earning ₹15,000 to ₹25,000 a month, on a low-end Android phone, often on a weak connection, reading his third language. He opens the app standing up, with one hand, in under a minute, usually to answer one question: what do I owe, what can I earn, what did I keep.

Design consequences, each of which is testable below: default paths over choices, daily and weekly amounts alongside monthly ones, one action per card, no jargon, no empty states that blame him, a call button reachable from every screen, and nothing that requires him to understand Nia's internal structure.

---

## 4. The Central gate: G1 to G12

Each module of NiaSave is blocked until its Central contract is **verifiable**, meaning: the endpoint exists on Central's production surface, its response shape is fixed and documented, its failure modes return the agreed error envelope, and a signed call from a NiaSave environment returns real data for a real member. A mock is not a gate pass. A branch is not a gate pass.

The transport for all of it is the existing signed service boundary: `POST /api/service/member` on Central, direction-specific signing context `niasave-to-central-v1`, nonce table for replay, member identity taken from the verified session subject and never from the request body.

**Seven service kinds.** The member boundary exposes exactly seven kinds. Adding an eighth is a PRD change, not an implementation detail.

| # | Kind | Returns / does |
|---|------|----------------|
| 1 | `member.profile` | Identity, language, residence, membership state, access and KYC state |
| 2 | `live.projection` | Nest, Studio, membership fee position, service requests, Living notices |
| 3 | `earn.projection` | Studio pin, workplace pins, published mandates, pay and commute estimates |
| 4 | `save.projection` | Catalogue, price, stock, serviceability, PIN coverage, counter and delivery availability |
| 5 | `claim.write` | Every member intent: booking, order, application, service request, support case |
| 6 | `claim.status` | State of one or many claims, with the operator-visible next step |
| 7 | `books.plan` | NiaBooks dated entries and the month plan, read and write |

| Gate | Blocks | Passes when |
|------|--------|-------------|
| **G1** | Everything past N1 | Service boundary live in production: signed envelope verified, nonce replay rejected, member resolved from session subject, error envelope fixed, rate limit documented |
| **G2** | Any authenticated screen | Member session and access state: enrolment, passkey sign-in, KYC state readable, recovery path defined, revocation takes effect within one cache window |
| **G3** | Home, all modules | `member.profile` returns language, residence, membership state, access state, with `asOf` |
| **G4** | Live (N3) | `live.projection` returns Nest, Studio, fee position and service requests from Central's records, with source health |
| **G5** | Earn (N4) | `earn.projection` returns the member's Studio pin and published workplace mandates with explicit publication status, mandate revision, straight-line km, and commute estimate carrying route, mode, both directions, source and expiry |
| **G6** | Save (N5) | `save.projection` returns catalogue, price, stock, serviceability and PIN coverage as Central's only copy, with all NiaSave staff write routes already closed (N0 verified) |
| **G7** | Any claim (N5, N6) | `claim.write` accepts an idempotency key plus the revision the member saw, returns 409 with the new revision when it changed, and is proven non-duplicating under a race test |
| **G8** | Claim tracking (N6) | `claim.status` returns the agreed state machine (§5.4), each state with an operator owner in Central and a member-readable next step |
| **G9** | NiaBooks and plan (N7, N8) | `books.plan` reads and writes dated entries and one versioned plan per member per calendar month, integer paise, coverage labels, corrections preserved with audit history, no duplicate rows against confirmed receipts |
| **G10** | Nia health (N9) | Central owns the calculation, its version, completeness and consent; the score is returned labelled experimental and is separable from any lending eligibility |
| **G11** | Help and support (N10) | Support cases: `financial_support_operator` permission bootstrapped from an env allowlist (empty list denies), case states persisted, durable outbox to the partner, signed partner callbacks, and the member-visible status path proven end to end |
| **G12** | Every screen | Freshness and degraded state: every projection carries `asOf` and `source.status`, the renderer refuses data past its freshness rule, and each screen's degraded state renders correctly with the boundary down |

**Gate evidence format.** One line per gate: kind, Central SHA, sample request and response captured against production, the failure case captured, and the date. A gate without a captured failure case does not pass.

---

## 5. Shared runtime specification

Every screen inherits this. Implement once, in `lib/runtime/`, and test once.

### 5.1 The read cache

- Every projection response carries `asOf` (source refresh time, not fetch time), `revision`, and `source.status` of `ready`, `partial`, `stale` or `unavailable`.
- Freshness rule per kind, enforced by the renderer, not the fetcher:

| Kind | Fresh | Render past fresh? |
|------|-------|--------------------|
| `member.profile` | 60 min | Yes, with a stale label |
| `live.projection` | 15 min | Yes, with a stale label |
| `earn.projection` | 5 min | **No.** Refuse, show the refresh action |
| `save.projection` | 5 min | **No.** Refuse, show the refresh action |
| `claim.status` | 2 min | Yes, with a stale label, and never for a state change |
| `books.plan` | 15 min | Yes, with a stale label |

- "Refuse" means: the screen renders its frame and a single honest card saying the information is too old to show and offering one action. It never renders a price, a slot or an availability from a refused payload.
- The cache is keyed by member and kind, is cleared on sign-out and on access revocation, and is capped (§5.7).

### 5.2 The unsynced queue

- A tap that cannot reach Central is written to a durable device queue with its idempotency key, the revision the member saw, and the local timestamp.
- The member sees the state **Unsynced**, in plain words: not sent yet, we will send it when the phone is back online, nothing is confirmed.
- The queue retries with backoff, drains in order, and never invents a result. A queued item that fails on the server surfaces the server's reason.
- A queued item older than 24 hours is surfaced for the member to resend or cancel, never silently dropped, never silently sent.
- The queue holds intent only. It never holds a price, a slot, a total, or any computed outcome.

### 5.3 Idempotency and conflict

- Every `claim.write` carries `idempotency_key` (client-generated, stable across retries) and `seen_revision`.
- Central returns 409 with the current revision when what the member saw has changed. The app then re-renders the new state and asks the member to confirm again. It never resubmits silently, and never auto-accepts a changed price.
- Replaying the same key returns the same claim, never a second one.

### 5.4 The claim state machine

One machine for every member intent (booking, order, application, service request, support case). States, each with a member-readable line:

```
drafted     (on device, not sent)
queued      (unsynced, waiting for the network)
submitted   (sent, awaiting Central)
received    (Central has it, not yet decided)
accepted    (Central said yes; carries what happens next and when)
declined    (Central said no; carries the reason in plain words)
scheduled   (a window exists; the window came from Central)
fulfilled   (delivered, handed over, placed, or resolved)
settled     (money accounted for, where money applies)
closed      (nothing further)
superseded  (what the member saw changed; needs re-confirmation)
expired     (the claim timed out in Central)
```

Legal transitions and their owners are Central's; NiaSave renders whatever arrives and treats an unknown state as `received` with an honest "we are checking" line rather than crashing.

### 5.5 The seven universal states

Every card and every screen renders exactly one of:

1. **Loading**, with a deadline (see §5.7) after which it becomes Unavailable.
2. **Ready**, with `asOf`.
3. **Stale**, readable, labelled, with a refresh action.
4. **Unavailable**, the source is down, with what the member can do instead (call, visit the Studio, come back).
5. **Unsynced**, the member's action is on the phone and not yet sent.
6. **Empty**, nothing exists yet, phrased as a next step, never as a failure of the member.
7. **Blocked**, access or KYC gate, with the exact next step and who to contact.

No screen may render a blank area, an infinite spinner, or a silent zero.

### 5.6 Language and copy

- Five languages: en, hi, kn, mr, ta. A missing string fails the build, it does not fall back silently to English at runtime.
- Copy rules: sentence case, short sentences, no Nia internal vocabulary (no unit names, no funnel names, no "projection", no "mandate" as a member-facing word), amounts in rupees with the daily or weekly equivalent where the member's decision is daily, dates as weekday plus date.
- A call action is present on every screen. Numbers come from `member.profile`, never hardcoded.

### 5.7 Device budget (gate, not aspiration)

| Measure | Budget |
|---------|--------|
| First contentful paint, mid-tier Android, 3G | ≤ 2.5 s |
| Interactive | ≤ 4.0 s |
| JS shipped per route, gzipped | ≤ 120 KB |
| Total app shell, gzipped | ≤ 250 KB |
| Loading state deadline before Unavailable | 8 s |
| Cache footprint | ≤ 5 MB per member |
| Offline behaviour | App shell and last-good non-refused projections render; every action queues |

Maps: the local Leaflet build stays local, tiles are bounded, and the Earn map degrades to a distance-sorted list when tiles fail. A list is an acceptable map. A broken map is not.

### 5.8 Security

- Session cookie, HttpOnly, SameSite, short-lived, refreshed server-side.
- The service key never reaches the browser. All Central calls are server-to-server from NiaSave's own server routes.
- No member data in logs beyond a member id and a claim id.
- Access revocation in Central takes effect within one cache window, and immediately on any write.

---

## 6. Screens

Navigation: **Home · Live · Earn · Save · Send**, plus Help reachable from every screen. Send renders as present and off (§6.6).

### 6.1 Home

**Purpose.** Answer the three questions in one screen: what do I owe, what is happening today, what do I need to do.

**Contract.** `member.profile` plus a summary slice of `live.projection`, `claim.status` (open claims only) and `books.plan` (this month's headline).

**Content, in order.**
1. Greeting with the member's name and his Studio.
2. **This month** card: membership fee position (due, paid, next date), rendered from Central. If not in source, it says "not in source" and offers the call action.
3. **Needs you** list: claims in `superseded`, `declined`, `unsynced`, or awaiting member consent. Each is one card, one action.
4. **Today** card: anything dated today from Live or Save (a delivery window, a service request visit, a counter timing). Windows come from Central only.
5. Four journey tiles: Live, Earn, Save, Send (Send visibly off with its reason).
6. Help and call.

**Degraded.** Boundary down: greeting and journey tiles render from cache, every money figure is replaced by the Unavailable state with the call action. Never a stale fee figure without its label.

**Acceptance tests.**
- **A1** Home renders with every projection unavailable: no blank regions, no spinner past 8 s, call action present, no money figure shown without a state label.
- **A2** A member with no open claims sees the Empty phrasing as a next step, not as an error.
- **A3** Every figure on Home carries an `asOf` in the DOM, and a stale figure carries a visible stale label.

### 6.2 Live

**Purpose.** The member's Nest, Studio and membership, and the ability to raise a service request.

**Contract.** `live.projection` read, `claim.write` and `claim.status` for service requests.

**Content.**
- Nest and Studio card: Studio name, Nest identifier, membership state, activation date. Physical address and the Studio contact.
- Membership fee card: amount, period, what is included, next date, position. Central's figures only.
- Service requests: list with state and next step, plus a raise flow with a category, a free-text line, an optional photo, and no promised timeline unless Central returned one.
- Living notices from Central (water, power, visitors, safety) as dated cards.

**Rules.** No visit window is shown unless Central scheduled it. Categories come from Central, not a hardcoded list. The word complaint never appears.

**Degraded.** Nest and Studio render from cache with a stale label up to 15 minutes; fee position never renders past refusal without its label; a new service request always queues.

**Acceptance tests.**
- **A4** Raising a service request offline produces exactly one claim after the queue drains, verified by idempotency key replay.
- **A5** A service request rendered anywhere shows a state from §5.4 and a member-readable next step, or "we are checking".
- **A6** No visit time appears on any service request that Central has not scheduled.
- **A7** Copy audit: the strings "complaint", "rent", "bed", "tenant", "check-in" appear nowhere in the Live bundle, in any of the five languages.

### 6.3 Earn

**Purpose.** Work near where the member sleeps, and the honest cost of getting there.

**Contract.** `earn.projection`, `claim.write` (application), `claim.status`.

**Content.**
- Map anchored on the member's current Studio marker, with numbered workplace pins. No GPS, no device location permission.
- Job cards sorted nearest first, each carrying: what the work is, the workplace, straight-line km, pay as published, commute estimate, and the apply action.
- Pay display: published pay only, explicitly distinct from any employer CTC figure. Anything not verified is labelled.
- Commute estimate renders only when Central supplies route, mode, both directions, cost, source and expiry. Past expiry it renders as unknown, never as a number.
- Applications list with state.

**Rules.** Only mandates Central has explicitly published are visible. Publication status is Central's field, not an inference. `flow_demand` is not a source of mandates. An application carries the mandate revision the member saw and 409s on change.

**Degraded.** Past the 5-minute freshness rule the projection is refused: the screen shows one card explaining the listings are too old to show, plus refresh and call. Map tiles failing degrades to the distance-sorted list. `map.status` of `studio_missing` renders a specific line: we do not have your Studio pin yet, here is who to contact.

**Acceptance tests.**
- **A8** With `asOf` older than 5 minutes, no job card, pay figure or commute figure renders anywhere in the DOM.
- **A9** `map.status = studio_missing` renders the named contact path and zero job cards.
- **A10** Applying against a changed mandate revision returns 409 and the member is shown the new terms and asked to confirm again; no application is created by the first submit.
- **A11** A commute estimate past its expiry renders as unknown, with route and mode absent rather than guessed.
- **A12** Pay never renders adjacent to a CTC figure without the distinguishing label; a snapshot test covers all five languages.

### 6.4 Save

**Purpose.** Buy the essentials of daily life at a price the member can see before he commits, and know when and where he gets them.

**Contract.** `save.projection`, `claim.write` (order), `claim.status`.

**Content.**
- Categories and items, each with price, pack size, and the daily or weekly equivalent where it helps the decision.
- Availability comes from Central: stock, serviceability for the member's Studio and PIN, counter availability, delivery availability.
- Cart, then a review screen that shows exactly what Central will be asked to accept: items, quantities, price as seen, revision, and the words that this is a request, not a confirmed order.
- Order tracking with state, and, where Central scheduled one, the delivery or pickup window.
- Settlement at handover: where the member pays the merchant's UPI scanner, the app shows the settlement record Central created after operator verification. The app never initiates, confirms or reconciles a payment.

**Rules.** NiaSave never computes a delivery window, a substitution, a discount, a total override or an availability. Out of stock and not serviceable are Central's answers, shown plainly with the nearest alternative only if Central returned one.

**Degraded.** Past 5 minutes the catalogue is refused, with the counter timing and the call action offered instead. An order placed offline queues, and the review screen says plainly that price and availability will be re-checked when it is sent.

**Acceptance tests.**
- **A13** No price, stock or serviceability value in the Save bundle originates anywhere but `save.projection`; a source audit test asserts no local catalogue, no local price table, no local availability rule.
- **A14** With `asOf` older than 5 minutes, no item price renders.
- **A15** Placing the same order twice with one idempotency key creates exactly one claim; a concurrent race test proves it.
- **A16** A price change between review and submit produces 409, the new price, and an explicit re-confirmation. No order is created at the old price.
- **A17** No delivery or pickup window renders unless `claim.status` carried one from Central.
- **A18** The settlement card renders only from Central's verified settlement record, and never from any client-side event.

### 6.5 Claims and requests (My requests)

**Purpose.** One place where every member action lives, whatever journey created it.

**Contract.** `claim.status`.

**Content.** A single list across Live, Earn, Save and Help. Each row: what it was, when, its state, what happens next, and who is handling it where Central names an owner. Filters: needs you, in progress, done.

**Acceptance tests.**
- **A19** Every claim created anywhere in the app appears in this list within one cache window.
- **A20** Each row renders a state from §5.4 and a next step; an unknown state renders the checking line and does not break the list.
- **A21** Unsynced items are visually distinct and carry resend and cancel actions after 24 hours.

### 6.6 Send

**Purpose.** Present and honest, and off.

**Content.** One screen: what Send will do (money home, through a payments-bank integration), that it is not available yet, and what the member can do today. No form, no amount field, no partner logo, no waitlist that implies a date.

**Acceptance test.**
- **A22** The Send route contains no input that accepts an amount or a beneficiary, and no outbound link that starts a transfer anywhere.

### 6.7 NiaBooks

**Purpose.** What came in, what went out, what he kept. The member's own book, combining what Nia already knows with what he tells it.

**Contract.** `books.plan`.

**Content.**
- Dated entries: confirmed Live and Save receipts from Central, plus member-entered earnings and expenses, each with a visible source label (from Nia, entered by you).
- Add, correct and delete member entries, with correction history preserved, never a silent overwrite.
- Monthly view first, with the calendar month as the unit.
- Deposits are shown separately from membership fee. Live receipts are never promoted into verified income.
- Integer paise throughout. No floats anywhere in the path.

**Acceptance tests.**
- **A23** A confirmed receipt from Central and a member entry describing the same payment do not double count; the duplicate rule is asserted in a test.
- **A24** Correcting an entry preserves the prior value and its timestamp, and the member can see both.
- **A25** Every amount in the books path is integer paise from API to render; a lint or type test asserts it.

### 6.8 My plan this month

**Purpose.** One plan, one month: what he expects to earn, what he must spend, what he wants to send home, and where the gap is.

**Contract.** `books.plan`.

**Content.**
- One versioned plan per member per calendar month: expected net income (including amounts already received), essentials, debt, emergency savings, other, remittance target. Category amounts and due dates. Integer paise.
- Actuals come from NiaBooks, with coverage labels (how much of the month is actually recorded).
- The remittance estimate shows the shortfall plainly where one exists. No automatic transfers, no nudging into a product, no implied commitment.
- Editing creates a new version; the prior version stays readable.

**Acceptance tests.**
- **A26** Two plans for the same member and calendar month cannot exist; the second write versions the first.
- **A27** A month with partial actuals renders its coverage label, and the shortfall is shown rather than smoothed.

### 6.9 Nia health (read-only, experimental)

Renders only what Central returns: the score, its calculation version, its completeness, and the consent state. Labelled experimental everywhere it appears. It is never a gate on anything the member can do in the app, and it is never presented next to a loan offer. NiaSave computes nothing.

### 6.10 Help, and support for loan harassment

**Purpose.** The member can ask for help, and something happens.

**Contract.** `claim.write` and `claim.status`, case kinds for enquiry and for harassment complaint, held in separate queues in Central.

**The target flow** (the current button that only opens a partner website is the gap this closes):

```
member reports  →  Central case created  →  operator review (named, accountable)
                →  member consent captured  →  partner referred
                →  partner acknowledges     →  status back to NiaSave
```

**Rules.**
- Help works with no Nia health score, no KYC, and no membership state. It is never gated.
- Referred means the referral was actually delivered. Acknowledged means the partner actually acknowledged. Neither word appears on a state that has not happened.
- The member sees the case state and the fact that a named person owns it, without seeing internal staff structure.
- Consent is explicit, recorded, and revocable, and nothing leaves Nia before it exists.
- Partner integration (the planned harassment-support partner, and any lending partner) stays off until contracts, connector, consent and ownership all exist. Until then the flow ends at Central with an honest state: we have your case, a person is on it.

**Acceptance tests.** Covered by A19 to A21 plus the G11 gate evidence: a case moves end to end through a test partner, and with the partner disabled the member still reaches `received` with an owner.

---

## 7. Build order

| Step | Work | Blocked by |
|------|------|-----------|
| **N0** | Close every NiaSave route that accepts a price, stock, serviceability, PIN coverage or publication write. Inventory them, remove or hard-disable them, prove it with a route audit test. | Nothing. Do this now, before Central finishes. |
| **N1** | Shell: navigation, five languages, session, the seven universal states, the read cache, the unsynced queue, the claim state machine, the error envelope, the device budget harness. | G1, G2 |
| **N2** | Home | G3 |
| **N3** | Live | G4 |
| **N4** | Earn | G5, G7 |
| **N5** | Save, browse and claim | G6, G7 |
| **N6** | My requests | G8 |
| **N7** | NiaBooks | G9 |
| **N8** | My plan this month | G9 |
| **N9** | Nia health, read-only | G10 |
| **N10** | Help and support cases | G11 |
| n/a | Send stays dark throughout | n/a |

G12 applies to every step and is re-checked at each one.

**Definition of done, per step.** One durable record per member action, operable by a named role in Central, visible in NiaSave after a full app restart, in all five languages, within the device budget, with the degraded state captured on video or screenshot. Anything less is not done.

---

## 8. What this removes from NiaSave

Listed explicitly so the deletions are not mistaken for regressions:

- The local Save book as a writable store (becomes a cache).
- Any local catalogue, price table or availability rule.
- Any staff-facing publication or write route.
- Any client-side delivery or pickup window computation.
- Any local reservation, hold or expiry logic.
- Any local eligibility or scoring logic.
- `flow_demand` as a source of member-visible work.

Each deletion ships in the same commit as its replacement, with the destination named.

---

## 9. Open decisions for the founder

Eleven, each one a call only Sachin makes. Numbered for reference in the launch log.

**FOUNDER_ASK 1. Availability posture.** Central down means the member cannot act. Do we accept a hard stop (honest, simple), or do we accept queued claims for Save orders with explicit "price will be re-checked" language (usable, slightly riskier)? The PRD currently assumes queue-with-recheck.

**FOUNDER_ASK 2. Sign-in.** Passkeys only, or passkeys with an operator-assisted recovery at the Studio? No SMS fallback is currently assumed. A member who loses his phone must have a path.

**FOUNDER_ASK 3. KYC gate depth.** Which of Live, Earn, Save and Books require an approved KYC state, and which run on submitted? Blocking everything on approved will strand day-one members.

**FOUNDER_ASK 4. Pay display.** Do we show published pay only, or published pay plus a Nia-verified band where we have one? Verified bands are more useful and more expensive to keep honest.

**FOUNDER_ASK 5. Commute cost.** Who owns the return-commute estimate and its refresh cadence, and what happens to Earn when it expires? Currently: renders unknown.

**FOUNDER_ASK 6. Settlement at handover.** Confirm that member-to-merchant UPI at handover, with operator verification, is the only settlement path in v1, and that NiaSave shows it as a record only.

**FOUNDER_ASK 7. NiaBooks cutover.** When do personal entries move to Central ownership, and who signs off the migration with preserved IDs? Until then NiaSave's runtime is the sole writer and that must be stated in the launch log.

**FOUNDER_ASK 8. Nia health visibility.** Does the experimental score show to members at all in v1, or stay internal until the calculation version is stable?

**FOUNDER_ASK 9. Support partner.** Confirm the harassment-support partner is off until contract, connector, consent and ownership exist, and confirm who holds `financial_support_operator` on day one.

**FOUNDER_ASK 10. Languages at launch.** All five at N1, or English and Hindi at N1 with the other three gating N3? The PRD currently assumes all five, always.

**FOUNDER_ASK 11. Who is the member-app owner.** One named person accountable for NiaSave's member experience, distinct from Central's owner, for the duration of the build.

---

## 10. Acceptance summary

The build is acceptable when, against production Central, with a real member account:

1. Every acceptance test A1 to A27 passes, each with named evidence.
2. Every gate G1 to G12 has a pass line with a captured success and a captured failure.
3. A route audit proves zero price, stock, serviceability or publication writes in NiaSave.
4. A source audit proves every member-facing figure originates in a Central projection.
5. The app runs inside the device budget on a mid-tier Android on a throttled connection.
6. Every screen has been seen in all seven states, in all five languages.
7. A full offline-to-online cycle produces exactly one record per member action.
8. No screen shows a number without a source and a freshness label.

A build that passes 2 through 8 and half of 1 is a renderer with a nice navigation bar.
