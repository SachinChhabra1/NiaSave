# Member login spec — WhatsApp Cloud API primary

Status: 19 September 2026. **Build-ready spec, not live wiring.** Do not flip `COMMERCE_MEMBER_AUTH`, `COMMERCE_REQUIRE_CENTRAL_MEMBER`, `COMMERCE_REQUIRE_CENTRAL_IDENTITY`, `DEMO`, `DUMMY_DATA`, or any payment flag. Do not send a real or fake OTP from NiaSave. Payments stay off.

Primary login is **WhatsApp Cloud API on the existing Nia number** (direct Graph, not a BSP, not a new number). Repeat sign-in is a **WebAuthn passkey** registered at operator-assisted enrolment (“Sign in with your phone”). SMS OTP via MSG91 is a **later fallback** where WhatsApp coverage fails in the field. DLT (Principal Entity + header + templates) is a **parallel** workstream and does **not** gate launch.

NiaSave never owns the identity record. The only member id it may use is the one Central returns on a verified session.

---

## Who owns what

| Layer | Owner | Does | Does not |
|---|---|---|---|
| Possession proof | Central / Assam, via existing Cloud API | Prove the WhatsApp number, map to enrolled KYC member, issue session | NiaSave must not talk to Graph |
| Canonical member | Central / Assam | `{member, studio, JCO}` — same record as `member.identity` | Dual-copy into Neon / `nia_runtime_state` |
| Repeat credential | Central passkey kinds (already allowlisted) | Register at operator enrolment; verify on later visits | Treat passkey as an OTP |
| Member UI | NiaSave | Collect phone, collect code, host WebAuthn, hold HttpOnly session cookie | Store member/studio/JCO, send WhatsApp, invent ids |
| Member messaging product | Existing Nia WhatsApp product on the **same** number | Utility / session / marketing to members | Carry login OTPs (Meta forbids this in those categories) |

Central allowlist today (`src/lib/service-auth.ts` on rafiqi-central): `member.lookupByPhone`, `member.enrol`, `member.recover`, `member.status`, `passkey.options|verify|session|logout`, plus earn/plan/partner/living. **Not yet allowlisted:** `identity.verify.request`, `identity.verify.confirm`, `member.identity`, `member.profile`. Those 400 `unknown_request` until Assam lands them.

NiaSave already calls signed `POST {CENTRAL_ORIGIN}/api/service/member` with `x-niasave-signature` over `niasave-to-central-v1\n` (`CENTRAL_COMMERCE_KEY`). Keep that envelope. Subject for the handshake is the existing placeholder `phone-bootstrap` (same rule as `member.lookupByPhone`). After verify, subject is the Central member id — never the phone.

---

## Flow

```
member enters +91… on niasave.com
        │
        ▼
NiaSave POST /api/commerce/auth/request
        │  signed envelope kind identity.verify.request
        │  { phone, channel: "whatsapp" }
        ▼
Central / Assam
  1. Rate-limit by IP + phone (do not leak roster).
  2. Map phone → enrolled KYC member. Unknown and known
     return the same public shape { challenge }.
  3. If enrolled: send AUTHENTICATION template on the
     existing Nia Cloud API number. Store code hash +
     WhatsApp identity hash server-side. Never return the code.
        ▼
member types the code (or COPY_CODE / ONE_TAP)
        │
        ▼
NiaSave POST /api/commerce/auth/verify
        │  kind identity.verify.confirm { challenge, code }
        ▼
Central verifies hash, maps to member id, issues session token
        │
        ▼
NiaSave sets HttpOnly cookie from Central token (no member id in JSON)
        │
        ▼
NiaSave GET /api/commerce/identity
        │  kind member.identity (alias member.profile)
        ▼
Central returns one { member, studio, JCO }. NiaSave displays; does not persist.
```

Repeat visit: `POST /api/commerce/auth/passkey/options` → `…/verify` → existing `passkey.*` kinds. UI copy is “Sign in with your phone”, not a code. Passkey public keys live on Central, bound to the stable member id from the WhatsApp enrolment, not to the typed phone.

