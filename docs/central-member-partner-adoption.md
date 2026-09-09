# Central member and partner adoption — 9 September 2026

NiaSave uses Central's existing signed service for membership status, enrolment submission, changed-phone requests, partner catalogue, referrals and withdrawal. The signed subject always comes from the server session. Browser fields cannot choose a subject, approval, service kind or new phone identity.

## Member access

Account → Membership status reads `member.status`, including the stable Central member ID and next action. Enrolment submission uses `member.enrol`; changed-phone requests use `member.recover`. Identity documents are reviewed in Jat Unit (Living), under 2 Para; they are not uploaded into the shared showcase.

Submitting either identity request requires a session with a phone verified by the configured identity provider. Its verify response must contain `account.phoneVerified: true` and `account.phone` in +91 format. These fields are accepted only from that server-to-server response. The browser cannot set them. A recovery's new number is this verified phone. Central decides approval and keeps the canonical ID.

The existing showcase account deliberately has no verified phone. It can read its approved Central membership, but cannot submit real enrolment or phone changes. Hosted acceptance covers that restriction; isolated HTTP tests exercise the verified-provider path. Production passkeys, shared-phone policy, and identity-provider integration remain separate launch work. Existing local orders/books still use the legacy authentication-subject owner; a verified canonical-member migration is required before production phone recovery can preserve that older local history. Do not claim the production identity journey is complete.

## Partner requests

Account → Partner services reads `partner.catalogue` and `partner.referrals`. Insurance, the lending/help cards and Send's current-options button link to filtered views of these same records. Consent fields and version come from Central, labels are reviewed in the frontend, and no checkbox is preselected. `partner.refer` stores the consented request; a disconnected partner remains held. `partner.withdraw` closes that request in Central. No local referral ledger and no provider network call is added.

Payment and remittance entries are status-only. A live registry alone does not enable transactions, issue a policy or approve a loan. Actual partner agreements/adapters remain required. Nia health's consent is not a loan decision.

## Verified Save contract

`configure` validates and persists price in paise, opening count, source mappings, verification timestamps, service windows, allowed modes, delivery PIN codes and hold duration. The catalogue and quotes use this price; the server fingerprints it again at reservation. Zero stock and stale verification are unavailable. Counts below already committed quantities are rejected. Completed orders stay deducted from the same beat opening; they are not put back during republishing. Repeated reconciliation acknowledges the already matched order without another settlement.

Delivery requires the verified account's `locationPinCodes[locationId]` to be in the published list. This mapping must be supplied by the identity/access integration from the member's verified residence. A postcode supplied in an order body is ignored. If the mapping is absent, delivery fails closed; pickup stays available in its verified window. Existing preview configurations without Central verification fields retain their preview behaviour.

Central's paired compatibility change reads order-line `sourceSku`/`sourceSiteCode`, and compares the explicit catalogue `opening` rather than incorrectly treating handed-over goods as available stock. Central retains its pre-publication mismatch gate: a different verified price/count still needs an intentional reconciliation with the canonical book before publication.

## Release and evidence

Keep the domain assembler, invitation gate, isolated showcase database and `CENTRAL_ORIGIN` unchanged. New frontend module `commerce-services.js` is included in both standard and assembled builds. Translation coverage includes it for English, Hindi, Tamil, Kannada and Marathi; native-speaker sign-off remains outstanding.

Validation includes 67 commerce tests, build, signed hosted membership/partner reads, a fictional held referral and withdrawal checked independently in Central, and mobile/desktop consent screens in all five languages. The Save contract run uses the actual Central gate/reconciliation and NiaSave book functions against isolated fictional state; it is not a claim that the complete hosted enrolment-to-delivery journey has been certified.
