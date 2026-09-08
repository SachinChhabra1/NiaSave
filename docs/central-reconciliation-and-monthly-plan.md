# Response to Claude: Central reconciliation and monthly planning

8 September 2026. This is the product/integration direction following your reconciliation. PR #13's description is acknowledged, not an independent code review or merge approval; keep its CI and review gates.

## 1. Use the existing books; define one owner per record

Proceed with your proposed staged split. Central owns residence, mandates, access records, approved media, support cases and, after PR C cutover, applications. The existing runtime retains canonical Living and Save operations, with privileged operator commands governed through Central. Member intents still enter through authenticated NiaSave APIs and the authorized operation services; do not disable member reservation flows when removing duplicate staff publication routes.

Do not migrate Living/Save now. Catalogue publication and fulfilment must use one writable record per entity, with stable IDs. A Central editing screen is not permission to maintain a second independent inventory or payment ledger.

Applications: do not call the migration a no-op merely because the current local records are synthetic. Inventory every environment first. Preserve IDs, historical mandate snapshots, statuses, timestamps and retry keys when importing records. Otherwise obtain an explicit environment-specific reset decision. Cut over the NiaSave adapter and retire the old writer together. Never dual-write.

For PR E, designate Central as the eventual owner of personal NiaBooks entries, their revision history, soft deletions, consent receipts and score calculations. Until cutover, the existing NiaSave runtime remains their sole writer. Source payment receipts remain in their canonical Living/Save books; Central projects them using stable source references rather than copying them into another editable ledger.

## 2. Correct the blocking/security description

The checked local live-sync route only checks authorization when CRON_SECRET is present. Missing configuration currently allows execution; it does not prevent the route running. Fix this immediately: missing secret returns an unavailable response before any sync work; invalid/missing authorization returns 401; a valid request alone reaches sync. Test all three branches. Then configure the production secret and verify the scheduled request. Configuring a secret alone does not fix the code's fail-open behavior.

Neon capacity blocks the affected hosted preview path, not writing code or every local test. Report the exact failed build step, continue type/build/unit checks where possible, and use an explicitly isolated test database if available. Never bypass auth, use production data as a test substitute or delete unidentified Neon branches. The project owner must resolve account activation/capacity or approve specific resource cleanup. Vercel connector visibility is an observability/tool-access issue, not a reason to invent an integration failure.

## 3. PR A.2 and B: source contracts

Proceed with the unit controls, explicit Dogra demand reference, approved Jat media and Assam eligibility/recovery records you listed. Keep all live services off unless configured and authorized.

Verified pins establish locations, not transport routes or fares. Return commute estimates need a usable route, mode, both-direction cost, source, timestamp/expiry, current studio ID and mandate revision. Missing or stale routes produce unavailable estimates. Keep pay distinct from verified CTC. Read docs/earn-map-pay-and-commute.md; existing demo budgets are illustrative and must never be promoted into real fares.

The restricted residence/eligibility/jobs payload is the Earn projection, not the whole integration. Also preserve contracts for member-owned bookings, Save orders, statement entries and cases. No member projection exposes other residents, staff notes or KYC documents.

Implement the reverse server-to-server read endpoint and matching NiaSave adapter together. Use direction-specific signing, service authorization, stable authenticated member context and bounded freshness. No open operator browser tab is required. Specify read/write ownership, schema version, error behavior and invalidation per contract.

## 4. Confirmed KYC owner: Living Unit under Para 1

Sachin has now confirmed: KYC is collected in the member enrolment form, which must be built in the Living Unit under Para 1. This supersedes the earlier unresolved-source assumption. Build that enrolment and review workflow in Central. Do not create a second authoritative KYC record in Assam or NiaSave.

Use one stable member ID across the enrolment record, KYC review, residence/check-in, bookings, orders, statements, applications and future plans. Assam / 2 Para acquisition links to this record; it does not certify KYC separately. Preserve the existing operations unit structure; the enrolment owner is specifically Living / Para 1, even where other Living commercial controls are exposed through 2 Para.

The form captures the approved enrolment fields and required KYC evidence, with purpose/consent and restricted document access. Build explicit draft, submitted, under_review, changes_requested, approved and rejected states, with authorized reviewer, decision timestamp, evidence reference and an audit trail. Form submission or a document upload must never automatically mean verified KYC. Keep access suspension/revocation separate from the historical review decision. Reuse existing member references and provide a duplicate/identity-resolution queue; do not match people by display name alone.

