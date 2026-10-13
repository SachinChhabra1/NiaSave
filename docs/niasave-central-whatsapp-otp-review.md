# NiaSave + RafiQi Central WhatsApp OTP alignment review

Status: owner-review handoff for the aligned candidate published only to the private ambitionii/NiaSave-OTP-review repository. This is source-level readiness evidence, not proof of a paired deployment, live configuration, WhatsApp delivery, or real-member acceptance.

## Baselines and scope

- Worktree: `alignment/otp-20260925-e6a395d`.
- NiaSave baseline: `e6a395d03316263d9f2c825fe19f22fe944f3bc6`.
- Central audited baseline: `c3ea185d1e579379ead3d8b00693deaf1cf172c0`.
- These retry-observed SHAs were not separately owner-confirmed frozen SHAs.
- The reviewed reference patch 003cae5168df746bbe820cd9dc3f8112d3650152 was aligned on top of the stated NiaSave baseline. Publication is limited to the private review repository; no push, merge, or PR to either Sachin-owned repository, and no deployment, migration, connector call, real database call, Meta call, or credential read was performed.

Central remains the owner of eligibility, KYC/access state, canonical member ID, auth-version authority, and governed location scopes. NiaSave keeps the signed `/api/service/member` contract and does not add identity or schema architecture.

## Central source audit supplied for this review

The Central audit was performed remotely through the authorized review channel; no full private Central checkout or local Central test run was available here.

- At `c3ea185d1e579379ead3d8b00693deaf1cf172c0`, `src/lib/member-whatsapp.server.ts` exports `requestWhatsappIdentity`, `confirmWhatsappIdentity`, and `memberIdentity`; the signed NiaSave member contract is unchanged.
- Since `89e757b8`, Central has 13 commits, mainly operations/funnel UI, migration 0074, and related connectors. The OTP server, service-auth, and schema files were not listed as changed in the supplied audit.
- OTP request requires a normalized Indian phone, `channel: whatsapp`, and a validated client IP. Central requires `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`, and a `WHATSAPP_OTP_HASH_KEY` of at least 32 characters. The template is `nia_member_login`; language is `hi` only for `preferred_language === hi`, otherwise `en`.
- Central alone checks the unique approved enrolment joined to active, KYC-approved, non-revoked access. It stores protected code/phone and an opaque ten-minute challenge; confirmation is transactional, single-use, and capped at five attempts. It returns the canonical account ID, a 64-hex auth version, and governed locations/modes/pins.
- Delivery is outside the confirmation transaction and only safe `delivery_failed` telemetry is emitted. A successful challenge is not proof of WhatsApp delivery. Revalidation checks current eligibility, phone, and auth version.
- No claim is made that these source facts describe a live deployment. Local Central tests were not run.

## Central source versus deployment status

- **Compatible SOURCE contract:** source inspection of the supplied Central audit indicates that the signed member contract, OTP ownership, canonical identity, auth version, and governed location scope contract are compatible with this NiaSave candidate.
- **DEPLOYMENT:** not verified. The source-compatible contract is not evidence that the intended Central deployment, schema, credentials, templates, member eligibility, or WhatsApp delivery are configured and live.
- The supplied audit reports that Central's current gate fails at `npm test` after build and server boot, and that `ui-parity` also fails. The root cause has not been established. No local Central test run was performed.

## Alignment changes

