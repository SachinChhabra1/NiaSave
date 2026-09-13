# P0 review — undeclared draft

Base: `7ea58403553eeb3e5cbfb568b9b17eefbaf0a9db`. Branch: `codex/p0-central-guardrails`.

P0 closes legacy operating writes at the shared API handler and middleware, before auth, body parsing or storage. Unknown writes fail closed. Known side-effect GETs are disabled; remaining reads use a request scope that cannot initialise/update the operating table or retain in-memory mutations. Staff writer pages keep concrete Central destinations. Demo seeding and archived deployment assembly are disabled.

The four requested scripts, route inventory, append-only twelve-block Central ledger and launch log are included. No P1–P10 screen or local replacement rule was built. Central code, production, real members, money and partners were not touched.

## Validation

| Check | Observed result |
|---|---|
| Targeted P0 checks | 85 passed; includes route aliases, signed/signed-out 410, middleware ordering, GET write prevention, audit negative cases, locale and budget negative cases |
| Complete suite | 250 tests: 221 passed, 29 failed, 0 skipped, 0 todo |
| Unchanged base | 164 existing node tests passed; original Rabbit selftest passed |
| Production build | Completed using `vercel-build.sh`; original naming lock retained |
| Route audit | 0 disallowed in the checked source entries and built staff surfaces |
| Locale key audit | 0 missing across 507 existing translation keys, five languages |
| Measured local JS | Commerce worst language: 115,053 / 120,000 gzip bytes; total shared asset set: 233,731 / 250,000 |
| Complete bundle check | **Failed**: existing `@elevenlabs/convai-widget-embed@0.15.1` is loaded from an external CDN on the member entry; its transfer is unmeasured |
| Machine runner | Shell syntax checked only; Gate B was not run |
| Gate C | Not run; no throttled browser or production evidence |
| Central gates | G1–G12 all PENDING; no PASS written |

## Why this is not a declaration

The retained legacy tests expect staff writes, signed Central-to-NiaSave mutations, demo reservations and the retired staff UI to keep working. Those expectations now fail. No existing test was deleted, edited, skipped or weakened. The precise failures are listed below for review. This is a material regression set, not a green build or a completed P0 declaration.

The external voice SDK also prevents a complete JS budget result. The measured local byte totals are not a substitute for that missing transfer. Locale coverage checks existing translation keys and inline Hindi; it does not certify every visible string, absence of runtime English fallback, or five-language browser behaviour. P0 retains legacy read computations until gated cutover; Gate A's source audit is not claimed complete merely because the write shutdown passes its mechanical checks.

Member dependencies closed in P0: Save quote/order/cancel → G6/G7/G8; Live availability/quote/book/cancel → G4/G7/G8; legacy Earn application and plan writes → G5/G7/G9. Read screens and existing session/personal-book transport remain, but no C5 non-regression claim is made.

NiaSave runtime is the sole writer of `nia_runtime_state` until cutover. P0 performs no migration or dual-write. Personal-entry ownership remains unchanged; founder ask 7 remains relevant at G9 cutover.

## Complete-suite failures

- reporting route keeps staff desk guards and fails closed without source credentials
- named Jat operator can write and read Living; unsigned, expired and other-unit access is denied
- missing staff configuration denies every staff API and cannot issue a session
- hosted preview cannot bypass staff auth through the demo GET shortcut
- production ignores a stale opt-out even if dummy mode was accidentally left on
- real-data runtime never permits the local opt-out
- scheduler secret grants only the exact Living sync GET, never other desk APIs
- control maps only requested report metrics and keeps actual operational work counts
- book outage cannot hide a successful sheet projection or invent zero contracts
- other Bison pages do not request the new reporting projection
- /books/plan needs a member session, forwards the verified account id and never a browser member id
- Earn switch routes list and application writes to Central with member identity and no local fallback
- Central signature binds actor/body, rejects missing keys, tampering, old requests and replay
- Central Save reads and changes the exact member order, with reader/location/finance restrictions
- Earn publish → member application → Central update is one idempotent, member-scoped record
- Publish guards reject stale sources, unchecked terms and invalid pay; production rejects preview operations
- Central Live lists the same canonical booking and cancellation; reader sees no member records
- Connected demo requires local preview, scopes the residence and preserves closed jobs on reload
- NiaBooks reads the Central projection through the member session; score consent and demo publication are gated
- Command Center reads aggregate unit metrics through signed access without exposing records
- HTTP session, role enforcement, no CSRF and persistent duplicate request protection
- concurrent reservations from different accounts cannot oversell the last unit
- recovery creates a request without changing ownership or exposing member data
- production cannot use preview accounts or memory-only order acknowledgements
- LESS Live reservations share the canonical Living book and authenticated member, with safe retries
- concurrent member requests cannot take the same last Nest; other members cannot read or cancel it
- HTTP routes use session identity, explicit consent and Central acknowledgements; no local fallback
- router verifies actual signed staff tokens including rewritten route; open desk cannot enter
- the complete original Rabbit selftest still passes
