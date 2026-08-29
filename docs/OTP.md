# Member OTP

Phone must be on the Nia record before any code is created or sent.
Unknown numbers get `404 this_phone_is_not_with_nia`. No SMS. No OTP row.

```
POST /v1/auth/otp/request  { phone }
POST /v1/auth/otp/verify   { phone, code } → { token, member }
GET  /v1/auth/me           Authorization: Bearer <token>
```

Demo member `9876541042`. Demo code `1042` (DEMO=1 only).
Line if unknown: This phone is not with Nia.
