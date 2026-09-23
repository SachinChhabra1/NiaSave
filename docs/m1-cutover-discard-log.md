# M1 cutover data decision and discard evidence

Date: 23 September 2026. Source: founder's explicit attestation in the implementation conversation.

## Factual classification

The founder confirms that no real member has ever transacted on NiaSave production. The pilot has not opened; there is no real orderable SKU; the only collection location is test flagged. The founder classifies all existing production orders, reservations, settlements, idempotency keys and audit history as internal test data.

Decision: document and discard that operational test book during the Central cutover. Do not migrate it into Central and do not copy member records. This decision supersedes the conditional migration path in the M0 freeze note. It does not itself delete any row, authorize reopening commitments, or change the authentication path.

## Execution log (to complete when deletion runs)

- Production project: `niasave` in `sachinchhabra37-8426s-projects`.
- NiaSave deployed M0 freeze: PR #111, merge commit `e1ee36f3059d7b0b0395dd1926e1777369cfc890`.
- Operator, timestamp, deployment revision and database identity: pending execution.
- Raw source keys/tables and pre-discard counts, including orders, reservations, settlements, idempotency keys and audit entries: pending execution.
- Exact selected records and their TEST provenance: founder attestation above; machine inventory pending execution.
- Export/checksum or deletion manifest retained outside the member app: pending execution.
- Transaction or cutover command, affected row counts, post-discard counts, and independent verification: pending execution.
- Central contract revision and proof of single writer before any commitment is reopened: pending execution.

No discard has yet occurred. Never record zero counts from an inaccessible or failed read. Do not silently clear authentication, support, identity or unrelated operational records. Keep M0's write freeze and the member pilot closed until the Central contracts and NiaSave consumers are tested and the cutover is verified. A new Central ledger must not coexist with a writable NiaSave book.
