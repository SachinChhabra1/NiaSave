# Codex launch hardening — 10 September 2026

This is a code review and handoff record, not production acceptance.

## Release state

The production-member-release branch is already contained in main (checked against 3c57be0a0f69817d9582d86e3f582070221864cb; zero commits ahead, eight behind). Do not merge an obsolete branch or infer a deployment from this. Apply docs/production-member-cutover.md to the reviewed current artifact once Sachin confirms the five-secret bundle. His 10 September instruction pre-approves unattended cutover and member-release merge after that confirmation; a second discretionary approval is not required.

The connected Vercel team listed zero projects and direct lookup of niasave returned 404 on 10 September. No live environment, protection, deployment or Neon setting was changed in this review. Environment access and secret confirmation remain blockers.

PR #30 predates production cutover and says to keep demo/dummy mode on for www.niasave.com. Do not apply those instructions to the member production release. The new production book is operation-polo-production; retain the old demo and Living books as the cutover runbook requires.

## Codex execution update - 10 September 2026 06:05 UTC

Completion A boundary was rechecked live from this lane (status codes only):

| Probe | Result |
| --- | --- |
| `POST https://rafiqicentral.com/api/service/member` (unsigned) | `401` |
| `GET https://www.niasave.com/` | `401` |
| `POST https://www.niasave.com/api/auth/login` (preview-member probe) | `410` |
| `GET https://www.niasave.com/ops.html` | `401` |
| `GET https://www.niasave.com/desk.html` | `401` |
| `GET https://www.niasave.com/bison-data.html` | `401` |
| `GET https://www.niasave.com/dispatch.html` | `401` |

Signed-path evidence without exposing keys:
- Founder/Owen validated signed `POST /api/service/member` returns `200` with the production key pair.
- Vercel production runtime logs for `rafiqi-central` on `/api/service/member` in the latest window show both `401` and `200` responses after redeploy.

Thursday items 2-5 status:
1. **SSO decision - done:** keep Vercel Authentication enabled on Preview for `niasave` and `rafiqi-central`, and on all deployments for `niasave-access-uat` and `rafiqi-central-access-uat`.
2. **Rotation verify - in progress:** current boundary checks pass (unsigned failure + signed success), but old-value rejection proof for invitation/bypass rotations still needs human-operated evidence.
3. **Delete dead login vars - in progress:** no runtime code references remain for `RAFIQI_LOGIN_EMAIL`, `RAFIQI_LOGIN_PASSWORD`, `RAFIQI_ROLE_ASSIGNMENTS`, or `RAFIQI_SESSION_SECRET`; environment-level deletion evidence remains pending.
4. **Admin lists - in progress:** NiaSave named staff roles still scope Ajay to Living only; central-side list confirmation remains in the central lane.

