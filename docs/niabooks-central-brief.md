# NiaBooks — Central integration and score brief

8 September 2026 · Extension to the 2 Para / NiaSave build-closure brief

## Member outcome

Under **Send**, NiaBooks becomes the member’s financial statement: earnings received, expenses paid, money successfully sent home, refunds, and the net recorded cash flow. A monthly selector, source/reference detail, downloadable statement and optional Nia health indicator make the information useful to the member. Transfers remain disabled until the payments-bank integration is ready.

The long-term asset is a reliable, consented financial history across employment, accommodation, daily purchases and remittances. Its value depends on reconciliation, coverage, member trust, correction rights and useful partner services. A proprietary score alone does not establish defensibility or creditworthiness.

## Latest dated-entry update

See [NiaBooks dated-entry update](niabooks-dated-entries.md) for automatic canonical receipts and editable member notes, now implemented. It supersedes the original demo-only description below.

## What has been built

- Member-authenticated `GET /api/commerce/books`; Central’s signed gateway supplies a **local-only synthetic projection** via `line=send, action=books-demo`.
- Central Send now has a **Load NiaBooks demo** control. The fixture is authored server-side in Central; the member browser cannot create or change financial entries.
- Three completed months of clearly fictional history; totals calculated on the server in integer paise. Only settled entries contribute. Pending/failed payments do not increase spending or remittances; refunds are shown separately and added back to net flow.
- Monthly statements, expandable source references, CSV export and refresh. No bank-balance claim.
- Optional score opt-in/opt-out through `POST /api/commerce/books/consent`; opt-out hides the score and does not change service eligibility.
- An experimental score with explainable factors and a source-freshness gate. No production import route, production scoring or lending decision is enabled.

**This is a connected demo and implementation foundation, not a live financial-data integration.** Neither the demo salary nor the demo transfers were paid. Published job pay ranges, reservations and payment screenshots must never be converted into received income or verified cash movements.

## Ownership: use the four existing 2 Para units

| Owner | Records and responsibilities |
| --- | --- |
| Dogra / Walk2Work | Employer/payroll linkage, earned-versus-received distinction, verified employer payment references; a job offer or mandate is not earnings received |
| Jat | Settled rent, deposits, refunds and deductions from the canonical accommodation book |
| Sikh | Settled purchases, returns/refunds and eventually insurer premiums; never count a reserved or packed order as payment |
| Assam | Stable member identity, authoritative KYC linkage, onboarding, permissions and recovery; acquisition alone is not KYC |
| Authorized Central finance administration and bank partner | Consented external account coverage, completed remittances, reversals, fees, settlement reconciliation and controlled publication |

Send remains a member-facing category and bank integration. NiaBooks reads across these units; it does not create a fifth operating unit or a second payment ledger.

## Production data contract to implement

Replace the demo projection with a rebuildable, member-scoped projection assembled by Central from canonical source events. Keep authoritative balances and settlements in their original books. Use the established signed server connection, replay protection, server-derived member identity and role/theatre permissions. Financial records need narrower finance permissions than general operator or investor access.

Each source event needs:

- Stable member ID; source system; unique source event ID; source revision; linked settlement/order/payroll/transfer reference.
- Event time, posting time and currency; amount in integer minor units; direction and classification.
- Status (`pending`, `settled`, `failed`, `reversed`); authoritative verification source/evidence; reversal/refund linkage.
- Source watermark, reconciliation state, consent scope/version and whether the data is actual or synthetic.

The member response needs period boundaries, source watermarks, coverage by source and period, settled entries with safe display references, excluded pending entries, totals, disputes and projection revision. Never expose full bank account numbers, phone numbers or another member’s data. Keep the true refresh timestamp; an HTTP read does not make old source data fresh.

The first pilot may use a controlled, validated Central import of verified source statements while direct payroll/bank adapters are completed. Require consent, finance review, deduplication and import evidence; do not make an unrestricted browser JSON upload a production finance tool.

## Reconciliation rules

1. Match bank movements to Jat/Sikh/payroll references so a bank debit and its order receipt count once. Preserve both evidence references.
2. Deduct rent/benefits from gross salary only once. If displaying net salary credited, do not count already-deducted rent again without representing gross earnings and the deduction consistently.
3. Exclude transfers between the member’s own accounts from income/expenses. Separate borrowing, loan repayments, investments, deposits and deposit returns from ordinary income/consumption. Do not call loan proceeds salary or savings withdrawals earnings.
4. Record remittances only on confirmed success. Handle pending, failed, refunded and reversed transfers explicitly. Separate fees; identify the destination’s relation to the member without assuming every external transfer went home.
5. Link corrections and refunds to original events, preserving the audit trail. Version/rebuild projections; repeated events and retries must not duplicate money.
6. Represent incomplete external bank/cash coverage explicitly. Self-reported cash records may help a budget, but must be distinguishable and cannot become verified by being entered.
7. Label net cash flow as **left after recorded outgoings**. It is not a wallet balance, savings balance or proof of affordability. Reconcile opening/closing balances separately when a genuine full account statement is available.
8. Resolve disputed events, timing differences, chargebacks and partner outages. No stale source may silently appear as fresh or complete.

## Nia health: experimental design, not CIBIL

