# PRD · Sikh Unit vendor settlement loop

Status: next NiaSave release slice. Controlled pilot. Seeded Hub kirana rows are design data, not live commerce.
Owner: Sikh Unit (Save). Member phone stays on List / Bag / Receive only.
Runtime: extend `rabbit/engine.mjs` Save snapshot. Do not add a second ledger.

## Problem

Save already buys, lists, packs, collects and invoices. Vendor payout is the missing close.

Today:

- Vendor is a string on a SKU / procure row.
- `/recon` is stock identity only (`opening − collected − leftover`).
- `/settlements` matches member collection to a UPI statement.
- `/invoice` `vendor_bill` bills a received PO, not a collected bag.
- `saveCash` records a method. It does not pay the vendor.

The loop Sachin named is the spine. This release closes it without inventing a marketplace.

## Decision record

| Question | Decision this release |
|---|---|
| Principal vs marketplace | Principal. Nia buys at `buy_inr` / `niaCost`, holds `keep_qty`, lists, collects, then pays the vendor. |
| Member collection | Unchanged: UPI-at-handover (physical merchant QR, amount + 12-digit bank ref, collection code). No member cash rail. |
| What "COD" means | Vendor `pay_terms`. Inbound sheet: `cash same day`. That is Nia → vendor, not member → Nia. |
| Partial bags | Forbidden. Packed/dispatched miss becomes `return_pending`. Exception, not a payout type. |
| Loop-back node | Payout + stock movement → next Upload / PO draft. Not Vendor Reg. |
| Dummy data | `dummy: true` until `DEMO=0` and `DUMMY_DATA=0`. Never report seeded prices as live activity. |

Out of this release: OTP, Apple Home, Live / Earn / Send, connector secrets, marketplace/dropship, live bank transfer, member COD cash collection.

## Naming

| Spoken | Object | Owner |
|---|---|---|
| Vendor Reg | `vendor` | Sikh + finance |
| Supplier Uploads | `upload` versioned catalog | Sikh procure |
| List | published Save catalogue | Sikh. Server price is source of truth. |
| Members Order | bag / reservation | Member phone |
| Schedule | beat / stop / window | Sikh hub |
| Deliver | packed → loaded → at stop → collected | Sikh + biker |
| COD Reconciliation | collection recon | Sikh + finance |
| Vendor Payment | payout | Finance. Amount = delivered × `buy_inr`. |

Vendor Reg is onboarding. It is not the return node.

## Two loops

1. Catalog — Upload → List → demand / `keep_qty` → next Upload
2. Settlement — Bag → Beat → Collect → Recon → Payout → unlocks next PO and list refresh

Two money legs, never netted silently:

- Member → Nia: listed price, collected at handover.
- Nia → Vendor: `buy_inr` × delivered qty, posted only on matched recon lines.
- Nia margin = listed − `buy_inr`. Stays in collection. Never paid out.

## States

### Vendor

`draft → active → blocked`

Required before `active`: name, payout rail or cash desk, `pay_terms`. GST/PAN stored when present. Incomplete KYC cannot upload.

### Upload

`draft → published | rejected`

SKU id is immutable. Price drift vs the published list freezes the SKU. It does not silently rewrite bookable stock.

### Bag (existing commerce lifecycle)

`reservation → packed → loaded → at_stop → collected`

Cancel only before pack. Unpacked expiry releases hold. Packed/dispatched expiry → `return_pending`. Returned stock is available only after inspection.

### Collection recon

Match on `order_id + sku + qty`:

- **A** listed price locked at bag
- **B** delivered qty (pack-out vs bag; must equal reserved)
- **C** amount collected (UPI ref vs locked amount)

| Result | Payout |
|---|---|
| A = B = C | Line eligible |
| Short collect (C < A×B) | Hold. Exception. |
| Partial (B < reserved) | Exception. No line payout. `return_pending`. |
| No-POD / missing bank ref | No collect. No payout. |
| Price drift | Freeze SKU. Do not pay on drifted price. |
| Return / refuse | Reverse collect. No payout on that line. |

### Payout

`held → eligible → posted`

Trigger: reconciled collected bags only, not reserved bags, not received POs.
Amount: delivered × `buy_inr` (`niaCost`).
Term on file: `cash same day`.
Unmatched lines stay held. Do not net against other vendors or other days.
`last_po` / `last_buy` update only after `posted`.

`vendor_bill` on a received PO is not payout. Payout requires `recon_id`.

## Member surface

Visible: List → Bag → window → Receive.
Hidden: Vendor Reg, Upload, Recon, Payout.
Bag is all-or-nothing at the window. Missed window is not a partial checkout.
NiaBooks records bag spend only after collected + recon-ready collection. Unpaid reservations do not post.

## Sikh desk

One view, `ops.html?view=vendors`:

1. Vendors (status, pay_terms, last_po, last_buy)
2. Upload / publish
3. Open recon exceptions
4. Eligible payouts
5. Posted payouts + loop-back into PO draft

Night close still requires stock identity: `opening − collected − leftover = 0`. Night close never plugs a cash gap and never posts a vendor payout.

## Identifiers

`vendor_id → po_id → sku → bag_id → order_id → collection_id → recon_id → settlement_id → payout_id`

A payout without `recon_id` is invalid.

## RafiQi watches

- short collect
- missing bank ref / no-POD
- `return_pending`
- price drift vs last published list
- stale list (`lead_days` missed or `keep_qty` breach)
- unlisted SKU ordered
- payout without `recon_id`
- `last_po` older than `pay_terms` window
- dummy rows labelled as live

## Acceptance

1. Active vendor can upload; draft vendor cannot.
2. Published list is the only member-visible catalogue for those SKUs.
3. Collected bag with verified UPI + matching amount produces a matched recon line.
4. Matched line becomes payout-eligible at `buy_inr × qty`, not listed price.
5. Short collect, no-POD, partial, and return never post payout.
6. Posted payout writes `last_po` / `last_buy` and unlocks the next PO draft.
7. Restart preserves vendor, upload version, recon, and payout ids.
8. Seeded Hub kirana is visible only when `dummy: true`.

## Implementation map

| New | Extends |
|---|---|
| `lib/commerce/vendor-loop.mjs` | Pure gate. No second database. |
| `lib/commerce/vendor-loop.test.mjs` | `npm run test:commerce` |
| Sikh vendors view | Existing `/source`, `/po`, `/recon`, `/settlements`, `/invoice` |
| Payout post | After matched recon. Do not reuse `vendor_bill` as paid. |

Follow [HANDOVER.md](HANDOVER.md) §4.B and §4.D: server-side amounts, immutable ids, daily recon vs bank/provider, named owners for vendors, catalogue, procurement, stock and bank.

Rollback: leave the module unused. Existing bag, scan, stock recon and member UPI collection stay as they are.