Friday hardening items started (payments excluded):
- NiaSave production headers validated on live responses (`Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, strict CSP; invite and desk gates still enforce 401).
- Staff cookie hardening spot-check passed: `POST /api/v1/staff/logout` returns `200` and clears `__Host-nia_staff_page` with `Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`.
- UAT protection validated: direct unauthenticated requests to `niasave-access-uat.vercel.app` and `rafiqi-central-access-uat.vercel.app` redirect to Vercel SSO (`302` to `vercel.com/sso-api`).
- NiaSave production health endpoints return `200` with `demo:false` and connected Postgres-backed stores.
- Central and NiaSave runtime status baselines captured from Vercel logs for alert tuning (`/api/service/member` shows `401` and `200`; NiaSave shows expected `401` gate and `410` preview-login rejection traffic).
- Member API alias hardening fix prepared in NiaSave: `/api/api/commerce/*` is now treated as a member API alias by the invitation middleware, preventing unauthenticated alias bypass to a `503` path; this is covered by an added regression case in `member-invitation.test.mjs`.
- Production-grade verification rerun after the alias fix: `test:security` (`19/19` pass), `test:commerce` (`90/90` pass), and `build:production` pass (existing `tanot-longewala-post.jpg` unresolved-at-build warning unchanged).

Blocking follow-ups:
- `rafiqi-central/docs/launch-log.md` heartbeat append is still blocked from this workspace because the central private repository path is not available here.
- **Request for Owen (done-when):** append this lane heartbeat in `rafiqi-central/docs/launch-log.md` with current UTC time, Completion A status (`A green`), and NiaSave/Vercel hardening state (`items in progress as listed here`).
- Ajay's legitimate production correction proof, drain/alert live-fire proof, and Neon PITR restore proof remain pending human or central-lane execution.

## Changes prepared

- Staff API authentication defaults on, including on hosted Preview. STAFF_AUTH_REQUIRED=0 opens desks only in an explicitly local demo; it cannot open a hosted or real-data runtime.
- Remove built-in administrator password and signing-key fallbacks. Missing/short signing configuration cannot issue or accept a staff token. Ajay's independent password and desk permissions remain unchanged.
- Dummy GET shortcuts no longer bypass an enabled staff gate. Staff JSON responses prohibit caching and MIME sniffing.
- Vercel headers add HSTS (one year, current host only), MIME protection, referrer policy, device restrictions and denied framing. Member entry points use same-origin scripts without inline or eval execution. Global legacy policy retains inline execution for existing desk handlers and the existing unpkg dependency; this is a compatibility allowance, not full XSS remediation. Validate the deployed member and staff flows before promotion.
- Existing passkey cookies are host-only, HttpOnly, Secure, SameSite=Strict, scoped to /api/commerce. Ceremony lifetime is five minutes; member session lifetime is twelve hours. Tests pin these bounds. Legacy staff auth currently returns a twelve-hour bearer token to the existing desk client; it is not an HttpOnly cookie session.
- Static desks now challenge with 401 and the existing sign-in UI before returning desk contents. Signed staff page cookies use Secure, HttpOnly, SameSite=Strict, host-only scope and the remaining signed token lifetime. Ajay's page access is limited to Living; Sikh/Dogra return 403. The existing bearer API contract is retained; page cookies do not authorize data APIs.
- NiaSave's exact Living cron GET accepts its verified CRON_SECRET before the general staff gate; the secret cannot access another desk API. Missing/invalid secrets still fail. This changes no Central cron code.
- CI now includes commerce and security boundary tests.

## Still required before acceptance

| Item | Evidence needed |
| --- | --- |
| Static desk gate | Implemented and locally tested for desk pages, clean aliases, tampering, expiry and unit permissions. Hosted browser login, navigation from Central, cookie delivery and unauthenticated domain checks remain required. The Cloud Browser rejected the isolated local URL with ERR_BLOCKED_BY_CLIENT, so no visual/browser sign-in proof is claimed. |
| Production boundary | Central service: unsigned 401 service_auth_required, correctly signed 200. NiaSave: invite gate, real member sign-in, rejection of preview-member login, unauthenticated desk/API rejection. |
| Staff handover | Ajay's own login, Living read, Sikh/Dogra denial; his one legitimate correction with audit reference, persisted book version and reload. No fabricated records. |
| Role lists and old variables | Named people per environment; preserve the documented Preview-only Sachin mailbox exception until the intended mailbox works. Retired shared-login variables absent everywhere; real sign-in/action/cron still work. |
| Rotations | Paired signing values, showcase password, Aug 26 bypass and invitation password rotated by human; old failures and new passes recorded. No invitations before invitation-password rotation. |
| Preview and UAT | SSO remains on; test-alias exception only if needed and logged. Access-UAT behind Vercel Authentication or deleted; no production database URL. |
| Neon | Preview row checks include runtime JSON books, member enrolment, identity/passkey and fulfilment tables. Record aggregate counts only; no real member records in previews. PITR window verified and a restore exercised against an isolated branch. Git branch deletion cleans up only its mapped nonproduction Neon branch. |
| Rollback | The cutover doc names a pre-cutover showcase URL; verify the actual current previous immutable deployment and captured settings from Vercel. Historical URLs alone do not prove the rollback target. |

## Monitoring acceptance

Configure the approved receiver as a Vercel drain for each production project, with 30-day retention and named access. Do not send logs to an invented destination. Initial alert thresholds to configure: OTP send failures at least 5 attempts and over 10% failures in 5 minutes; API 5xx at least 5 and over 2% in 5 minutes; cron success absent for more than twice its actual schedule interval plus 5 minutes; service-auth 401 at least 10 in 5 minutes. Tune against observed traffic and retain a nonzero-volume guard.

Grok owns Central OTP outcome and cron-success event instrumentation. Request those changes through Central/docs/launch-log.md with a done-when. NiaSave service-auth and request status events need safe route labels; never log raw errors that might include credentials, bodies, phones, or signed envelopes. Vercel access logs can supply HTTP status counts but do not establish OTP provider outcomes or successful cron completion.

Once the drain is configured, send a bounded burst of 12 deliberately invalid service requests (no real member identifiers, no database mutations), wait for the configured window, and record the alert/event ID, time, count, project, deployment and receiver retention proof. Do not run the burst before an alert can be observed. A test runner printing an alert or a log line is not a proven live alert.

Saturday 12 September: publish actual evidence at 08:00 IST; freeze at 09:00 IST, only P0 fixes after. General member invitations remain out of scope.

## Validation at this revision

90 commerce tests, 26 Living/auth/cache tests, 19 security checks, six Dogra tests and the Sikh self-test pass. The member production build passes. Real database integration tests skipped because no DATABASE_URL is available. The local source checkout excludes binary artwork; an image-path build warning does not establish a missing production asset. Hosted visual validation remains pending.
