# PR X1 — Home

PRD v1.1 §6.1 + founder lock: desktop is maintained.

- Phone: Nest photo stacked above a solid copy band. Headline and CTAs never sit on the photo.
- Desktop ≥761: 48px blur nav. Copy is a reserved #0B0B0C band above the photo. Photo `object-position: 12% 14%` so the top bunk and pillow are the product, not the ladder.
- Commerce `.mesha-desire img{position:absolute}` and the desire `:after` gradient are disabled on `.nia-home-hero`.
- Three photo-fill promise cards: Extra shifts / Shop less / Money home. Existing assets only.
- Language splash stays. No connector edits.

Proof: `node --test lib/commerce/apple-home-guardrails.test.mjs lib/commerce/mesha-home.test.mjs`
