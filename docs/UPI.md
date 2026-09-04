# UPI integration contract

UPI is currently skipped. The provider and exact collection model have not been selected. This document defines the provider-neutral control boundary the implementation must preserve.

## Decide before coding

- When the member pays: at order, at pickup or after collection
- Experience: intent, dynamic QR, collect request or mandate
- Contracting Nia entity and settlement bank account
- Provider, pricing, refund process and support escalation
- Who owns payment exceptions and daily reconciliation

## Recommended server contract

```text
POST /api/payments/upi/orders
GET  /api/payments/:paymentId
POST /api/payments/upi/webhook
POST /api/payments/:paymentId/refunds
```

The authenticated member submits only the bag reference and selected payment method. The server must reload the member, products, quantities, prices and payable amount from governed records before creating a provider order.

## Payment states

Use explicit, monotonic states:

```text
created -> pending -> succeeded
                   -> failed
                   -> expired
succeeded -> refund_pending -> refunded
                            -> refund_failed
```

Do not create an order from a browser redirect or success screen. A verified provider webhook or provider status lookup is the source of truth.

## Webhook rules

1. Read the raw request body before JSON parsing when required by the provider signature scheme.
2. Verify signature, timestamp and replay window.
3. Store the provider event ID and reject duplicates idempotently.
4. Match provider order, payment, amount and currency to the server-created record.
5. Update payment and order state in one durable transaction where the data model supports it.
6. Return quickly and move non-critical work to a retryable queue.
7. Preserve the complete event and transition audit trail with sensitive fields redacted.

## Reconciliation

Daily reconciliation must compare:

- Nia payment records
- Provider payment and refund records
- Provider settlement files
- Bank credits
- Sikh collection and order records

Every mismatch needs an owner, reason, ageing, evidence and resolution state. A payment is not fully closed until settlement is matched.

## Failure tests

- Member closes the app after approving payment.
- Webhook arrives before the browser response.
- Webhook is duplicated or arrives out of order.
- Provider reports success but the amount or order does not match.
- Payment stays pending beyond expiry.
- Order creation fails after payment succeeds.
- Refund is requested twice.
- Settlement is short, delayed or absent.
- Provider API or webhook endpoint is unavailable.

## Definition of done

- No client-supplied amount can change the charge.
- Duplicate requests cannot create duplicate charges or orders.
- Every success, failure and refund survives process restart.
- One payment can be traced from member to provider, order, collection, settlement and bank credit.
- Finance can reconcile the pilot day without editing the database.
- Provider secrets exist only in scoped Vercel environment variables.