Lost device / changed phone: Central `member.recover` (already allowlisted). Operator re-enrols. NiaSave does not invent a recovery OTP.

---

## Central kinds to add

Envelope is unchanged: `{ at, nonce, service: "niasave", member: { subject }, request: { kind, … } }`.

| kind | subject | body in | body out | notes |
|---|---|---|---|---|
| `identity.verify.request` | `phone-bootstrap` | `{ phone: "+91…", channel: "whatsapp" }` | `{ challenge }` opaque, ≤300 chars | Always 200 `{challenge}` for a well-formed Indian mobile. Unenrolled still gets a challenge that will fail confirm. Channel other than `whatsapp` is 400 until MSG91 fallback is built. |
| `identity.verify.confirm` | `phone-bootstrap` | `{ challenge, code }` 4–8 digits | `{ token, account: { id, authSubject, role:"member", name, locationIds } }` | `id` is the enrolled member id. Phone is not an id. 401 `bad_otp` on miss; same message if unknown phone. |
| `member.identity` | verified session subject | `{}` | `{ schemaVersion:1, source:"central", status:"ready", member, studio, jco }` | Already called by NiaSave `#89`. Studio/JCO `null` if missing. |
| `member.profile` | verified session subject | `{}` | **same record as `member.identity`** | Alias only. Assam may prefer this name; one handler, one row. |

Do not add a NiaSave-local identity table. Do not copy the record into Neon.

Existing `member.lookupByPhone` stays for enrolment gates. Login must not use it as the session.

---

## NiaSave endpoints (already exist; remap later, not now)

| NiaSave | today | target |
|---|---|---|
| `POST /api/commerce/auth/request` | `COMMERCE_IDENTITY_URL/request` or TEST-phone bypass | signed `identity.verify.request` |
| `POST /api/commerce/auth/verify` | `COMMERCE_IDENTITY_URL/verify` | signed `identity.verify.confirm` |
| `POST /api/commerce/auth/passkey/options\|verify` | `passkey.*` when `COMMERCE_MEMBER_AUTH=passkey` | unchanged; enrolment after WhatsApp verify |
| `GET /api/commerce/identity` | `member.identity` (`#89`) | keep |
| `GET /api/commerce/test/identity` | labelled TEST, no Central | keep; `test:true` |

The live `COMMERCE_IDENTITY_URL` adapter is the **wrong** primary. Do not point it at MSG91. Do not stub Graph from NiaSave.

---

## WhatsApp Cloud API handshake (Central only)

Reuse the existing Nia Cloud API app / WABA / **same display number**. Keys live on **Central production Vercel**, never NiaSave, never the browser.

Intended names (human sets values; agents do not invent them):

| Env on Central | Use |
|---|---|
| `WHATSAPP_CLOUD_TOKEN` | Graph bearer (system user, `whatsapp_business_messaging`) |
| `WHATSAPP_PHONE_NUMBER_ID` | Existing Nia sender |
| `WHATSAPP_WABA_ID` | Existing WABA |
| `WHATSAPP_APP_SECRET` | `X-Hub-Signature-256` on the webhook |
| `WHATSAPP_VERIFY_TOKEN` | Webhook subscribe challenge |

Send (Central → Graph), authentication category **only**:

```
POST https://graph.facebook.com/v21.0/{WHATSAPP_PHONE_NUMBER_ID}/messages
Authorization: Bearer {WHATSAPP_CLOUD_TOKEN}
{
  "messaging_product": "whatsapp",
  "to": "91XXXXXXXXXX",
  "type": "template",
  "template": {
    "name": "<approved AUTHENTICATION template>",
    "language": { "code": "en" },
    "components": [
      { "type": "body", "parameters": [{ "type": "text", "text": "<code>" }] },
      { "type": "button", "sub_type": "url", "index": "0",
        "parameters": [{ "type": "text", "text": "<code>" }] }
    ]
  }
}
```

Template rules (Meta, not optional):

