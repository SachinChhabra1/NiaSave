# NiaSave — Frontend PRD (P0)

Use this to start the member phone. Full spec: `NiaSave-PRD.docx`. Backend lives in `/api`.

**Lands on Save.** Footer: Work · Nest · Save · Home. Mobile web. No app store. Demo phone `9876541042` (Ravi K, NIA-1042).

## Why

He leaves when leftover fails.

`16,500 − 2,200 − 812 − 2,800 − 700 = 9,988`

Save owns three leaks only: kirana price, credit, trip after the shift. Work owns pay. Nest owns the bed. Home owns send.

## Chrome

Navy `#1C3F5C`. Paper white. Pack plate `#E6E6E8`. No emoji. One primary action. Hindi on SKUs, English on tabs. Bag icon opens the same bag from every tab.

## P0 screens

**Save** — Rajputana Theatre · 5:15 PM. Delivered to your Studio. Piggy keep this week. Fever line: Bag ₹500 this month → fever day free. Search: Salt, oil, Maggi. Two-column cards. Checkout: bag → 10-digit phone → name + Studio → UPI → hub has your bag. Wrong phone: *This phone is not with Nia.*

**Work** — Warehouse picker. This week ₹4,200. Friday ₹4,200 · no cut. Today 8:00–5:00 · Whitefield. Bus 7:10 · 600 m. Ramesh · Help. Extra: Tonight 6–8 PM · Studio · keep ₹180 · To ₹5,000 · Take / No. Next: 3 days → picker+ · +₹1,500/mo. No 3-month chart on P0.

**Nest** — Your Nest ₹2,200. Bed 12 · 12 min. Included with words. Bada Khaana Sunday 7 PM. I’m coming. Laundry back 6 PM. Trim ₹80. Something wrong → Satish is on it · by 9 PM.

**Home** — Maa · Bhojpur. ₹9,988 can reach Maa. No fee. Send home. Roof ₹20,000. Recharge ₹199. Voice only if a file exists. Ledger 12 Aug · ₹2,500. Family safety last and collapsed.

## Save adapters

```js
validatePhone(phone)            // member | null
requestPayment({ amount, cart, member })
onCheckoutComplete({ member, cart, total })
onOpenSavings()                 // → Home
```

Product: `id name hindi size price mrp image` + optional `searchTerms outOfStock`.
Views: `shop | detail | bag`. Scope CSS under `.nia-save`.

## Do not draw

Job feed, gig, location picker, pickup, address, COD, credit, login-before-browse, green Save hero, insurance on Home, staff desks, months chart, NiaBooks.

## Backend for FE

`GET /health`
`POST /v1/members/lookup` `{ phone }`
`GET /v1/work/current`
`POST /v1/work/extras/extra-tonight/decision` `{ decision: "take"|"no" }` + `Idempotency-Key`
`GET /v1/nest/current`
`GET /v1/catalog`
`POST /v1/payments` `{ amount, cart, memberId }`
`POST /v1/orders` `{ paymentId }`
`GET /v1/home/leftover`

Send-home rail is not configured (`POST /v1/home/transfers` → 501). Nest rupee is interim ₹2,200.
