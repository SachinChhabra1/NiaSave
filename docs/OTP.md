# OTP integration contract

OTP is currently skipped. The existing public routes preserve the interface needed by the phone:

```text
POST /api/auth/otp       { phone }
POST /api/auth/verify    { phone, code }
GET  /api/auth/me
```

## Required production behaviour

1. Normalise and validate the Indian mobile number.
2. Confirm that the phone belongs to an eligible Nia member before sending a code.
3. Rate-limit by phone, IP and device. Apply resend and failed-attempt limits.
4. Generate the OTP server-side, store only a salted hash, set a short expiry and make it single-use.
5. Send through the selected provider and record the provider message ID and delivery result.
6. On verification, create a signed, `HttpOnly`, `Secure`, `SameSite=Lax` session cookie.
7. Bind all member reads and writes to the verified member ID from the session. Never accept a client-supplied member ID as authority.
8. Record request, delivery, verification, expiry, lockout and logout audit events without logging the OTP.
9. Return the same safe response for unknown and ineligible numbers where enumeration risk applies.

## Definition of done

- OTP cannot be bypassed in production.
- A member can access only their own data.
- Unknown, expired, reused and over-attempt codes fail safely.
- Provider outage, delayed delivery and duplicate callbacks are handled.
- Session rotation, expiry and logout are tested.
- Logs and dashboards show success rate, latency, provider errors and lockouts without exposing codes or phone numbers.
