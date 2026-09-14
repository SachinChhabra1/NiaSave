# Skill: NiaSave UI is Apple.com-like

For Grok, NiaBrain, and any agent editing NiaSave member surfaces.

Read this before writing markup, CSS, or copy. Fail closed.

## What Apple-like means here

Not an Apple clone. The first-paint *rules*:

1. One idea per screen.
2. The photograph is the product. Crop the subject, never a leftover edge.
3. Type lives in a reserved band. Type never sits on the subject.
4. Tiles are tall product modules, not letterbox banners.
5. Existing copy only. Do not invent headlines, counts, prices, or jobs.
6. Phone-first that widens on desktop. Desktop ≥761 is first-class (48px blur nav, full-bleed units). Do not put a postage-stamp phone cage on a laptop.
7. Language splash stays on first visit. Do not pre-seed `nia-language`.
8. Presentation only. No connector, env, signing, or migration edits in a UI PR.
9. Call for help on every member screen.
10. Sachin merges.

## Before you write

Check content in the snippet / PRD. If the line is not already on the page, do not add it.

### Home — locked copy

| Slot | Copy |
| --- | --- |
| Eyebrow | Nia |
| Hero | A bed near work. |
| Sub | Move in with Nia. Roof, rest, and a short walk to the shift. |
| Hero CTAs | See Nest · How it works |
| Earn | Extra shifts |
| Save | Shop less |
| Send | Money home. |

### Home — locked photos

| Slot | Asset | Crop |
| --- | --- | --- |
| Hero | `studio-bunk-lockers.jpg` | `object-position: 12% 14%` — top bunk + pillow. Never the ladder. |
| Earn | `earn-extra-hours-v2.jpg` | Time clock as the product. |
| Save | `oils-editorial-sheet.png` | Bottle in frame. |
| Send | `send-purpose-family.jpg` | Faces in frame. Never necks-only. |

Do not add Nest counts, vacancies, rupee amounts, UPI, wallet, OTP, or Series A on Home.

## Layout rules

### Hero

- Phone: photo stacked above a solid `#0B0B0C` copy band.
- Desktop: copy band **above** the photo (`order: -1`). Photo is its own unit.
- Kill `.mesha-desire img { position: absolute }` and the desire `:after` gradient on Home.

### Tiles

- Min height 340px on desktop. Aspect 4/3 photo on top.
- Name + two-word promise in a **solid** band under the photo (`#f5f5f7`, ink `#1d1d1f`).
- Photo is `position: relative`, not `absolute` over the type.
- 12px gutter between tiles. Equal height.
- Hard no: `max-width: 160px` thumbs, circular icons, 5:1 banners, white type on the still.

### Chrome

- Desktop nav: 48px, `rgba(22,22,23,.8)` + blur.
- Phone cage stays ≤760 only.
- Preview `/` may be `member.html` unless `COMMERCE_STOREFRONT=1`. Check `/commerce.html` before declaring a miss.

## Pass / fail in three seconds

Fail if any of these are true:

- You can name the leftover, not the product (ladder, locker door, necks).
- Type is on the photograph.
- Tiles are shorter than they are wide.
- A new sentence appeared that is not in the locked table.
- Desktop is a phone floating on wallpaper.

## Proof

```
node --test lib/commerce/apple-home-guardrails.test.mjs lib/commerce/mesha-home.test.mjs
```
