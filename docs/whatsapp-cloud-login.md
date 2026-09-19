# v1 member login — WhatsApp Cloud API only

Status: 19 September 2026. **Handoff spec, not live wiring.** Do not flip `COMMERCE_MEMBER_AUTH`, `COMMERCE_REQUIRE_CENTRAL_MEMBER`, `COMMERCE_REQUIRE_CENTRAL_IDENTITY`, `DEMO`, `DUMMY_DATA`, or any payment flag. Do not send a real or fake OTP from NiaSave. Payments stay off.

v1 is **WhatsApp login on the existing Nia Cloud API number** (direct Graph, same WABA, not a BSP, not a new number). Nothing else.

**Out of v1 (do not spec, stub, or start):** SMS, MSG91, DLT, WebAuthn passkeys. Number-change / recovery is owned by **Ajay Mahawar**, not this build.

NiaSave never owns the identity record. The only member id it may use is the one Central / Assam returns on a verified session.

---

## Flow

```
member enters +91… on niasave.com
        │
        ▼
NiaSave POST /api/commerce/auth/request
        │  signed POST {CENTRAL_ORIGIN}/api/service/member
        │  kind identity.verify.request
        │  subject phone-bootstrap
        │  { phone, channel: "whatsapp" }
        ▼
Central / Assam
  1. Rate-limit IP + phone. Do not leak the roster.
  2. Map phone → enrolled KYC member.
     Unknown and known return the same public { challenge }.
  3. If enrolled: send AUTHENTICATION template on the
     existing Nia Cloud API number. Store code hash +
     WhatsApp identity hash. Never return the code.
        ▼
member types the code (COPY_CODE / ONE_TAP)
        │
        ▼
NiaSave POST /api/commerce/auth/verify
        │  kind identity.verify.confirm { challenge, code }
        ▼
Central / Assam verifies, returns { token, account.id }
        │  id = enrolled member id, never the phone
        ▼
NiaSave sets HttpOnly session cookie from that token
        │
        ▼
NiaSave GET /api/commerce/identity
        │  kind member.identity  (alias member.profile)
        ▼
Central returns one { member, studio, JCO }. NiaSave displays. No Neon copy.
```

Envelope is the existing NiaSave → Central signature (`niasave-to-central-v1\n` + `CENTRAL_COMMERCE_KEY` on `x-niasave-signature`). After verify, `member.subject` is the Central member id.

---

## Central kinds (Assam / Central team)

Allowlist today does **not** include these. They 400 `unknown_request` until landed.

| kind | subject | in | out |
|---|---|---|---|
| `identity.verify.request` | `phone-bootstrap` | `{ phone: "+91…", channel: "whatsapp" }` | `{ challenge }` opaque, ≤300 chars. Always this shape for a well-formed Indian mobile. |
| `identity.verify.confirm` | `phone-bootstrap` | `{ challenge, code }` 4–8 digits | `{ token, account: { id, authSubject, role:"member", name, locationIds } }` |
| `member.identity` | verified session subject | `{}` | `{ schemaVersion:1, source:"central", status:"ready", member, studio, jco }` — already called by NiaSave `#89`. Studio/JCO `null` if missing. |
| `member.profile` | verified session subject | `{}` | **Same handler as `member.identity`.** One record. |

`channel` other than `"whatsapp"` is 400. Do not add an SMS channel.

NiaSave remap (later, when Central is ready — **not now**):

| NiaSave | today | v1 target |
|---|---|---|
| `POST /api/commerce/auth/request` | `COMMERCE_IDENTITY_URL/request` or TEST-phone bypass | `identity.verify.request` |
| `POST /api/commerce/auth/verify` | `COMMERCE_IDENTITY_URL/verify` | `identity.verify.confirm` |
| `GET /api/commerce/identity` | `member.identity` (`#89`) | keep |
| `GET /api/commerce/test/identity` | labelled TEST, no Central | keep |

Do not point `COMMERCE_IDENTITY_URL` at Graph. NiaSave does not call WhatsApp.

---

## WhatsApp send (Central only)

Keys on **Central production Vercel**, never NiaSave, never the browser. Human-set; agents do not invent values.

`WHATSAPP_CLOUD_TOKEN` · `WHATSAPP_PHONE_NUMBER_ID` · `WHATSAPP_WABA_ID` · `WHATSAPP_APP_SECRET` · `WHATSAPP_VERIFY_TOKEN`

Same Nia display number as the member messaging product.

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

Template: category **AUTHENTICATION** only. Preset body `<VERIFICATION_CODE> is your verification code.` Button `COPY_CODE` (web) or `ONE_TAP` (Android). Utility and marketing templates cannot carry an OTP.

Store the Cloud API identity hash from the first successful send and attach it on later sends to that `wa_id`.

Webhook split on the existing inbound URL: AUTHENTICATION `statuses` → login; member chat / utility / marketing → existing messaging product. A code typed in WhatsApp chat is not a verify path.

Same-number rules:

1. Login = AUTHENTICATION templates only. Member messaging stays utility / session / marketing.
2. Pair rate ~1 outbound / 6s to the same user. Queue login ahead of a blast to that `wa_id`.
3. Throughput is shared (80 mps default; 20 mps if Business-app coexistence). Do not add a second number.
4. **1 Oct 2026:** utility inside the 24h window becomes billed. Authentication was already billed. Do not stuff the login code into an in-window utility reply.

---

## Blocked on Central / Assam — handoff

NiaSave cannot make a real member sign-in work until Central production has:

1. Allowlist + handlers: `identity.verify.request`, `identity.verify.confirm`, `member.identity` (`member.profile` alias).
2. Assam phone → enrolled KYC member map (unknown phones indistinguishable from known on `request`).
3. Cloud API send of an **approved AUTHENTICATION** template on the existing Nia number; webhook split from member messaging.
4. Session token whose `account.id` is that member id.

Until then: live non-TEST phones stay `otp_unavailable`. TEST `+917000000001` stays the labelled bypass. Do not fake Graph.

Number-change / recovery: **Ajay Mahawar**. Not in this spec.
