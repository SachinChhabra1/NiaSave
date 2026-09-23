# M1 cutover data decision and discard evidence

Date: 23 September 2026. Source: founder's explicit attestation in the implementation conversation.

## Factual classification

The founder confirms that no real member has ever transacted on NiaSave production. The pilot has not opened; there is no real orderable SKU; the only collection location is test flagged. The founder classifies all existing production orders, reservations, settlements, idempotency keys and audit history as internal test data.

Decision: document and discard that operational test book during the Central cutover. Do not migrate it into Central and do not copy member records. This decision supersedes the conditional migration path in the M0 freeze note. It does not itself delete any row, authorize reopening commitments, or change the authentication path.

## Operator procedure

Run `node scripts/discard-test-commerce.mjs` in the authorized production database environment to inventory the existing row and record the machine counts and hashes. Run `node scripts/discard-test-commerce.mjs --apply` there to compare and swap the exact source version, then verify that the discarded fields are empty. Retain both JSON lines from the apply run in the restricted operations evidence store and append its database host, state key, versions, timestamps and counts to the log below. Do not paste database credentials or the raw state into this document. A conflict or failed postcheck is not a successful cutover. The one-time production build invocation ran under PR #121. Its postcheck was independently repeated through the production runtime; the build invocation and read-only proof hook are removed by PR #122.

## Execution log

- Production project: `niasave` in `sachinchhabra37-8426s-projects`.
- NiaSave deployed M0 freeze: PR #111, merge commit `e1ee36f3059d7b0b0395dd1926e1777369cfc890`.
- Execution: NiaSave Vercel production build for PR #121, deployment `dpl_66QGNzPhLkgnkj7tZE8firLgpJKP`, 2026-09-23 23:52 UTC; database state key `operation-polo-production`. Database host is not exposed by the accessible runtime log.
- Raw source row `operation-polo-production`, version 1868 at 2026-09-23 23:48:10 UTC, deployment `dpl_46dMFhj7UQdDRvgiAz5eYsgMqGdp` (PR #120): 6 orders, 1 reservation, 2 settlements, 2 payments, 13 scans, 6 idempotency keys, 27 operational audit entries, 1 catalogue config. Source records are founder-classified internal tests.
- Exact selected records and their TEST provenance: founder attestation above; machine inventory hash `7ad3bf8a58917f3660c689aff9faa19ebbd312d82659e1647789fcdaeee3764b` (SHA-256 of canonical selected fields).
- Pre-discard counts, source version and checksum are retained here and in the private runtime log of deployment `dpl_46dMFhj7UQdDRvgiAz5eYsgMqGdp`. The build command required the exact source checksum to match before any write.
- Cutover: `node scripts/discard-test-commerce.mjs --apply` made one version-checked CAS update from version 1868 to 1869. Independent production runtime proof at 2026-09-23 23:52:51 UTC on deployment `dpl_66QGNzPhLkgnkj7tZE8firLgpJKP` found 0 orders, 0 reservations, 0 settlements, 0 payments, 0 scans, 0 idempotency keys, 0 operational audit entries and 0 catalogue config. Post-discard remaining-state checksum `5739be590d5bdc1a32686dfbffa496d79f7c1fcb632aface07382d1b4acaf78b` exactly matches the precomputed retained-state checksum, supporting preservation of authentication, support and unrelated state.
- Central contract revision and proof of single writer before any commitment is reopened: pending execution.

The classified test commerce book has been discarded and independently verified empty. Never record zero counts from an inaccessible or failed read. Do not silently clear authentication, support, identity or unrelated operational records. Keep M0's write freeze and the member pilot closed until the Central contracts and NiaSave consumers are tested and the cutover is verified. A new Central ledger must not coexist with a writable NiaSave book.
