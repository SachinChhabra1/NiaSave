# Save inventory and pickup orders

Open `/save-inventory.html` from **Inventory and orders** on the existing Save desk. The page uses the existing verified staff session. Administrators and staff explicitly listed in the server-only `NIASAVE_SAVE_OPERATOR_EMAILS` setting may enter this workflow; that setting grants no other desk or global role. Central's signed staff scope remains authoritative for assigned sites and API permissions.

Inventory and orders in this workflow are saved in NiaSave. An Essentials spreadsheet is not an inventory source unless separately mapped and approved.

## Inventory CSV

Download the blank header template from the page. No example product or quantity is seeded. All columns are required; order may vary, but duplicate, extra or missing column names are rejected. Upload at most 100 data rows / 200 KB. Quoted commas, newlines and escaped quotes are supported.

| Column | Value |
| --- | --- |
| siteCode | An assigned site shown on the page |
| sku | Stable stock identifier |
| productId | Product identifier |
| name | Recorded product name |
| pack | Recorded pack description |
| pricePaise | Non-negative whole paise, not rupees |
| onHand | Physical whole stock count, including reserved units; zero is explicit, blank is invalid |
| countedAt | ISO timestamp of the stock count |
| priceVerifiedAt | ISO timestamp of price verification |
| active | Exactly `true` or `false` |
| expectedRevision | Current saved revision; `0` only for a new record |

Preview sends typed rows to `/api/commerce/staff/save/inventory-preview` without publishing. Review all returned rows, then publish with the server's preview hash and a stable idempotency key. Editing the upload invalidates the preview. A failed or interrupted publish retains the same key for retry. Server-side scope, stock holds, revisions and validation remain authoritative.

## Pickup completion

Orders load from `/api/commerce/staff/save/snapshot`. Use the member-provided pickup code; staff must not infer or prefill it. Enter the amount actually received in INR, payment evidence, and handover evidence, then confirm both payment and handover. The exact rupee amount is converted to whole paise without rounding and must match the order total.

`/api/commerce/staff/save/complete` receives the order revision and idempotency key. Repeating an unchanged interrupted action reuses that key. Recording payment received at pickup does not claim bank settlement verification. Refresh errors clear stale records, and missing write capabilities leave controls closed.

The UI tests use synthetic intercepted API responses only. They do not upload real inventory, place real orders, receive payment or complete a physical handover.
