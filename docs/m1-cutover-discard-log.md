# M1 cutover data decision and discard evidence

Date: 23 September 2026. Source: founder's explicit attestation in the implementation conversation.

## Factual classification

The founder confirms that no real member has ever transacted on NiaSave production. The pilot has not opened; there is no real orderable SKU; the only collection location is test flagged. The founder classifies all existing production orders, reservations, settlements, idempotency keys and audit history as internal test data.

Decision: document and discard that operational test book during the Central cutover. Do not migrate it into Central and do not copy member records. This decision supersedes the conditional migration path in the M0 freeze note. It does not itself delete any row, authorize reopening commitments, or change the authentication path.

## Operator procedure

Run `node scripts/discard-test-commerce.mjs` in the authorized production database environment to inventory the existing row and record the machine counts and hashes. Run `node scripts/discard-test-commerce.mjs --apply` there to compare and swap the exact source version, then verify that the discarded fields are empty. Retain both JSON lines from the apply run in the restricted operations evidence store and append its database host, state key, versions, timestamps and counts to the log below. Do not paste database credentials or the raw state into this document. A conflict or failed postcheck is not a successful cutover. The script has **not** yet run against production.

## Execution log (to complete when deletion runs)

- Production project: `niasave` in `sachinchhabra37-8426s-projects`.
- NiaSave deployed M0 freeze: PR #111, merge commit `e1ee36f3059d7b0b0395dd1926e1777369cfc890`.
- Operator, timestamp, deployment revision and database identity: pending execution.
- Raw source row `operation-polo-production`, version 1868 at 2026-09-23 23:48:10 UTC, deployment `dpl_46dMFhj7UQdDRvgiAz5eYsgMqGdp` (PR #120): 6 orders, 1 reservation, 2 settlements, 2 payments, 13 scans, 6 idempotency keys, 27 operational audit entries, 1 catalogue config. Source records are founder-classified internal tests.
- Exact selected records and their TEST provenance: founder attestation above; machine inventory hash `7ad3bf8a58917f3660c689aff9faa19ebbd312d82659e1647789fcdaeee3764b` (SHA-256 of canonical selected fields).
- Pre-discard counts, source version and checksum retained in this repository and private Vercel runtime log of deployment `dpl_46dMFhj7UQdDRvgiAz5eYsgMqGdp`; deletion and postcheck evidence pending.
- Transaction or cutover command, affected row counts, post-discard counts, and independent verification: pending execution.
- Central contract revision and proof of single writer before any commitment is reopened: pending execution.

No discard has yet occurred. Never record zero counts from an inaccessible or failed read. Do not silently clear authentication, support, identity or unrelated operational records. Keep M0's write freeze and the member pilot closed until the Central contracts and NiaSave consumers are tested and the cutover is verified. A new Central ledger must not coexist with a writable NiaSave book.
