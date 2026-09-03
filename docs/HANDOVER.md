# NiaSave production handover

As of 31 August 2026

## 1. Current system

NiaSave has two connected production surfaces:

1. The member phone at `https://www.niasave.com/`, covering Live, Earn, Save and Send in five interface languages with embedded Nia voice support.
2. Operation Polo at `https://www.niasave.com/ops.html`, covering orders, stock, packing, dispatch, collection, invoicing and reconciliation.

Both surfaces and their APIs run from one Vercel project and use a shared Neon Postgres runtime store. The current system is a controlled pilot. OTP and payments are skipped. Send does not move money.

## 2. Source of truth and release flow

| Item | Source of truth |
|---|---|
| Repository | `https://github.com/SachinChhabra1/NiaSave` |
| Production branch | `main` |
| Vercel project | `niasave` |
| Project ID | `prj_tTLIuOGLv8YcEE2CP1NHNsZFDFq6` |
| Production domains | `niasave.com`, `www.niasave.com`, `niasave.vercel.app` |
| Database | Neon Postgres attached to the Vercel project |

Release process:

1. Create a short-lived branch from `main`.
2. Open a pull request and complete the production-impact checklist.
3. GitHub Actions runs the self-test, storage tests and production build.
4. Review the Vercel preview deployment and the affected phone/API flow.
5. Merge only after checks pass.
6. Vercel's native Git integration deploys `main` to production.
7. Verify `/`, `/ops.html`, `/health` and the changed end-to-end flow.
8. Roll back by promoting the last known-good Vercel deployment if a production check fails.

Do not add a Vercel token to the repository. Native Git integration owns deployment. Repository secrets are required only if the team later replaces native deployment with a custom workflow.

## 3. Current environment contract

Vercel currently supplies the Neon Postgres variables, including `DATABASE_URL`, and the Blob token. `SESSION_SECRET` exists in Vercel. Variable values must remain in Vercel and must not be copied into GitHub, tickets or documentation.

Current code reads:

- `DATABASE_URL`
- `NIA_RUNTIME_STATE_KEY`
- `DEMO`
- `DUMMY_DATA`
- `STAFF_PASSWORD`
- `STAFF_TOKEN_SECRET`
- `SESSION_SECRET` signs 2 Para staff tokens when `STAFF_TOKEN_SECRET` is not set; it is not yet used by the current public member-session implementation

Before a real-data launch, explicitly set `DEMO=0` and `DUMMY_DATA=0` only after OTP, payments, staff access, source data and operational checks pass. Do not use those switches as a substitute for implementing the missing integrations.

## 4. Critical blockers before real member data or money

### A. Member identity and OTP

- Choose an approved SMS/OTP provider and commercial owner.
- Implement provider send and callback handling behind the existing `/api/auth/*` routes.
- Replace the seeded member session with a secure server-side session.
- Bind all member data access to the verified session.
- Add rate limits, expiry, one-time use, lockout, logout and audit events.
- Complete the tests in `docs/OTP.md`.

### B. UPI collection

- Decide the use case first: collect at order, collect at pickup, mandate, intent or QR.
- Select the regulated payment provider and contracting entity.
- Create orders server-side and never trust a client-supplied amount.
- Verify signed webhooks and make them the source of truth for payment status.
- Add idempotent success, pending, failed, expired, duplicate, refund and reconciliation states.
- Link payment, bag, order, collection, settlement and refund through immutable identifiers.
- Prove daily settlement reconciliation against the provider or bank statement.
- Complete the provider-neutral contract and failure tests in `docs/UPI.md`.

### C. Staff access and audit

Polo and Bison are temporarily open from the two 2 Para product cards while the dedicated login screen is being built. Operational mutations use the server-owned `2 Para desk` actor, not a client-supplied name. Set `STAFF_AUTH_REQUIRED=1` to restore the existing signed, 12-hour token enforcement.

- Set a dedicated `STAFF_TOKEN_SECRET`; remove fallback credentials and rotate the prototype password.
- Replace the shared password with individual identity before use beyond the controlled staff pilot.
- Complete immutable before/after audit coverage for older Polo mutations; Bison contract, clock and collection actions already record actor and time.

### D. Data model and source ownership

The durable store currently saves each runtime domain as a versioned JSON record. This is suitable for the controlled pilot but is not the final multi-theatre ledger.

- Create governed records for members, prices, products, vendors, purchase orders, inventory movements, orders, payments, settlements and audit events.
- Assign a named owner and source system for member roster, payroll, catalogue/MRP, procurement, vendors, stock and bank data.
- Mark seeded data visibly until a verified source replaces it.
- Define retention, correction and deletion rules for member and counselling data.

### E. Production operations

- Add structured application logs, error tracking and provider correlation IDs.
- Alert on health failure, database failure, OTP delivery drop, webhook rejection, payment mismatch and reconciliation breaks.
- Exercise database backup restoration and document recovery time and recovery point targets.
- Write incident, rollback and provider-outage runbooks.
- Establish daily owner checks for order, inventory, cash/UPI and settlement exceptions.

### F. Voice and language acceptance

- Test English, Hindi, Bangla, Tamil and Kannada journeys with target users.
- Verify that Nia uses the current product names and does not invent financial advice.
- Define when the voice agent hands over to a JCO or counsellor.
- Decide whether transcripts are stored; if so, obtain consent and apply retention and access controls.

### G. Remittance and insurance boundary

Send is currently a planning experience. A money-transfer rail requires a separately selected regulated partner, contracting structure, KYC/AML approach, consent, disclosures, error handling and reconciliation design.

Insurance remains informational. Purchase must occur through a bank, IRDAI-registered insurer or authorised intermediary until a compliant distribution model is approved.

## 5. Recommended delivery sequence

1. Secure staff access and audit logging.
2. Connect the verified member roster and implement OTP/session controls.
3. Normalise order, inventory and payment records needed for one pilot theatre.
4. Integrate UPI sandbox with signed webhooks and reconciliation.
5. Run end-to-end sandbox journeys and failure cases.
6. Complete privacy, legal, finance and operating sign-off.
7. Launch a small real-member pilot with daily reconciliation.
8. Add remittance only as a separate regulated workstream.

## 6. Minimum production acceptance test

The first live pilot is ready only when one verified member can:

1. Receive and verify an OTP.
2. See only their own member record.
3. Build a bag with a server-verified price.
4. Complete or fail a UPI payment without creating duplicate orders.
5. Produce one durable order in Operation Polo.
6. Move through pack, dispatch and collection with named staff actors.
7. Reconcile the collected amount to the provider settlement.
8. Receive a receipt and, where applicable, a refund.
9. Leave a complete audit trail that survives restart and can be reviewed without database access.

## 7. Decisions the receiving team needs immediately

- OTP provider and contracting owner
- UPI provider, collection point and settlement account
- Identity provider for staff
- Pilot theatre and member cohort
- Owners for roster, payroll, catalogue, procurement, inventory and reconciliation
- Privacy, legal and finance approvers
- Production support owner and escalation rota

Until these owners and providers are named, the code can be prepared and tested only against demo or sandbox services.
