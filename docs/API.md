# NiaSave API

Production base: `https://www.niasave.com`

Vercel rewrites `/api/*`, `/v1/*` and `/health` to the serverless handler in `api/index.mjs`.

## Member routes used by the production phone

```text
GET  /api/member
POST /api/member
POST /api/member/answer
GET  /api/order
POST /api/order
GET  /api/stock
POST /api/auth/otp
POST /api/auth/verify
GET  /api/auth/me
```

OTP and payment status are currently returned in skip mode. The member session defaults to the seeded Ravi record.

## Sikh Unit routes (technical Polo API)

```text
GET  /api/connectors
POST /api/connectors/upload
GET  /api/beat
POST /api/beat/open
POST /api/beat/close
GET  /api/orders
GET  /api/stock
GET  /api/ledger
POST /api/scan
GET  /api/cash
POST /api/cash
GET  /api/settlements
GET  /api/source
GET  /api/predict
GET  /api/next
GET  /api/tower
GET  /api/stops
POST /api/stops
GET  /api/po
POST /api/po
GET  /api/dispatch
POST /api/dispatch
GET  /api/invoice
POST /api/invoice
GET  /api/biker
POST /api/biker
```

These routes persist state in Postgres when `DATABASE_URL` is configured. Operational desk access is temporarily open while the dedicated 2 Para login screen is being built. Set `STAFF_AUTH_REQUIRED=1` to restore signed-token enforcement. Member-facing `/api/member`, `/api/order`, `/api/stock` and `/api/auth/*` retain their separate pilot contract.

## Jat Unit routes (technical Bison API)

```text
GET  /api/bison/tower
GET  /api/bison/hierarchy
GET  /api/bison/inventory
GET  /api/bison/bookings
POST /api/bison/bookings
POST /api/bison/checkin
POST /api/bison/checkout
GET  /api/bison/members
POST /api/bison/members
GET  /api/bison/contracts
POST /api/bison/contracts
POST /api/bison/contracts/amend
POST /api/bison/contracts/end
GET  /api/bison/clocks
POST /api/bison/clock
GET  /api/bison/collections
POST /api/bison/collections/charges
POST /api/bison/collections/payments
POST /api/bison/collections/work
GET  /api/bison/audit
POST /api/bison/audit
GET  /api/bison/audit-log
POST /api/bison/ingest
```

While 2 Para access is open, Jat Unit mutations use the server-owned actor `2 Para desk`; request bodies cannot spoof it. When `STAFF_AUTH_REQUIRED=1`, routes require a bearer token with studio, money or administrator access and derive the actor from that identity. Historic cluster collection balances remain unallocated until staff ties a supported amount to a member contract.

## Legacy P0 routes

The handler also contains earlier `/v1/*` member and staff contracts. They are not the primary routes used by the current `member.html` and Sikh Unit pages. Do not build a new integration against them without first deciding whether to consolidate or remove them.

## Error and mutation requirements for new integrations

- Validate all request bodies server-side.
- Require authenticated member or staff identity.
- Use idempotency keys for money, order and fulfilment mutations.
- Verify provider webhook signatures before updating state.
- Store an immutable audit event for every state transition.
- Do not log OTPs, tokens, full phone numbers, bank identifiers or payment payload secrets.
- Return stable machine-readable error codes and safe user-facing messages.