CIBIL describes its score as derived from credit accounts, enquiries and borrowing/repayment history supplied by lenders. Earnings and expense data alone cannot reproduce it. See [CIBIL’s explanation](https://www.cibil.com/blog/all-you-need-to-know-about-cibil-score).

Use **Nia health**, on a distinct **0–100 scale**, as an optional personal cash-flow indicator. Do not describe it as an official credit score, bureau substitute, probability of repayment, loan offer or eligibility decision.

The demo formula (`nia-health-experimental-v1`) is deliberately explicit:

- **Money retained: 0–60 points.** Across the last three complete calendar months, net recorded cash flow / recorded earnings. Zero or negative net gives zero retention points; a 20% retained share reaches the 60-point cap. Formula: `round(60 × clamp(retainedRatio / 0.20, 0, 1))`.
- **Income consistency: 0–40 points.** `round(40 × minimumMonthlyIncome / maximumMonthlyIncome)` over the same three months.
- Total is the sum of these two point values. Current example: June ₹18,000 earned / ₹9,000 expenses / ₹7,000 home; July ₹19,500 / ₹9,800 / ₹7,500; August ₹21,000 / ₹10,800 / ₹8,000. Retained total ₹6,400 / earnings ₹58,500 gives 33 points; income consistency gives 34; **67/100**.

These weights and the 20% target are product hypotheses, **not validated lending thresholds**. Larger family commitments, seasonal income or medical costs can lower retained cash without implying untrustworthiness. Do not use these results to deny Nests, jobs, essentials, insurance or other member services.

Show no score without opt-in, three consecutive complete verified months with positive recorded earnings, and a source refresh within 24 hours. Show the reason instead of zero. Display data coverage separately from the score. Production must verify source coverage rather than trust a manually supplied `complete=true` flag. No missing data, changed phone, cash usage or missing bureau history should be treated as a default.

Before using any financial model for credit: agree the intended use with an appropriately regulated lender/partner; validate against observed outcomes, calibrate and monitor performance, assess disparate effects, test stability through job changes and shocks, support explanations and appeals, and complete applicable privacy/regulatory review. Build a separately governed model for any lending use; do not silently promote this demo formula into underwriting. Any bureau connection requires its own authorized purpose and member consent.

## Member control and privacy

Separate permission to access financial sources, permission to calculate the indicator, and permission to share a statement with a named recipient. Make each purpose understandable in the pilot languages and support revocation. Download should remain available without consenting to scoring. Employer and investor visitors cannot see another member’s statement. Never score caste, religion, language, gender, contact lists or phone habits.

Define retention and deletion obligations with the actual providers before launch, including any records that must legally be retained. Explain that score opt-out stops score use; it does not erase canonical payment records. Provide a correction/dispute workflow with a visible reference and resolution history. No automatic third-party sharing is built.

## Claude’s next implementation sequence

1. Add source mappings, reconciled event identifiers, coverage metadata and finance permissions to Central. Reuse the canonical books; publish read projections with revisions and genuine refresh times.
2. Wire verified member identity and consent to the production read path. Complete passkey/KYC work from the earlier brief; the current preview session is not the production gate.
3. Connect settled payroll, Jat and Sikh adapters; connect the bank partner or authorized consented statement source. Add deduplication, reversal handling, incomplete-coverage and disputes.
4. Enable production statements only after reconciliation tests pass. Keep scoring disabled until coverage rules and the experimental health model have been reviewed for the pilot. Keep lending use separately gated.
5. Rehearse the investor walkthrough: Central refresh → member statement → matching source reference → month change → optional score and explanation → export. Clearly distinguish presentation fixtures from actual financial history.

## Acceptance tests

- Two members cannot access each other’s statements through URL/body/cookie manipulation. Reader/investor and unrelated operators cannot inspect private records.
- Central updates and source corrections appear on the same statement references; reload/retry preserves totals.
- Pending/failed transfers, reservation-only orders and salary offers never enter settled cash-flow totals.
- Bank/order duplicates, partial refunds, reversals, payroll deductions, own-account transfers and deposits reconcile correctly without double counting.
- Unknown cash/bank coverage, stale input, insufficient history, zero income, opt-out and disputes do not produce a misleading score.
- Score methodology/version/factors are visible; exporting works without score consent; revocation stops calculation/display.
- Mobile and desktop statements, source expansion, month selection, CSV download, refresh and score opt-in/out work without runtime errors. Test lost sessions and offline recovery.

## Current validation

Nia commerce tests cover statement arithmetic, incomplete/stale score gates, consent, role isolation, demo exclusion from production, duplicate references and HTTP authorization/CSRF. Real payroll/bank integration, full production access, external source reconciliation and credit-model validation remain outstanding.


Validation on 8 September: 44 NiaSave commerce tests and 16 Central commerce/access checks passed; both builds and Central typecheck passed. Desktop 1280px and mobile 390px checks verified statement totals, source expansion, month change, CSV download, score opt-in/out, and Central demo loading. NiaSave's built static output rendered with the real local read API proxied for the check. Central's dev UI rendered at both widths. Central's built preview remains blocked by the pre-existing missing `pglite.data` artifact when no DATABASE_URL is configured; this is a deployment blocker to resolve before production verification. Browser plugin was unavailable; verification used local Chrome/Playwright. The repository's smoke helper assumes `/workspace`, so equivalent checks were run in this macOS workspace.
