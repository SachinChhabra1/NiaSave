# P0 route, page and script inventory

Base: `7ea5840` (main at clone time). Code-derived entries below are reviewed together with the transport shutdown; a method name alone does not prove read-only behaviour. No production request was made.

## Disposition

| Surface | P0 disposition | Destination / dependency |
|---|---|---|
| All API aliases and shared dispatch | Unknown/non-session/non-personal-book mutations return 410 before body/auth/storage; `/api`, `?path=`, direct and trailing-slash variants covered. | Central; relevant G gate still PENDING |
| Commerce staff configuration/action/support/recovery; Nest config; signed inbound Central commerce | All methods 410, including signed requests. | Central Save/Live/claim contracts G4–G8 |
| Legacy Save quote/order/cancel and Living availability/quote/book/cancel | Mutations 410; no local substitute added. | Live G4/G7/G8; Save G6/G7/G8 |
| Legacy staff, Bison/Living/Dogra, imports, procurement, dispatch, payments, bookings, allocation | All mutations 410; sync GET also 410. | Central operations |
| Legacy GETs | Existing projections remain; request-scoped runtime reads cannot CREATE, INSERT, UPDATE or retain mutations in memory. Existing read computations are not claimed as Central compliance. | G3–G12 cutovers |
| Session and personal books | Existing session endpoints and books entries/consent retained. No migration or dual-write introduced. | G2/G9; founder ask 7 at cutover |
| `commerce-owner.js` | Reviewed read-only catalogue/Live/Earn view; session login only, no operating write. Existing storage remains a later runtime concern. | G1/G2 shell cutover |
| Staff writer HTML; `commerce-ops.js`, `bison.js`, `bison-data.js`; `/tanot/` | Existing addresses redirect to Central; local writer controls removed. | Concrete Central URL in each file |
| `showcase/handler.mjs` | Every request 410; former GET bootstrap seeded two books. | Retired demo path; not gate evidence |
| `scripts/load-connected-demo.py` | Exits before imports/network writes. | Central-owned operating records |
| `scripts/build-domain-showcase.mjs` | Throws before archived source can reopen old writes. | Build reviewed P0 branch |
| `scripts/build-access-uat.mjs` | Generated entry includes the same shutdown and read-only scope. | Session acceptance only |
| `scripts/build-showcase.mjs` | Packages the retired 410 handler, cannot reopen it. | No usable operating demo |
| `scripts/overlay-*.mjs` | Local source-file transforms, no operating-record writes; archived assembler disabled. | Tooling only |
| `staff/shops-30.json` | Static legacy data; no executable writer. | Legacy code data, not a G pass |

NiaSave runtime is the sole writer of `nia_runtime_state` until cutover. Existing personal entries occupy the Save state key (`operation-polo` by default). This P0 does not migrate IDs, move member data, or assert a completed Central cutover.

## Literal route index at the base SHA