- Real OTP bootstrap now uses `central.identityClientIp(req)` for its durable 60-attempt/15-minute IP bucket. The TEST lane uses the same auth-only identity helper. Vercel trusts only the existing overwritten `x-vercel-forwarded-for`; generic `x-forwarded-for`, body values, and invalid/missing edge headers are not trusted. Invalid/missing hosted headers fall into a shared non-bypassable bucket; non-hosted/test callers retain socket identity.
- Personal-password login now keys the restored process-local 20-attempt/15-minute defense-in-depth limiter with the same trusted identity as the durable 20-attempt gate. The shared `MEMBER_PASSWORD` fallback, threshold, and strict Central-member policy remain unchanged.
- The regression suite proves two valid Vercel IPs sharing one socket do not collide: client A exhausts its personal-login budget, client B logs in twice without a limiter reset or new handler, and A remains denied. A separate bootstrap test proves the same distinction while the phone/global limit remains active.
- Existing reviewed auth behavior remains: durable one-time setup grant reservation and atomic consumption; Central revalidation before setup/login/session issuance; signed sessions; Central revocation failure; empty Central locations remain empty; no invented `S01` grant.
- Personal credentials are versioned salted scrypt records with no `passwordDigest`. A legacy per-phone digest migrates only after successful Central revalidation and only after the durable upgrade write succeeds. No weak duplicate digest is persisted for rollback.
- OTP request timeout alignment remains narrow: request paths receive the longer request budget; ordinary auth/Central calls retain their existing bounded budgets.

## Necessary authentication UI differences

The current fresh-browser password screen now asks for both the Indian mobile number and the personal password created after verification. The phone field is a 10-digit numeric telephone input with `+91` presentation, local validation, normalized submission, and the existing stay-signed-in control. The copy changes from a Nia-team shared password to a personal password; Bangla and Tamil maps add the corresponding strings while existing English/Hindi/fallback localization paths remain intact. This is the required auth UI change only.

The latest mobile-centered shell, desktop centered layout, navigation, styles, touch controls, accessibility labels, and browser layout assertions remain preserved. No blanket “zero UI change” claim is made.

## Boundaries verified

- Source changes are limited to the reviewed auth helpers, HTTP auth gates, member-auth tests, required auth markup/locales, write-freeze preservation for auth state, and these handoff docs.
- `git diff HEAD --name-only` contains no `api/connectors.mjs`, `lib/commerce/catalogue-connector.mjs`, `lib/commerce/central-client.mjs`, or `lib/commerce/central-auth.mjs`; connector/runtime behavior and signing helpers were not edited.
- No NiaSave migration, Central source edit, package lock, package/build/CI config, deployment setting, or connector change is part of this alignment.
- Tests use only injected local fixtures and fake Central responses. They do not establish paired deployment behavior, Meta delivery, or WhatsApp UAT.

## Files changed relative to `e6a395d`

`commerce-locales/bn.js`, `commerce-locales/ta.js`, `commerce-member-auth.js`, `commerce.js`, `docs/niasave-central-whatsapp-otp-review.md`, `docs/niasave-central-otp-roadmap-aligned.md`, `lib/commerce/http.mjs`, `lib/commerce/member-auth-cold-start.test.mjs`, `lib/commerce/member-auth-concurrency-worker.mjs`, `lib/commerce/member-auth-concurrency.test.mjs`, `lib/commerce/member-auth-hardening.test.mjs`, `lib/commerce/member-password.mjs`, `lib/commerce/member-phone-auth.test.mjs`, `lib/commerce/write-freeze.mjs`, and `tests/browser/member-controls.spec.js`.

## Configuration and owner checks

Verify names and semantics only; never copy values into this document or test output.

Required Central names: `DATABASE_URL`, `CENTRAL_COMMERCE_KEY`, `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_OTP_HASH_KEY`.

Required NiaSave names for the reviewed real-member path: `DATABASE_URL`, `SESSION_SECRET`, `CENTRAL_ORIGIN`, `CENTRAL_COMMERCE_KEY`, `COMMERCE_ENABLED`, `DUMMY_DATA`, `COMMERCE_MEMBER_AUTH`, `COMMERCE_REQUIRE_CENTRAL_MEMBER`.

Pending owner checks: intended deployment configuration; migration/configuration/template checks in Central; one uniquely eligible controlled member; approved `en`/`hi` template variants; sender and billing ownership; fresh-browser setup and replay; exact Central scopes including an empty-location case; revocation/suspension behavior; and real mobile WhatsApp delivery.

## Build and Preview routing

