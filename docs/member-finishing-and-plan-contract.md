# Member finishing pass and monthly-plan connection

8 September 2026. This supplements central-reconciliation-and-monthly-plan.md. Living/Jat under Para 2 remains the enrolment and KYC owner.

## Implemented in NiaSave

- Language selection in the first visible utility row and translated LESS navigation. Help is available globally, including lender-harassment help.
- New financial/support/planner UI strings, purposes and common demo job roles/shifts translated into Hindi, Tamil, Kannada and Marathi. Each language loads its own bundle. Translation coverage regression test added; native-speaker review is still required. Arbitrary Central-origin names, terms, notices and member-authored descriptions are not automatically translated: publish reviewed localized source content.
- Direct income/expense actions, clearer incomplete statement totals, explicit health-score period and explanation of how remittances affect the unchanged experimental formula.
- One readable job card per mandate, with pay/CTC status and return travel budget; expand shift/requirements/apply. Removed duplicate phone map-summary cards. Map popup still opens the matching detail.
- My plan this month: interactive current-calendar-month calculator using net expected income, essentials, debt repayments, emergency saving, other costs and a chosen remittance target. It shows estimated room for remittance, remaining budget or shortfall. Incomplete inputs never become zero; money arithmetic uses integer paise. Recorded current-month NiaBooks totals are available as a reference without being subtracted a second time. Earlier statement selection does not change the current-month plan.

The calculator is explicitly labelled not saved. Drafts are held only in the current page session, keyed to member/month, cleared on sign-out and lost on reload. No plan API, persistent plan ledger, payment, loan request or Central case is created by this UI. Do not represent this as the completed Central plan-save integration.

## Claude: implement the paired plan API and NiaSave adapter

Proposed member-facing routes, not yet implemented:

- GET /api/commerce/books/plan?month=YYYY-MM
- PUT /api/commerce/books/plan, with same-origin member session and idempotency-key

NiaSave authenticates the member and forwards a scoped request through the authenticated Central service boundary. Central derives/validates the stable member context; browser-supplied member IDs cannot authorize access. The following logical contract can be implemented behind that boundary without changing its ownership:

Read result: schemaVersion, month, revision, updatedAt, saved fields (or null for no saved plan), capabilities.canSave, and source actuals with asOf, coverage and stable receipt references. Failure is distinct from no saved plan; unavailable storage must never appear as success.

Write input: month, expectedRevision (0 for initial creation), fields { incomePaise, essentialsPaise, debtPaise, bufferPaise, otherPaise, homePaise }. Validate calendar month and safe nonnegative integer amounts up to 100000000 paise per field. Zero is explicit; null means unknown and should remain incomplete. If Central supports partial saved drafts, preserve null rather than coercing it to zero. Version the schema and recalculate derived amounts server-side.

One authoritative plan per member/month, stored durably in Central with revision, actor and timestamps. Repeat of the same idempotency key/body returns the original successful result; a changed body conflicts. Use atomic revision checks and 409 for concurrent changes. Keep typed values while resolving a conflict; do not overwrite silently. No network calls inside replayable transaction callbacks.

After the route exists, replace the transient UI storage with an explicit save/load adapter and user-visible saving/saved/unsaved/error states. Show a saved claim only after durable acknowledgement. Preserve the member's entered values on a failed request. Do not persist a shadow plan in localStorage or in another NiaSave book. Production writes need the agreed member KYC/access gate.

## Source actuals and suggestions

NiaBooks remains the source of recorded actuals; never create transactions from budget entries. Expected income and each cost field are total amounts for the month, including amounts already received/paid. Do not add actual income to expected total income or subtract actual spending in addition to the total budget. Distinguish recorded zero from unknown coverage.

The first UI leaves expected totals blank for member review. Central may supply suggested rent, confirmed obligations and category totals with source references, coverage and an explanation; members must be able to review them. A paid receipt is not automatically the full month's expected cost. Deposits, borrowing proceeds and refunds are not earned salary. Keep debt repayments distinct from other essentials to avoid double counting; publish stable purpose/category IDs without losing legacy descriptions.

The planner is not conditioned on a health score or partner-credit permission. No automatic remittance, account-balance claim, affordability certification or lender application. Current health-score math is unchanged and must not be optimized as the member's planning objective.

## Remaining launch work

Central still needs approved real pack sizes, unit-price/comparison inputs and production product media; real Nest photos/facilities/terms; valid route/fare data and CTC basis; enrolment/KYC and durable member access; staffed support cases, FREED/loan/bank connections and governed feature activation. Do not replace missing data with demonstration values. Native-language review and observed tasks on members' actual phones remain required.

## Verification

The finishing pass was exercised across all four primary tabs, five languages and desktop/phone widths, plus a Tamil tablet layout. Planner calculations, incomplete/invalid amounts, paise precision, overspending, translated forms, purpose choices, global help, expandable jobs, session-only drafts, current-month selection and source actuals were checked. All 51 commerce tests pass, including new plan arithmetic and translation-coverage checks. The production build passes. A near-home marker overlap that intercepted the first job tap was fixed and verified; map selection opens the correct expanded card.
