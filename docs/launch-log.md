# Launch log (NiaSave Codex lane)

## Codex — 2026-09-10 12:21 UTC — hardening scope cut (P0/P1 only, 45-minute window)

- done | P0 | Re-verify Completion A boundaries on live production: central `POST /api/service/member` unsigned `401`; central `GET /api/service/member` `405`; `www`/`ops`/`desk`/`bison-data`/`dispatch` unauthenticated `401`; preview-member login probe `410`; legacy `order/member` `410`; `stock` `200`.
- done | P0 | Re-verify malformed commerce alias boundary: `GET /api/api/commerce/catalogue` returns `401` (not `503`).
- done | P0 | Run security boundary suite: `npm run test:security` passed `19/19`.
- done | P0 | Run staff/role boundary suite: `node --test api/jat-staff-access.test.mjs lib/staff-pages.test.mjs api/staff-auth.test.mjs` passed `7/7`.
- done | P1 | Re-verify production headers on protected surfaces (`/`, `/ops.html`): strict CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` present.
- done | P1 | Re-verify staff logout cookie clearing: `POST /api/v1/staff/logout` returns `200` and clears `__Host-nia_staff_page` with `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`.
- done | P1 | Re-check retired shared-login variables in runtime code paths (`api/`, `lib/`, `src/`): no matches for `RAFIQI_LOGIN_EMAIL`, `RAFIQI_LOGIN_PASSWORD`, `RAFIQI_ROLE_ASSIGNMENTS`, `RAFIQI_SESSION_SECRET`.
- parked | P2 | Human attestation of old-value rejection/new-value acceptance for in-flight production secret rotation (`BETTER_AUTH_SECRET`, `CENTRAL_COMMERCE_KEY`, `DIGEST_SESSION`) after redeploy settles.
- parked | P2 | Drain configuration + bounded invalid-request burst + alert/event retention proof.
- parked | P2 | Neon PITR window validation + isolated restore evidence.
- parked | P3 | Ajay legitimate production Living correction attestation (audit reference + persisted version + reload).
- parked | P3 | Central-repo heartbeat filing in `rafiqi-central/docs/launch-log.md` (Owen-owned from this lane).

## Codex — 2026-09-10 16:11 UTC — Friday-night production hardening sweep

- done | Safe error logging: removed runtime server logging of raw exception messages/stacks; standardized event logging for API/runtime-store/living/store status paths.
- done | Archived/deployment-assembler API safety: sanitized legacy runtime error surfaces (`bison` sheet sync/import and runtime-store) to stable error codes without raw backend exception leakage.
- done | Login security hardening: added per-IP and per-identity throttling for `POST /v1/staff/login` with stable `429 too_many_attempts` and `Retry-After`.
- done | Logout revocation: introduced active staff-session registration + revocation checks; logged-out bearer/cookie tokens are invalid for API and staff-page access.
- done | Safe API client errors: preserved stable machine error codes, removed raw internal error propagation paths.
- done | Regression proof: `test:security`, `test:commerce`, `test:bison`, new throttling and runtime-store sanitization tests, and `build:production` all pass.
- done | CI verify closure: registered Sikh self-test staff token as an active staff session so `/api/*` legacy probes continue passing after revocation hardening.
- done | PR #39 merged to `main` after green verify + Vercel checks; post-merge live gate recheck passed (`www/ops/desks/commerce-alias 401; preview login + order/member 410; stock 200; Central unsigned POST 401; GET 405`).
- done | Final post-merge parity recheck at 2026-09-10 16:18 UTC confirms unchanged production gates (`www/ops/desks/commerce-alias 401; preview login + order/member 410; stock 200; Central unsigned POST 401; GET 405`).
- parked | Workbook setup, data uploads, Ajay human proof, Neon PITR human attestation, founder-only secret rotation acceptance checks, central launch-log updates in rafiqi-central.

## Codex — 2026-09-10 22:59 UTC — close-out

- done tonight | merged in-scope harden/evidence PRs (#37, #39, #40, #41) and re-verified production gates | still open human-only: workbook/data uploads, Ajay legit production proof, Neon PITR human attestation, founder-only secret rotation attestations, central launch-log filing.
