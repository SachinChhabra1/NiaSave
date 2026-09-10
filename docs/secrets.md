# NiaSave secrets policy

Owner: Sachin Chhabra. Configuration custodian: Codex. Effective 10 September 2026.

## Human entry and access

Agents ask Sachin or his explicitly designated human custodian to generate and set secret values directly in Vercel or the provider console. Agents do not invent, rotate, send, or copy values into chat, Git, PRs, documents, screenshots, build arguments, or logs. A confirmation says which names and environments were set, never their values. This rule supersedes older runbook wording telling an agent to generate credentials.

Keep the recovery copy in the company's approved password manager, accessible to Sachin and designated recovery custodians. Configure Vercel secrets as Sensitive where supported, server-side only, and scope each to its actual project/environment/branch. Never use VITE_ or other client-exposed prefixes for secrets. Restrict production environment management to the named custodians. Runtime service identities receive only the credentials they need. Other agents see names, scope, update time, deployment references, and pass/fail evidence.

Ajay receives only his own JAT_STAFF_PASSWORD through a private human handover. He must not receive the administrator password, signing keys, database credentials, or a shared operator credential. Do not send credentials to him without explicit authorization.

## Inventory and cadence

This table specifies intended placement, not proof that live settings have been audited. Complete the metadata audit against Vercel before sign-off. Rotate immediately after suspected disclosure, unauthorized access, or custodian removal; the cadence below is the maximum routine interval.

| Secret | Where it lives | Access and rotation |
| --- | --- | --- |
| CENTRAL_COMMERCE_KEY (production pair) | Central Production and NiaSave Production, identical new value | Human custodians and the two server runtimes; rotate together every 90 days. Never reuse a Preview key. |
| SHOWCASE_CENTRAL_KEY + CENTRAL_COMMERCE_KEY (Preview pair) | NiaSave isolated showcase runtime and Central Preview for test/showcase | Human custodians and the paired test runtimes; rotate together every 90 days and before a new external showcase. |
| STAFF_TOKEN_SECRET | NiaSave Production only; separate value for each hosted nonproduction environment | Human custodians and staff token runtime; every 90 days. Rotation invalidates all existing legacy staff tokens. No fallback to SESSION_SECRET or a password. |
| STAFF_PASSWORD | NiaSave legacy administrator runtime in the relevant environment | Sachin/designated administrator and server runtime; every 90 days or administrator change. Never used as Ajay's credential. |
| JAT_STAFF_PASSWORD | NiaSave Production; distinct isolated-test value where required | Ajay, authorized human custodian and server runtime; every 90 days, on role transfer, or suspected disclosure. |
| MEMBER_INVITE_PASSWORD | NiaSave Production only | Invitation custodians and outer gate runtime; rotate before any member invitation, on unintended disclosure, and at each invitation cohort change. The password gates entry and does not establish member identity. |
| SHOWCASE_PASSWORD | NiaSave showcase scope only | Authorized showcase custodians and gate runtime; rotate before external walkthroughs and after a shared group changes. After cutover keep distinct from MEMBER_INVITE_PASSWORD. |
| VERCEL_AUTOMATION_BYPASS_SECRET | Vercel Deployment Protection for the exact authorized project; an authorized CI secret store only if a consumer needs it | Human custodians and approved automation only; rotate the Aug 26 value before launch, then every 90 days. Never put in links or query strings. |
| DATABASE_URL / POSTGRES_URL aliases in use | NiaSave production database connection; Central production connection in its own project | Human custodians and each server runtime; provider-supported credential rotation every 90 days. Audit all aliases and consumers before rotation. |
| SHOWCASE_DATABASE_URL | Isolated NiaSave showcase database only | Test custodian and isolated test runtime; every 90 days. Never a production connection, even when showcase is served by a Production deployment. |
| BISON_GOOGLE_SERVICE_ACCOUNT_JSON | NiaSave server environment that reads Living occupancy | Human custodian and Living source reader; every 90 days. Grant only the source document access needed. |
| CRON_SECRET | Each project running its own authorized cron | Human custodian, Vercel scheduler and validating runtime; every 90 days; coordinate producer and verifier. |
| COMMERCE_IDENTITY_KEY | Only a runtime that actually uses the legacy identity adapter | Human custodian and adapter; every 90 days. Passkey mode must not fall back to this identity path. |
| ACCESS_UAT_PASSWORD | Isolated access-UAT environment only | UAT custodians and UAT gate; each test cycle. This does not replace required Vercel Authentication. |
| SESSION_SECRET / provider or Blob credentials, if still referenced | Only verified consumers in the relevant project/environment | Audit usage and ownership first; do not delete active credentials by analogy with Central's dead shared-login variables. Every 90 days or provider requirement. |
| Drain ingestion / signing credentials, when configured | Vercel drain configuration and approved monitoring receiver | Monitoring custodian and receiver; every 90 days; authenticate raw payloads, restrict reader access and retain sanitized events for 30 days. |