| Source | Line | Paths |
|---|---:|---|
| `api/server.mjs` | 152 | `/api/dogra/state, /dogra/state` |
| `api/server.mjs` | 179 | `/bison/data/sync` |
| `api/server.mjs` | 203 | `/v1/health` |
| `api/server.mjs` | 207 | `/v1/members/lookup, /v1/save/lookup` |
| `api/server.mjs` | 214 | `/v1/work/current` |
| `api/server.mjs` | 215 | `/v1/work/extras/` |
| `api/server.mjs` | 228 | `/v1/nest/current` |
| `api/server.mjs` | 229 | `/v1/nest/events/bada-khaana/rsvp` |
| `api/server.mjs` | 234 | `/v1/nest/issues` |
| `api/server.mjs` | 240 | `/v1/catalog, /v1/save/catalog` |
| `api/server.mjs` | 241 | `/v1/payments, /v1/save/bag, /v1/save/upi` |
| `api/server.mjs` | 258 | `/v1/orders, /v1/save/checkout` |
| `api/server.mjs` | 279 | `/v1/home/leftover` |
| `api/server.mjs` | 283 | `/v1/home/transfers` |
| `api/server.mjs` | 284 | `/v1/staff/login` |
| `api/server.mjs` | 311 | `/v1/staff/me` |
| `api/server.mjs` | 318 | `/v1/staff/logout` |
| `api/server.mjs` | 331 | `/v1/staff/hub/day` |
| `api/server.mjs` | 336 | `/v1/staff/hub/advance` |
| `rabbit/engine.mjs` | 2044 | `/biker, /dispatch` |
| `rabbit/engine.mjs` | 2047 | `/connectors` |
| `rabbit/engine.mjs` | 2048 | `/connectors/upload` |
| `rabbit/engine.mjs` | 2049 | `/predict` |
| `rabbit/engine.mjs` | 2050 | `/ledger` |
| `rabbit/engine.mjs` | 2051 | `/stock` |
| `rabbit/engine.mjs` | 2052 | `/inventory` |
| `rabbit/engine.mjs` | 2053 | `/ageing` |
| `rabbit/engine.mjs` | 2054 | `/orders` |
| `rabbit/engine.mjs` | 2055 | `/order` |
| `rabbit/engine.mjs` | 2056 | `/order` |
| `rabbit/engine.mjs` | 2057 | `/member` |
| `rabbit/engine.mjs` | 2058 | `/member` |
| `rabbit/engine.mjs` | 2059 | `/member/answer` |
| `rabbit/engine.mjs` | 2060 | `/auth/me` |
| `rabbit/engine.mjs` | 2061 | `/auth/otp` |
| `rabbit/engine.mjs` | 2062 | `/auth/verify` |
| `rabbit/engine.mjs` | 2063 | `/stops` |
| `rabbit/engine.mjs` | 2064 | `/stops` |
| `rabbit/engine.mjs` | 2065 | `/beat` |
| `rabbit/engine.mjs` | 2066 | `/beat/open` |
| `rabbit/engine.mjs` | 2067 | `/beat/close` |
| `rabbit/engine.mjs` | 2068 | `/scan` |
| `rabbit/engine.mjs` | 2069 | `/recon` |
| `rabbit/engine.mjs` | 2070 | `/next` |
| `rabbit/engine.mjs` | 2071 | `/source` |
| `rabbit/engine.mjs` | 2072 | `/cash` |
| `rabbit/engine.mjs` | 2073 | `/cash` |
| `rabbit/engine.mjs` | 2074 | `/settlements` |
| `rabbit/engine.mjs` | 2079 | `/po` |
| `rabbit/engine.mjs` | 2080 | `/po` |
| `rabbit/engine.mjs` | 2081 | `/dispatch` |
| `rabbit/engine.mjs` | 2082 | `/dispatch` |
| `rabbit/engine.mjs` | 2083 | `/invoice` |
| `rabbit/engine.mjs` | 2084 | `/invoice` |
| `rabbit/engine.mjs` | 2085 | `/biker` |
| `rabbit/engine.mjs` | 2086 | `/biker` |
| `rabbit/engine.mjs` | 2087 | `/tower` |
| `rabbit/engine.mjs` | 2088 | `/beat/close, /beat/open, /scan` |
| `rabbit/engine.mjs` | 2096 | `/auth/otp` |
| `rabbit/engine.mjs` | 2097 | `/auth/verify` |
| `bison/engine.mjs` | 535 | `/api/` |
| `bison/engine.mjs` | 536 | `/bison/, /living/` |
| `bison/engine.mjs` | 563 | `/bison/release` |
| `bison/engine.mjs` | 564 | `/bison/tower` |
| `bison/engine.mjs` | 565 | `/bison/hierarchy` |
| `bison/engine.mjs` | 566 | `/bison/sites` |
| `bison/engine.mjs` | 567 | `/bison/bookings` |
| `bison/engine.mjs` | 568 | `/bison/bookings` |
| `bison/engine.mjs` | 569 | `/bison/bookings/amend` |
| `bison/engine.mjs` | 570 | `/bison/bookings/cancel` |
| `bison/engine.mjs` | 571 | `/bison/checkin` |
| `bison/engine.mjs` | 572 | `/bison/checkout` |
| `bison/engine.mjs` | 573 | `/bison/inventory` |
| `bison/engine.mjs` | 574 | `/bison/folio` |
| `bison/engine.mjs` | 575 | `/bison/folio` |
| `bison/engine.mjs` | 576 | `/bison/groups` |
| `bison/engine.mjs` | 577 | `/bison/groups` |
| `bison/engine.mjs` | 578 | `/bison/members` |
| `bison/engine.mjs` | 579 | `/bison/members` |
| `bison/engine.mjs` | 580 | `/bison/contracts` |
| `bison/engine.mjs` | 581 | `/bison/contracts` |
| `bison/engine.mjs` | 582 | `/bison/contracts/amend` |
| `bison/engine.mjs` | 583 | `/bison/contracts/end` |
| `bison/engine.mjs` | 584 | `/bison/collections` |
| `bison/engine.mjs` | 585 | `/bison/collections/charges` |
| `bison/engine.mjs` | 586 | `/bison/collections/payments` |
| `bison/engine.mjs` | 587 | `/bison/collections/work` |
| `bison/engine.mjs` | 588 | `/bison/clocks` |
| `bison/engine.mjs` | 589 | `/bison/clock` |
| `bison/engine.mjs` | 590 | `/bison/data/import` |
| `bison/engine.mjs` | 591 | `/bison/data/config` |
| `bison/engine.mjs` | 592 | `/bison/data/config` |
| `bison/engine.mjs` | 593 | `/bison/data/sync` |
| `bison/engine.mjs` | 594 | `/bison/audit` |
| `bison/engine.mjs` | 595 | `/bison/audit` |
| `bison/engine.mjs` | 596 | `/bison/audit-log` |
| `bison/engine.mjs` | 597 | `/bison/ingest` |
| `bison/engine.mjs` | 598 | `/bison/migrate` |
| `bison/engine.mjs` | 599 | `/bison/join` |
| `bison/engine.mjs` | 600 | `/bison/assign` |
| `bison/engine.mjs` | 601 | `/bison/vacate` |
| `lib/commerce/http.mjs` | 67 | `/nests/config, /recovery, /staff/` |
| `lib/commerce/http.mjs` | 72 | `/auth/password/request, /auth/request` |
| `lib/commerce/http.mjs` | 73 | `/auth/password/verify, /auth/verify` |
| `lib/commerce/http.mjs` | 74 | `/auth/password, /auth/password/set, /auth/set-password` |
| `lib/commerce/http.mjs` | 135 | `/auth/login` |
| `lib/commerce/http.mjs` | 151 | `/auth/logout` |
| `lib/commerce/http.mjs` | 154 | `/catalogue` |
| `lib/commerce/http.mjs` | 155 | `/auth/` |
| `lib/commerce/http.mjs` | 156 | `/staff/` |
| `lib/commerce/http.mjs` | 157 | `/catalogue` |
| `lib/commerce/http.mjs` | 170 | `/membership, /membership/` |
| `lib/commerce/http.mjs` | 203 | `/books/plan` |
| `lib/commerce/http.mjs` | 227 | `/earn, /earn/applications` |
| `lib/commerce/http.mjs` | 229 | `/earn` |
| `lib/commerce/http.mjs` | 241 | `/earn` |
| `lib/commerce/http.mjs` | 267 | `/nests/availability` |
| `lib/commerce/http.mjs` | 268 | `/nests/quote` |
| `lib/commerce/http.mjs` | 269 | `/nests/bookings` |
| `lib/commerce/http.mjs` | 270 | `/nests/bookings` |
| `lib/commerce/http.mjs` | 271 | `/nests/cancel` |
| `lib/commerce/http.mjs` | 272 | `/nests/config` |
| `lib/commerce/http.mjs` | 281 | `/auth/request, /auth/verify` |
| `lib/commerce/http.mjs` | 289 | `/auth/request` |
| `lib/commerce/http.mjs` | 290 | `/auth/verify` |
| `lib/commerce/http.mjs` | 291 | `/auth/request` |
| `lib/commerce/http.mjs` | 302 | `/books/entries` |
| `lib/commerce/http.mjs` | 303 | `/books/consent` |
| `lib/commerce/http.mjs` | 304 | `/earn` |
| `lib/commerce/http.mjs` | 305 | `/earn/applications` |
| `lib/commerce/http.mjs` | 306 | `/earn/applications` |
| `lib/commerce/http.mjs` | 310 | `/catalogue` |
| `lib/commerce/http.mjs` | 311 | `/auth/preview, /recovery` |
| `lib/commerce/http.mjs` | 314 | `/auth/request` |
| `lib/commerce/http.mjs` | 322 | `/auth/preview, /auth/verify` |
| `lib/commerce/http.mjs` | 324 | `/auth/preview` |
| `lib/commerce/http.mjs` | 340 | `/auth/logout` |
| `lib/commerce/http.mjs` | 344 | `/recovery` |
| `lib/commerce/http.mjs` | 350 | `/staff/` |
| `lib/commerce/http.mjs` | 357 | `/staff/state` |
| `lib/commerce/http.mjs` | 358 | `/staff/action` |
| `lib/commerce/http.mjs` | 364 | `/staff/support` |
| `lib/commerce/http.mjs` | 370 | `/staff/config` |
| `lib/commerce/http.mjs` | 371 | `/staff/recovery` |
| `lib/commerce/http.mjs` | 384 | `/support` |
| `lib/commerce/http.mjs` | 385 | `/support` |
| `lib/commerce/http.mjs` | 393 | `/orders` |
| `lib/commerce/http.mjs` | 394 | `/quote` |
| `lib/commerce/http.mjs` | 395 | `/orders` |
| `lib/commerce/http.mjs` | 396 | `/cancel` |
| `lib/commerce/owner-view.mjs` | 16 | `/catalogue, /earn` |
| `lib/commerce/owner-view.mjs` | 19 | `/earn` |
| `lib/commerce/owner-view.mjs` | 23 | `/catalogue` |
| `showcase/handler.mjs` | 11 | `/api/, /api/showcase, /api/showcase.mjs` |
| `showcase/handler.mjs` | 12 | `/api/central/commerce` |
| `showcase/handler.mjs` | 14 | `/api/commerce/, /api/showcase/health` |
| `showcase/handler.mjs` | 22 | `/api/showcase/health` |
| `showcase/handler.mjs` | 23 | `/api/commerce` |
