# Bison Current position source

The Control page reads `GET /api/bison/current-position` for In house, Vacant,
Studios and its reporting header. This authenticated, read-only endpoint reads
`UI_Occupancy!A6:N6000` in the existing Central input workbook
`1e54fm3oUeseNzsTFG8O4XweRnWVU2n8OvBc7MLOu6nE`, using the existing
`BISON_GOOGLE_SERVICE_ACCOUNT_JSON` credential with Sheets read-only scope.
The service account must already have read access to that workbook. No sheet
sharing, credential rotation or Central code change is part of this release.

Only Live rows count. Latest reporting date/time wins per exact Studio_ID;
conflicting records at the same timestamp fail closed. Missing/formula-error
counts remain unknown; cards show the sum of known values and the existing
reconciliation line states the number of excluded studio counts. All-unknown
metrics display a dash. The header uses Contracted_Nests as a reported capacity
denominator, not an operational availability claim.

Reserved, contract, clock, collection and overlap cards, work-area links, all
other Bison pages and the Central 2 Para operational Jat card continue to use
the real Jat book. This projection neither creates residents nor overwrites
bookings, inventory/availability, financial records or the original importer.
The existing Control reconciliation line explains these two scopes. Its work
area can say 82 operational studios while Current position reports 89 source
studios. That distinction is intentional until the real operational records
are reconciled.

The Control page refreshes every 60 seconds while visible and on tab return.
The read cache expires after 60 seconds, so a source edit normally appears
within two minutes plus request latency. Central's own five-minute refresh can
lag this direct read. Failed refreshes do not serve an old successful projection
or fall back to the book as though it were sheet data. Only the source-dependent
cards become unavailable; a source outage does not remove operational controls.

September 9 acceptance baseline: 89 source studios, 6,719 contracted Nests,
6,194 reported occupied and 478 reported vacant. One studio's occupied cell is
`-` and its vacant formula errors, leaving 47 beds unverified. Do not rewrite
the source to force 525 confirmed vacancies. These are reporting figures, not
confirmation of current physical occupancy.

Validation: `npm run test:bison` and `sh vercel-build.sh`. API tests verify desk
authorization and failure behavior; projection tests cover source identity,
unknowns, latest records, duplicates and cache refresh; Control tests verify
book isolation and independent source/book outages. Production verification
must confirm the existing service account can read the source and that the
three mapped cards/header show the source values without changing book counts.