Central's active staff-auth, email, and database credentials remain owned by their current runtimes. Codex manages Vercel scope; Grok owns application changes. The four explicitly retired variables are RAFIQI_LOGIN_EMAIL, RAFIQI_LOGIN_PASSWORD, RAFIQI_ROLE_ASSIGNMENTS and RAFIQI_SESSION_SECRET. Delete them from every environment only after verifying deployed code no longer depends on them; prove sign-in, one legitimate saved action and the next scheduled cron afterward. Do not substitute similarly named live secrets.

## Paired rotation procedure

1. Record project/environment names, current immutable deployment IDs and consumers. Keep all secret values out of evidence.
2. The human sets both members of each signing pair before either new runtime is promoted. Stage deployments with the new values; do not expose a half-rotated production pair to traffic.
3. Confirm the production five-secret bundle by name: Central CENTRAL_COMMERCE_KEY, the identical NiaSave value, STAFF_TOKEN_SECRET, STAFF_PASSWORD and the distinct JAT_STAFF_PASSWORD. Use approved in-runtime or human-operated verification to check equality; never reveal the values.
4. Verify the new signed read succeeds, the old key fails, and an unsigned request fails. Check the intended deployment and production domain separately. Compare statuses and error codes only; record neither credential nor returned member data.
5. Rotate STAFF_TOKEN_SECRET with administrator password after suspected credential exposure so a previously issued bearer token cannot survive the password change. Plan staff sign-in again and verify Ajay still has only Living access.
6. For the invitation and Vercel bypass rotations, prove old rejection and new acceptance against the intended scope. A Vercel bypass must not bypass the application invitation or member/staff identity checks.
7. Record timestamp, human setter, names/scopes, deployment IDs and proof references in the launch log. If the old credential is unavailable to an authorized human verifier, mark old-value rejection unproven; do not claim a metadata change proves it.

## Deployment, rollback and retention

Environment edits apply to new deployments; metadata presence alone is not runtime verification. Keep Preview SSO enabled. A temporary Deployment Protection Exception is permitted only for the specific test alias if the showcase is still needed after production cutover; it must retain application-level authentication and an expiry/owner in the launch log.

Identify the exact previous immutable deployment and verify its captured environment before rollback. Preserve real production books and subsequent transactions; never run the old demo configuration against the new production Save book. An immutable deployment containing a revoked secret is not a safe rollback for a secret-compromise incident; prepare a replacement with new secrets in that case.

Exclude Authorization, Cookie, Set-Cookie, signatures, raw URLs/query strings, setup codes, password fields, request/response bodies and database URLs from telemetry. Log event types, safe route labels, timestamps, status counts, deployment IDs and approved audit references. Retention target: 30 days for sanitized operational logs; access restricted to named operators/custodians. Live drain and retention configuration remain a separate required acceptance check.
