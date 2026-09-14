# Apple home — do not go wrong

Time is short. Edit `lib/commerce/apple-home.snippet.js` only. Build splice writes that function into `commerce.js`. Do not freestyle the homepage.

Slice: after language, **one Live desire hero**. Earn / Save / Send sit on a **secondary rail only**. Save aisle (Keep more.) is mock 03 — not a co-hero on home.

## Hard no

- Dual home heroes (`apple-unit` + `apple-save-unit`)
- Desktop `matchMedia('(max-width: 760px)')` skip of the language card
- Invented Nest counts, vacancy numbers, or open-role counts
- Payments, wallets, cards, or “pay online” on the homepage
- Mixing this surface with capital / fundraise copy
- Touching #51 Earn/Live vacancy wiring
- OTP / phone before Continue on Save bag
- Pre-seeding `nia-language` in HTML (language card stays first visit)
- Removing the ≤760px Mesha phone cage
- New photos that are not already in `/assets`
- Homepage actions other than `live`, `how-live`, `shop`, `earn`, `send`

## Must keep

- Language card until `nia-language` is sticky (`pickingLang=!languageSticky()&&!owner.active`) on **all** viewports — no store-first without language pick
- Card offers en / hi / bn / ta / kn and keeps “Phone only when you check out.”
- Guest browse + Add; phone only after Continue
- Bag is a sheet/drawer, CTA is Continue
- Existing copy: “A bed near work.” / “See Nest” / “Extra shifts” / “Shop less” / “Money home.”
- Assets: `studio-bunk-lockers.jpg` on Live; `oils-editorial-sheet.png` on the Save rail / Save aisle
- Desktop overlay only inside `@media (min-width: 761px)`

## Proof

`npm run test:commerce`

Must include:

`node --test lib/commerce/apple-home-guardrails.test.mjs lib/commerce/mesha-home.test.mjs lib/commerce/mesha-save-bag.test.mjs`