- Category **AUTHENTICATION**. Preset body: `<VERIFICATION_CODE> is your verification code.` Optional: “For your security, do not share this code.” Optional expiry minutes.
- Button: `COPY_CODE` (web) or `ONE_TAP` (Android app). Utility and marketing templates **cannot** carry an OTP; Meta will reject or recategorize.
- Store the Cloud API identity hash from the first successful send and send it on later messages to that `wa_id` (identity-change check). A recycled Indian mobile is not proof of the same WhatsApp account.

Webhook: existing Nia inbound URL must **split** by payload:

- `statuses` for the AUTHENTICATION template → login delivery/failure only.
- inbound member chat / utility / marketing → existing member-messaging product.
- Login code replies typed in WhatsApp chat are **not** a verify path; verify is the NiaSave form (or ONE_TAP). Do not let the messaging inbox consume or display the OTP.

---

## Same-number constraints (must not collide with member messaging)

The login product and the member messaging product share one phone number, one WABA, one throughput budget.

1. **Category isolation.** Login = AUTHENTICATION templates only. Member messaging stays utility / session / marketing. Never one template for both.
2. **Pair rate.** Cloud API limits ~1 outbound / 6s to the **same** user. A marketing blast plus a login OTP to one member will 429 (`130429` or pair-limit). Queue login ahead of marketing to that `wa_id`.
3. **Shared throughput.** Default 80 mps (20 mps if the number is also on WhatsApp Business app coexistence). Login and Nest broadcasts compete. Do not raise a second number to dodge this.
4. **Quality / template pause.** A paused AUTHENTICATION template stops **all** logins. A paused marketing template must not be able to pause auth (separate template names, separate reviews).
5. **1 Oct 2026 billing.** Utility templates **inside** the 24-hour customer-service window become billed. Authentication was already billed per delivered message. Do **not** “save money” by stuffing the login code into an in-window utility reply — that is a category violation. Budget India AUTHENTICATION rates for every login send, in or out of window.
6. **No new number, no BSP.** A second WABA or a BSP (Gupshup, etc.) splits identity and breaks “same Nia number”. Out of scope.

---

## Repeat layer — passkey

After a successful WhatsApp verify, if the device has no passkey, Central issues a short-lived `setupToken` (existing passkey register path). Operator-assisted enrolment at the Nest: member unlocks the phone, NiaSave runs `passkey.options` / `passkey.verify` with `mode: "register"`. Label: **Sign in with your phone**. Not an OTP, not a PIN stored in localStorage.

Later visits skip WhatsApp if the passkey ceremony succeeds. WhatsApp remains the recovery / new-device path.

`COMMERCE_MEMBER_AUTH=passkey` already exists in NiaSave (`lib/commerce/passkeys.mjs`). **Leave it unset on production** until Central’s register path is proved against a real enrolled member.

---

## SMS OTP via MSG91 — fallback only, later

Add only where WhatsApp delivery fails in the field (no WhatsApp account, identity-hash mismatch, AUTHENTICATION template paused).

- Channel `sms` on the same `identity.verify.request` kind, implemented later.
- Env on Central only: `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`, `MSG91_SENDER_ID`.
- Same Central verify; NiaSave does not grow a second adapter.

**DLT (parallel, not a launch gate):** Principal Entity registration, header (sender ID), and DLT-approved SMS templates at the TRAI principal. Start the paperwork now. Launch WhatsApp login without waiting for DLT. Do not send promotional SMS on the auth header.

---

## Blocked pending Central / Assam

NiaSave cannot make a real member sign-in work until these exist on Central production:

1. Allowlist + handlers: `identity.verify.request`, `identity.verify.confirm`, `member.identity` (and `member.profile` alias).
2. Assam phone → enrolled KYC member map used by the handshake (unknown phones indistinguishable).
3. Cloud API send of an **approved AUTHENTICATION** template on the existing Nia number; webhook split from member messaging.
4. Session token + `passkey.*` register bound to that member id.
5. Operator enrolment desk (Nest) that issues the passkey setup token after KYC.

Until then: live non-TEST phones stay `otp_unavailable`. TEST phone `+917000000001` stays the labelled bypass. Do not fake Graph. Do not flip auth or payment flags.
