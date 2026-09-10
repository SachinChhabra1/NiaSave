# Staff hardening: code closure, 10 September 2026

This change reconciles PR #38 with merged PR #39. It preserves #39's active-session API/page checks and closes the remaining process-local limiter and raw-error handling gaps in the current source. It does not claim Production acceptance.

## Behaviour

- Staff login uses compare-and-swap updates in the existing `nia_runtime_state` table, key `staff-login-limits-v1`. No new database or schema migration is required. IP and normalized identity have separate hashed keys; changing IP does not reset the identity budget.
- Defaults are 30 attempts per IP and 8 per identity in 15 minutes, including successful attempts. Existing `STAFF_LOGIN_MAX_PER_IP`, `STAFF_LOGIN_MAX_PER_IDENTITY`, and `STAFF_LOGIN_WINDOW_MS` overrides must be bounded integers. Invalid values use defaults.
- Exhausted limits return 429 `too_many_attempts` with the remaining window in `Retry-After`. Missing/unavailable durable storage in hosted environments returns 503 `staff_login_unavailable`, without a token or cookie. Only non-hosted processes can use memory counters. Active buckets are never evicted to admit new keys; capacity/conflict exhaustion fails closed.
- Hosted IP extraction uses `x-vercel-forwarded-for`, documented in [Vercel request headers](https://vercel.com/docs/headers/request-headers#x-vercel-forwarded-for). If absent, requests share the unknown-IP budget rather than trusting arbitrary forwarded values.
- API/storage logs carry fixed event labels only. Request paths, state keys, raw exception messages and stacks are omitted. Null exceptions retain the generic 500 response.
- The archived-domain assembler carries the reviewed safe-error overlay and rejects an unknown archived error layout. This overlay covers logging only: it is not proof that an older archived API has the current session/throttling implementation.

## Isolated verification

Regression coverage includes different-IP identity limits, simultaneous independent limiter instances, cache resets, compare-and-swap conflicts, store outages, expiry, capacity and invalid numeric configuration. SQL-protocol fixtures exercise the actual runtime-store adapter, session registration/revocation and page replay denial after an external version change. They are not a live Neon integration or a hosted acceptance test. No Production member/order/charge or credentials are used.

## Still required before final acceptance

Verify this exact commit on the immutable deployment serving www.niasave.com, including any archived assembly path. Verify the Production durable store and hosted login/logout/replay with an authorized real staff user. Preserve Ajay's Living-only permissions and record only his legitimate correction's audit reference, book version and reload. Do not create fictitious records.

Shared non-Ajay credentials, named-account migration, compatible script CSP, actual rotations, signed Central access, source/cron success, alerts, isolation and rollback gates are not closed by this patch. Humans set secret values privately. No member invitations without the invitation rotation and go/no-go.
