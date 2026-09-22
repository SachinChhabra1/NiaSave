# Central allowlist — Ajay / Assam action

NiaSave remap PR is staged and **unmerged** until these kinds are live. File to edit on **rafiqi-central**: `src/lib/service-auth.ts`.

## 1. Register the three kinds

In `REQUEST_KINDS`, add exactly:

```ts
"identity.verify.request",
"identity.verify.confirm",
"member.identity",
```

Alias: `member.profile` must hit the **same handler** as `member.identity` (one record). Add `"member.profile"` to the allowlist too if you want the alias on the wire.

Subject rules in `assertServiceMember` (same file):

| kind | subject | else |
|---|---|---|
| `identity.verify.request` | `phone-bootstrap` (existing `PHONE_LOOKUP_SUBJECT`) | 403 `member_context_required` |
| `identity.verify.confirm` | `phone-bootstrap` | 403 `member_context_required` |
| `member.identity` / `member.profile` | verified member id (the `account.id` you issued on confirm) | 403 `member_context_required` |

Unknown kind stays `400 unknown_request`.

## 2. Handlers — `src/lib/service-member.server.ts`

Route the three kinds next to `member.lookupByPhone`. NiaSave never talks to Graph.

### `identity.verify.request`

In: `{ phone, channel: "whatsapp", clientIp }`. `clientIp` is derived server-side from the trusted Vercel edge header (or the direct socket locally), never from browser JSON. Other `channel` → 400.

Do:

1. Rate-limit IP + phone. Do not leak the roster.
2. Always return **the same public shape** for any well-formed `+91` mobile: `{ challenge }` opaque, ≤300 chars. Unknown and known are indistinguishable.
3. If and only if the phone maps to **one** KYC-approved active member (`member_enrolments.state = 'approved'` AND `member_access.status = 'active'` AND `member_access.kyc_state = 'approved'` AND a stable `member_id`): send WhatsApp AUTHENTICATION template `nia_member_login` on the **existing** Nia Cloud API number. Store code hash + `wa_id` hash keyed by `challenge`. Never return the code.
4. If not KYC-approved: still return `{ challenge }`. Do **not** send WhatsApp. Confirm will fail closed.

### `identity.verify.confirm`

In: `{ challenge, code, phone }` 4–8 digits.

**Fail-closed on confirm** means:

- The normalized phone must match the phone bound to the challenge. A changed or missing phone fails with the same 401.
- Wrong, expired, or missing challenge → **401**, body `{ error: "bad_otp" }`. Same body for every failure. No “not registered”, no member id, no studio.
- Code matches **and** the phone on that challenge is KYC-approved as above **and** `member_id` exists → **200**:

```json
{
  "token": "<opaque session token>",
  "account": {
    "id": "<Central member_id>",
    "authSubject": "<same member_id>",
    "role": "member",
    "name": "<enrolment full name>",
    "locationIds": ["<studio_id if any>"]
  }
}
```

- `account.id` is **required**. No id → 401 `bad_otp`. Do not invent an id. Do not use the phone as the id.
- Shared phone with more than one KYC-approved member → 401 `bad_otp` (Ajay owns recovery; do not pick one).

NiaSave will refuse to mint a session without `account.id`.

### `member.identity` (alias `member.profile`)

In: `{}`. Subject = the member id from confirm.

Out: `{ schemaVersion: 1, source: "central", status: "ready", member, studio, jco }`. Studio/JCO `null` if missing. Never guess. This is what NiaSave `#89` already calls.

## 3. Do not

- Do not add SMS / MSG91 / DLT.
- Do not add passkeys in this change.
- Do not 200-confirm a `submitted` / `under_review` enrolment.
- Do not copy identity into NiaSave Neon.

Done when a real non-TEST number on niasave.com (after the NiaSave remap is merged) receives `nia_member_login` from the Nia number, enters the code, and gets a session keyed to Central `member_id`.


## Live session revalidation (22 September)

OTP delivery requests have a bounded 30-second Central timeout; ordinary signed reads remain at eight seconds.
Central confirm must return `account.authVersion` (64 lowercase hex), plus its governed `locationIds`, `locationModes` and `locationPinCodes`.
NiaSave binds these values and the verified phone to its signed password-setup cookie, password profile and member session.
Before setup, successful password login or an authenticated commerce request, NiaSave calls `member.identity` with signed `{phone, authVersion}`.
Central checks current phone, KYC/access and identity revision, then returns the current governed account projection. Missing/mismatched identity or revision fails closed; an outage never reuses stale grants.
WhatsApp sessions enforce the Central fulfilment mode and delivery PIN grants. An empty assignment does not acquire a default Studio.
Existing explicit legacy/TEST flows keep their own markers.
