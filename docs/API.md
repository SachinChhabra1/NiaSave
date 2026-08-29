# NiaSave API — Codex contract

Base (after deploy): https://niasave.vercel.app

Demo phone: `9876541042` · member `NIA-1042` · Nest ₹2,200 interim.

CORS open. Send `Idempotency-Key` on extra / payment / order / transfer.
Staff desks: header `x-staff-key: nia-desk`.

## Member

- GET `/health`
- GET `/v1/config`
- POST `/v1/members/lookup` `{ phone }`
- GET `/v1/work/current`
- GET `/v1/work/history`
- POST `/v1/work/payroll-messages` `{ raw }`
- POST `/v1/work/extras/extra-tonight/decision` `{ decision: "take"|"no" }`
- GET `/v1/nest/current`
- POST `/v1/nest/events/bada-khaana/rsvp` `{ coming: true }`
- POST `/v1/nest/issues` `{ kind }`
- GET `/v1/catalog`
- POST `/v1/payments` `{ amount, cart, memberId }`
- POST `/v1/payments/webhook` `{ paymentId, status }`
- POST `/v1/orders` `{ paymentId }`
- GET `/v1/home/leftover`
- GET `/v1/home/ledger`
- POST `/v1/home/transfers` `{ amount }` demo ledger only

## Staff

`x-staff-key: nia-desk`

GET/POST `/v1/staff/buy`
GET `/v1/staff/stock` PATCH `/v1/staff/stock/:sku`
GET `/v1/staff/price` PATCH `/v1/staff/price/:sku`
GET `/v1/staff/hub` POST `/v1/staff/hub/pack` POST `/v1/staff/hub/count`
GET `/v1/staff/cart` POST `/v1/staff/cart/leave`
GET `/v1/staff/studio` POST `/v1/staff/studio/handover`
GET `/v1/staff/money` POST `/v1/staff/money/close`
GET `/v1/staff/pilot`
