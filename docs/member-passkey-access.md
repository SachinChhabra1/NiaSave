# Member access and navigation fixes — 9 September 2026

Approved policy: passkeys on members’ own phones, with staff-verified enrolment and recovery. Shared phones require a separate approved flow.

## Changes

- Same-document links, Back/Forward, invalid fragments and rapid tab changes now update the displayed LESS page.
- `COMMERCE_MEMBER_AUTH=passkey` selects the Central-backed WebAuthn path. Hosted showcase access remains unchanged and never enables this path.
- The member uses their device screen lock. Staff-verified setup codes expire after ten minutes; browser ceremonies use HTTP-only cookies and expire after five minutes. NiaSave never returns Central session tokens in JSON.
- Every member API request checks the Central session. Revoked credentials, suspended members, legacy cookies, old SMS routes and client-supplied identity cannot bypass passkey mode.
- Central returns the stable history owner separately from the current sign-in subject. Orders and NiaBooks continue to use the former; member status, plans, applications and referrals use the latter.
- Unsigned passkey-mode visitors see the account screen and receive no catalogue products or locations. English, Hindi, Tamil, Kannada and Marathi carry setup, recovery and error instructions.

## Release boundary

This is an access implementation for review and isolated UAT, not activation of member commerce. No credentials, domain mappings, production flags, real member records or hosted showcase settings were changed.

Central’s companion branch adds migration 0014, staff invitation issuance and cryptographic verification. Its `docs/member-passkey-access.md` defines activation and rollback requirements. Keep member access disabled until that code is reviewed and deployed to an isolated access-UAT environment. The exact UAT origin is the WebAuthn RP; credentials must not be accidentally enrolled for a temporary hostname and then presented as production credentials.

## Open gates

1. Verify pilot member → fulfilment location/PIN records in Central’s new Member readiness form. The projection and enforcement are implemented: pickup-only grants cannot be used for delivery, and changed/expired/revoked mappings stop working on the next request.
2. Review actual older identities in Central’s history-link form. The software bridge now reads original orders, Nest bookings, dated entries and source expenses using only Central-approved identifiers; it preserves original records and retry keys. Another member’s records remain private. Names or phone matches never create links automatically.
3. Real-phone/PWA passkey setup, synced-key behaviour, cancellation, lost-phone replacement and recovery acceptance; native-speaker review of all five languages.
4. Sikh stock/price/location verification; current Jat residence/Nest data; partner credentials and acceptance; operator handover/receipt/exception UAT; monitoring and tested backup/restore.

## Validation

74 commerce tests and production build passed. Ten isolated browser WebAuthn checks covered registration, sign-in, replay, tampering, wrong origin, missing user verification, recovery and suspension. Navigation passed eight desktop/mobile checks. Passkey layouts passed ten language/viewport checks, plus Central’s staff form at two widths. These are engineering checks, not a claim of member acceptance or verified operational data.

The readiness update is covered by five additional ownership/serviceability tests in NiaSave and three additional Central database scenarios. The form, schema and bridge are ready for operational data preparation; records have not been falsely marked verified.
