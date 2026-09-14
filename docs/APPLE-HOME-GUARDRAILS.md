# Apple home — do not go wrong

Time is short. Edit `lib/commerce/apple-home.snippet.js` only. Build splice writes that function into `commerce.js`. Do not freestyle the homepage.

Slice: after language, Live full-bleed → Save full-bleed → Earn/Send two-up.

## Hard no

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

- Language card until `nia-language` is sticky (`pickingLang=!languageSticky()&&!owner.active`)
- Guest browse + Add; phone only after Continue
- Bag is a sheet/drawer, CTA is Continue
- Existing copy: “A bed near work.” / “See Nest” / “Keep more.” / “Extra shifts” / “Money home.”
- Assets: `studio-bunk-lockers.jpg` on Live, `oils-editorial-sheet.png` on Save
- Desktop overlay only inside `@media (min-width: 761px)`

## Proof

`npm run test:commerce`

Must include:

`node --test lib/commerce/apple-home-guardrails.test.mjs lib/commerce/mesha-home.test.mjs lib/commerce/mesha-save-bag.test.mjs`
