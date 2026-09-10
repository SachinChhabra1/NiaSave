# Friday hardening attestations (Codex lane)

Timestamp: 2026-09-10 08:24 UTC  
Scope: NiaSave + Vercel hardening evidence only.  
Explicitly excluded: payments, SMS OTP purchase, Send money rails, insurance.

## Automated attestation bundle

### 1) Completion A boundary remains green (status codes only)

| Probe | Status |
| --- | --- |
| `POST https://rafiqicentral.com/api/service/member` (unsigned) | `401` |
| `GET https://www.niasave.com/` | `401` |
| `GET https://www.niasave.com/ops.html` | `401` |
| `GET https://www.niasave.com/desk.html` | `401` |
| `POST https://www.niasave.com/api/auth/login` (preview-member probe) | `410` |
| `GET https://www.niasave.com/api/api/commerce/catalogue` | `401` |

Signed path note: Founder/Owen already validated signed `POST /api/service/member` returns `200`.

### 2) Rotation evidence (no secret values)

| Rotation check | Status |
| --- | --- |
| Invitation with no auth (`GET /`) | `401` |
| Invitation with stale probe Basic credential (`GET /`) | `401` |
| Access-UAT stale `_vercel_share` probe | `302` (SSO challenge) |
| Central access-UAT stale `_vercel_share` probe | `302` (SSO challenge) |
| Access-UAT fresh share link (first hop / followed) | `307` / `200` |
| Central access-UAT fresh share link (first hop / followed) | `302` / `200` |

### 3) Deployment protection posture

- `niasave`: Vercel Authentication enabled on `preview`
- `rafiqi-central`: Vercel Authentication enabled on `preview`
- `niasave-access-uat`: Vercel Authentication enabled on `all`
- `rafiqi-central-access-uat`: Vercel Authentication enabled on `all`

### 4) Merge and production rollout evidence

- PR #33 merged to `main` (`924046394f037354103e2cb8043f015d27c24559`)
- PR #34 merged to `main` (`da1133b6d0b2be8714c5e42ab932e725cc61a239`)
- Current NiaSave production deployment from PR #34 merge: `dpl_Hr8E5eNmvi79r7SqwZAcBiU1i1AS` (Ready)

### 5) Automated boundary tests

Latest run:
- `node --test api/jat-staff-access.test.mjs lib/staff-pages.test.mjs api/staff-auth.test.mjs`
- Result: `7/7` passing
- Includes Ajay living-only scope and Sikh/Dogra denial checks.

Source-level old-variable check:
- No non-doc code references found for retired Central shared-login variables:
  - `RAFIQI_LOGIN_EMAIL`
  - `RAFIQI_LOGIN_PASSWORD`
  - `RAFIQI_ROLE_ASSIGNMENTS`
  - `RAFIQI_SESSION_SECRET`

### 6) Runtime baseline snapshot

- NiaSave production runtime (last 30 minutes): `401`, `410`, `200`, `404` only; no runtime error groups.
- Central `/api/service/member` boundary checks remain green for launch criteria (`POST` unsigned `401`, signed `200` already validated). A prior `GET` 500 sample was observed on an older production deployment; current direct `GET` returns the site HTML shell (`200`) while signed/unsigned `POST` remains the acceptance boundary.

## Remaining human-only attestations

1. Ajay legitimate production Living correction (audit ref + persisted version + reload proof).
2. Launch-log heartbeat entry in `rafiqi-central/docs/launch-log.md` (Owen filing).
3. Drain configuration + bounded invalid-request burst + alert/event retention proof.
4. Neon PITR window verification + isolated restore evidence.
5. Central-lane attestation for old/new secret rotation acceptance/rejection where old credentials are human-held.
