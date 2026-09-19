# Meta AUTHENTICATION template — paste and submit today

Owner: Ajay’s WhatsApp / WABA team. Same Nia Cloud API number (not a BSP, not a new number). Approval clock starts only after Submit.

Do **not** use Utility or Marketing. Meta will reject a login OTP in those categories.

## WhatsApp Manager path

1. Open [WhatsApp Manager → Message templates](https://business.facebook.com/wa/manage/message-templates/).
2. Select the **existing Nia WABA** (the member-messaging number).
3. **Create template**.
4. Category: **Authentication**.
5. Fill the block below. Submit. Status must become **Approved** (Pending is not enough).

Submit **English first**, then duplicate for Hindi. Two templates, same name, two languages.

## Ready-to-paste — English (`en`)

| Field | Value |
|---|---|
| Name | `nia_member_login` |
| Language | English (`en`) |
| Category | **AUTHENTICATION** |
| Code delivery | **Copy code** |
| Add security recommendation | Yes |
| Code expiration | **10 minutes** |
| Button text | Copy code |

Meta fills the body. It will look like:

```
{{1}} is your verification code. For your security, do not share this code.
This code expires in 10 minutes.
[Copy code]
```

Do not edit the body. Do not add a URL button. Do not put the NiaSave domain in the template.

## Ready-to-paste — Hindi (`hi`)

Same as English except Language = Hindi (`hi`). Name stays `nia_member_login`. Meta supplies the Hindi AUTHENTICATION body.

## Graph create (if Manager is blocked)

`POST https://graph.facebook.com/v21.0/{WHATSAPP_WABA_ID}/message_templates`

```json
{
  "name": "nia_member_login",
  "language": "en",
  "category": "AUTHENTICATION",
  "message_send_ttl_seconds": 600,
  "components": [
    { "type": "BODY", "add_security_recommendation": true },
    { "type": "FOOTER", "code_expiration_minutes": 10 },
    {
      "type": "BUTTONS",
      "buttons": [{ "type": "OTP", "otp_type": "COPY_CODE", "text": "Copy Code" }]
    }
  ]
}
```

Repeat with `"language": "hi"`.

Keys stay on **Central** Vercel only: `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WABA_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`. NiaSave does not get them.

When sending (Central, after approval):

```json
{
  "messaging_product": "whatsapp",
  "to": "91XXXXXXXXXX",
  "type": "template",
  "template": {
    "name": "nia_member_login",
    "language": { "code": "en" },
    "components": [
      { "type": "body", "parameters": [{ "type": "text", "text": "<CODE>" }] },
      { "type": "button", "sub_type": "url", "index": "0", "parameters": [{ "type": "text", "text": "<CODE>" }] }
    ]
  }
}
```

Webhook: AUTHENTICATION `statuses` → login. Member chat/utility stay on the existing messaging product. Do not collide.

Reply in the Central channel when Meta status is **Approved** (name `nia_member_login`, languages `en`+`hi`).
