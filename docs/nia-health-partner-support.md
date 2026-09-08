# Nia health: lower-cost credit and FREED support

## Product intent
NiaBooks should help members build a reliable financial record, explore affordable credit and obtain help when lenders harass them. These are separate journeys. Harassment support must remain accessible without a score, loan eligibility, complete records or score consent. The current experimental cash-flow score is not validated for credit decisions and must not imply guaranteed access or pricing.

## Shipped member interface
Two actions appear alongside Nia health, and also when signed out or records are unavailable. The loan action explains the planned lending-partner assessment and is explicitly not an application. Harassment help explains the pending Nia referral connection and offers a direct link to FREED Shield. Opening the link sends no Nia statement, score or contact payload, and does not create a case. FREED is the planned support partner; do not represent a completed integration or an agreed lending role.

FREED's own service description supports the harassment route: https://freed.care/freed-shield (checked 8 September 2026). Do not promise legal representation, a particular resolution, price or response time based on this link.

## Claude: build in Central
Central must own partner configuration, permissions, consent receipts, case records, referrals, status history and operator queues. NiaSave reads the member projection and submits through the signed gateway. No separate frontend case book or lending decision engine.

1. Add a Send / NiaBooks financial-support queue. Assign an accountable operator role and named owner; do not assume all 2 Para operators may see financial complaints. Model separate loan-enquiry and lender-harassment cases. Gate live referrals using Central configuration once the partner agreement, service scope and connector are ready.
2. Credit: capture requested amount and purpose only after the member chooses to proceed. With separate explicit consent, share a member-reviewed snapshot of verified income, expenses, existing obligations and data coverage with the selected lending partner. Keep self-reported entries labelled; do not silently treat them as verified. Score-display consent is not permission for credit assessment or data sharing. Record source timestamps, calculation version and consent scope. No experimental-score cutoffs or rate promises.
3. Present actual partner offers with lender identity, amount received, APR, charges, EMI, tenor, total repayment and applicable disclosures. Have the lending partner validate the current regulatory requirements before activation. The member chooses whether to apply. Nia health can support the journey only to the extent explicitly accepted and validated by the partner.
4. Harassment: collect lender name, incident date/time, incident description and a safe contact preference. Evidence uploads are optional and permission-restricted. Do not require a score, statement download, loan purchase or new borrowing. Collect distinct consent before sending the agreed complaint information to FREED; do not attach the full NiaBooks statement by default. Do not contact the lender, employer or family automatically.
5. Persist each case before acknowledging it. Suggested states: received, triaged, awaiting_member_consent, referred, partner_acknowledged, in_progress, resolved, closed. Failed delivery stays pending with retry/failed status; a timeout must never be presented as referred. Use a durable outbox, request idempotency, signed authenticated partner callbacks and deduplicated events. Preserve the same Central/member/partner references.
6. Return member-safe status and the assigned support route to NiaSave. Keep internal notes private. Store permissioned evidence separately, with retention/deletion rules, access audit and no public attachment URLs. Implement an operator escalation policy and actual response commitments before promising them in the UI.

## Acceptance checks
- No score and score opt-out still allow harassment help; signed-out users retain public help access.
- No application, complaint or statement sharing occurs just by opening either action.
- Member identity isolation and operator role gates hold for case reads, writes and attachments.
- Consent scopes separate score display, credit sharing and complaint referral.
- Duplicate submit, failed partner delivery, callback replay and out-of-order status cannot duplicate cases or imply success.
- NiaSave shows Central's authoritative status and no locally invented offers, approvals or case references.
- Real lending and FREED integration remain off until contracts, connector, consent and operational ownership are complete.