- In Preview, `COMMERCE_STOREFRONT=1` selects `commerce.html` at `/`; otherwise `vercel-build.sh` can select the legacy `member.html`.
- The flag's live value is **UNKNOWN**. This is an owner verification, not an automatically changed setting and not a confirmed missing setting.
- The supervisor's test-only storefront build matched `dist/index.html` to `commerce.html`.

## Rollback compatibility

Do not use a generic “return to the previous deployment” after credential writes. Rollback is permitted only to a credential-format-compatible deployment that can read the durable profile format and preserves strict Central-member checks. Do not use the shared `MEMBER_PASSWORD` path to roll back a real Central member, and do not restore or downgrade durable state destructively.

The new scrypt profile is intentionally irreversible to older code that expects only `passwordDigest`. If an older deployment cannot read a written profile, the owner must approve forward repair or recovery using the compatible code/data path. Do not write a weak duplicate digest merely to make an old deployment appear compatible. Preserve Central challenge/session records and legitimate member state while deciding recovery.

## Real UAT boundary

The following remain outstanding and must be completed by the owner on the intended deployment with a controlled real member: request the OTP in a fresh browser, verify receipt from the intended sender/template, complete one-time setup, confirm canonical ID/scopes, log in from a second fresh browser with phone plus personal password, and confirm login plus retained-session requests fail closed after Central revocation/suspension. Fake Central tests and the labelled TEST phone do not satisfy this checklist.

## Final independent verification record — 25 September 2026, 11:13 IST

The supervisor reran the final candidate outside Codex's restricted sandbox after all runtime and browser-test corrections. All listed final checks passed. Evidence is retained in the parent alignment directory in `FINAL_VERIFIED_RESULTS.json` and the `final-verified-*.log` files. These are local fixture results, not live Central, database or WhatsApp acceptance.

| Check | Final result |
|---|---|
| Focused authentication suite (Central client, cold start, concurrency, hardening, member password, member phone auth, TEST login) | 54/54 passed, none skipped |
| `npm run test:commerce` | 316/316 passed, none skipped |
| `npm run test:security` | 46/46 passed, none skipped |
| `npm test` | Passed |
| `npm run build:production` | Passed |
| Test-only `COMMERCE_STOREFRONT=1 npm run build:production` | Passed; `dist/index.html` matched `commerce.html` |
| `npm run test:browser -- --reporter=line` | 16/16 passed |
| `git diff HEAD --check` | Passed |

The browser run used installed Google Chrome through the existing `CHROMIUM_PATH` option, a fresh isolated profile, a local server and mocked commerce API responses. It retained all 14 original upstream pointer/keyboard/layout cases at widths 320, 390, 760, 761, 960, 1280 and 1440 with ready/unavailable catalogues. Two additional cases at 390 and 1280 follow Account -> Member sign in -> Already have a password, reject an invalid phone with an otherwise valid password, and send exactly one normalized personal-password login request with no OTP request. They do not claim that a real member session or real WhatsApp delivery was tested in a browser.

An initial new browser test used the wrong masthead control and failed; it was corrected to follow the actual Account action and rerun successfully. Earlier sandbox `listen EPERM` results are superseded by the successful independent local runs above, not by weakened test expectations. Existing build warnings for `/nia-operator.css` and `/assets/tanot-longewala-post.jpg` remain.

The unchanged upstream NiaSave baseline was independently checked: commerce 295/295, security 46/46 and original browser controls 14/14. Source comparison found no changed protected connector, Central adapter, runtime-store, package/lock, build/CI/config or current shell/style files among the 59 protected paths checked. Necessary authentication UI changes remain explicitly listed above.

Central local tests were not run. Its current upstream gate and ui-parity failures remain unresolved; source compatibility does not make those checks green. No real database/member changes, Meta calls, deployment, environment updates, upstream PR/push/merge or author-spoofing action occurred. The aligned candidate is published only to the private review repository; the original feature/otp-auth-hardening review branch remains preserved.
