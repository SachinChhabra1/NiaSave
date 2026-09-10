# Launch log (NiaSave Codex lane)

## Codex — 2026-09-10 16:11 UTC — Friday-night production hardening sweep

- done | Safe error logging: removed runtime server logging of raw exception messages/stacks; standardized event logging for API/runtime-store/living/store status paths.
- done | Archived/deployment-assembler API safety: sanitized legacy runtime error surfaces (`bison` sheet sync/import and runtime-store) to stable error codes without raw backend exception leakage.
- done | Login security hardening: added per-IP and per-identity throttling for `POST /v1/staff/login` with stable `429 too_many_attempts` and `Retry-After`.
- done | Logout revocation: introduced active staff-session registration + revocation checks; logged-out bearer/cookie tokens are invalid for API and staff-page access.
- done | Safe API client errors: preserved stable machine error codes, removed raw internal error propagation paths.
- done | Regression proof: `test:security`, `test:commerce`, `test:bison`, new throttling and runtime-store sanitization tests, and `build:production` all pass.
- done | CI verify closure: registered Sikh self-test staff token as an active staff session so `/api/*` legacy probes continue passing after revocation hardening.
- in progress | PR, merge, and production gate re-verification (`www/ops/desks/commerce-alias 401; preview login + order/member 410; stock 200; Central unsigned POST 401; GET 405`) after deployment is Ready.
- parked | Workbook setup, data uploads, Ajay human proof, Neon PITR human attestation, founder-only secret rotation acceptance checks, central launch-log updates in rafiqi-central.