Publish a minimal access result through the authenticated member/service contract: stable member ID, enrolment reference, KYC decision and decision time, active/suspended status, eligibility and theatre. Do not expose raw KYC documents to the NiaSave browser, catalogue projection, partners or general operators. Credential enrolment is available only after the required approved KYC and active-member checks.

Build changed-number and lost-device recovery against this same enrolment identity, with authorized review and audited credential/session revocation. The exact evidence acceptance/reviewer policy and passkey shared-phone/sync policy must be configured before production activation; no external KYC vendor should be invented. Central staff login remains separate from member identity. The home-screen website still needs the agreed authentication implementation.

## 5. PR D: real cases without premature referral claims

Use a named permission such as financial_support_operator, enforced against authenticated staff identities server-side. An environment email allowlist can bootstrap assignments; an empty list denies access. It must not grant all general operators access to financial complaints or evidence.

A durable case queue can be built before FREED is connected. Enable real member submission only when an accountable operator and monitored queue exist. A saved case says received by Nia; referred requires actual delivery and partner_acknowledged requires an actual acknowledgement. Establish contact preferences, consent, ownership, retry behavior and escalation handling. Do not promise a response time without staffed coverage.

FREED is the planned harassment-support partner; do not assume it is the lender. Public help remains available without a score. Complaint referral, credit sharing and score display require distinct consent. Until connected, preserve the direct FREED help link with an honest pending status.

## 6. PR E: preserve the NiaBooks work already built

Read docs/niabooks-dated-entries.md as well as docs/niabooks-central-brief.md. Dated entries and Save receipt population already exist; extend them rather than rebuild them. The latest form uses type-specific purpose dropdowns and preserves legacy free-text descriptions. Add stable Central-owned category IDs without losing existing labels or entries; do not guess ambiguous migrations.

Verified Save payments/refunds populate once. Unpaid reservations do not. Live receipt records currently lack independent verification evidence: do not silently promote them to verified scoring inputs. Deposits need a separate treatment from recurring rent. Personal entries remain self-reported, and partial months remain partial. Preserve member isolation, revision checks, idempotency and corrections.

## 7. My plan this month: agree the contract now, build independently

Do not make planning wait for FREED, live loans or a validated health score. Add a small planning workstream after the member-scoped read/write boundary and durable storage contract are agreed.

Central owns one versioned plan per member and calendar month, not another transaction book. Suggested fields: expected total net income, planned essential expenses, debt repayments, emergency savings contribution, other planned expenses and a member-chosen remittance target. Support category amounts and due dates. Store amounts in integer paise and calendar dates consistently. Expected total income includes income already received; never add actual received income to that total again. Never treat job CTC, borrowing proceeds, refunds or prior savings as earned salary.

Use NiaBooks for actuals, with visible coverage/source labels. Show planned versus recorded amounts separately. Known Live/Save obligations can be suggested from Central and reviewed by the member, not asserted to be paid. Already-paid amounts count toward the monthly category plan; do not subtract both the total plan and those same payments. Do not duplicate a sent-home transaction as both a transfer and a local household expense.

Show an estimated amount available for remittance after planned essentials, debt, emergency savings and other expenses. If the member's target exceeds that amount, show the shortfall; do not hide a negative budget or describe the estimate as available bank cash. Missing income/obligations remain unknown, with a completeness prompt. No automatic transfers, loan applications or credit decisions.

Planning and harassment support do not require score opt-in. The present health formula subtracts remittances before calculating retained money, so sending more home can lower it. Keep the current version explicit; do not use that score as the objective for this planner or quietly change the formula. Review a separate measure of household benefit before any later scoring change.

## Sequence and evidence

Fix cron authorization now; clear/review #13; A.2 plus B (paired with NiaSave adapter); C with explicit writer cutover; access workstream alongside. D and E can be prepared independently where contracts permit. Planning contract and UI need not wait for external partners, but live plan saves require durable Central storage and the access gate.

For each connected slice, demonstrate: member action -> one persisted record -> authorized Central action -> status back on the same member reference -> survival across restart and safe retry. Include cross-member denial, stale source and partner failure tests. Deliver PR links, API/migration notes, configuration names only and honest remaining blockers. Preserve the existing member UI.
