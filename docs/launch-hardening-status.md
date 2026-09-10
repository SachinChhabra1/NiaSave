# Codex launch hardening — 10 September 2026

This is a code review and handoff record, not production acceptance.

## Release state

The production-member-release branch is already contained in main (checked against 3c57be0a0f69817d9582d86e3f582070221864cb; zero commits ahead, eight behind). Do not merge an obsolete branch or infer a deployment from this. Apply docs/production-member-cutover.md to the reviewed current artifact once Sachin confirms the five-secret bundle. His 10 September instruction pre-approves unattended cutover and member-release merge after that confirmation; a second discretionary approval is not required.

The connected Vercel team listed zero projects and direct lookup of niasave returned 404 on 10 September. No live environment, protection, deployment or Neon setting was changed in this review. Environment access and secret confirmation remain blockers.

PR #30 predates production cutover and says to keep demo/dummy mode on for www.niasave.com. Do not apply those instructions to the member production release. The new production book is operation-polo-production; retain the old demo and Living books as the cutover runbook requires.

## Changes prepared

- Staff API authentication defaults on, including on hosted Preview. STAFF_AUTH_REQUIRED=0 opens desks only in an explicitly local demo; it cannot open a hosted or real-data runtime.
- Remove built-in administrator password and signing-key fallbacks. Missing/short signing configuration cannot issue or accept a staff token. Ajay's independent password and desk permissions remain unchanged.
- Dummy GET shortcuts no longer bypass an enabled staff gate. Staff JSON responses prohibit caching and MIME sniffing.
- Vercel headers add HSTS (one year, current host only), MIME protection, referrer policy, device restrictions and denied framing. Member entry points use same-origin scripts without inline or eval execution. Global legacy policy retains inline execution for existing desk handlers and the existing unpkg dependency; this is a compatibility allowance, not full XSS remediation. Validate the deployed member and staff flows before promotion.
- Existing passkey cookies are host-only, HttpOnly, Secure, SameSite=Strict, scoped to /api/commerce. Ceremony lifetime is five minutes; member session lifetime is twelve hours. Tests pin these bounds. Legacy staff auth currently returns a twelve-hour bearer token to the existing desk client; it is not an HttpOnly cookie session.
- CI now includes commerce and security boundary tests.

## Still required before acceptance

| Item | Evidence needed |
| --- | --- |
| Static desk gate | Current middleware only protects member routes. /ops.html, the other static desks and direct aliases must return 401 without a staff token while preserving a usable staff login. API 401 proofs alone do not satisfy this. |
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
