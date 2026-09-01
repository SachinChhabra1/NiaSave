# Operation Bison

Living backend on niasave.com. Polo remains Save.

| Desk | Product | Owns |
|---|---|---|
| Operation Polo | Save | orders, stock, pack, dispatch, collection, invoice, recon |
| Operation Bison | Living | occupancy, clocks, vacant, nest assign/vacate, join-month |

Bison does not bill. Finance bills the nest after Living assigns it.

Occupancy source of truth is the Stayflexi Group Master Report (`groupUnifiedReport`). Seed file: `bison/stayflexi-seed.json` from 3,339 bookings across 56 studio codes, as of 2026-06-30.

CHECKED_IN → occupied. Unique room ids vs in-house → contracted / vacant. `balance_due` on in-house → pending. Past checkout while still CHECKED_IN → overdue clock. Check-in month → join month. CANCELLED → notices. UNASSIGNED → unverified.

## Surfaces

- Staff desk: `/bison.html`
- Tower: `GET /api/bison/tower?city=Bengaluru`
- Sites: `GET /api/bison/sites`
- Join months: `GET /api/bison/join`
- Assign: `POST /api/bison/assign` `{ siteId, nests, memberId?, force? }`
- Vacate: `POST /api/bison/vacate` `{ siteId, nests }`
- Clear clock: `POST /api/bison/clock` `{ siteId, nextHours }`

Aliases `/api/living/*` resolve to the same handlers.

## Persistence

Neon table `nia_runtime_state`, key `operation-bison` (override with `NIA_BISON_STATE_KEY`). Separate from Polo key `operation-polo`.

Hold-fill: assign is rejected when pending per occupied nest is above ₹2,000 unless `force: true`.

## Release

Same Vercel project as NiaSave. Copy `bison.html` in `vercel-build.sh`. Merge `operation-bison` after Polo wiring in `api/server.mjs`.
