# Phase 1 storefront overlay — LESS restored

Branch: `grok/ui-truth-recovery`
PR: #76 (draft — do not merge)

## Founder lock

Primary visible bottom navigation is exactly **Live / Earn / Save / Send**.
Hashes stay `#live` `#earn` `#shop` `#send`.

Do not replace primary labels with Stay / Jobs / Shop / My money.

| Brand | Secondary meaning | Hash |
|---|---|---|
| Live | A place to stay / accommodation | `#live` |
| Earn | Jobs nearby | `#earn` |
| Save | Everyday essentials | `#shop` |
| Send | Money home — planning only | `#send` |

Non-English UI keeps the English LESS word visible and adds a translated descriptor (`lessName`).

## Send safety

- Destination H1 is **Send**.
- First status: **Transfers not active**.
- Screen is a statement + plan only. Saving a plan does not move money.
- No enabled transfer CTA.

## Truth gates also in this overlay

- F01 Live recovery never dumps bag copy.
- F02 Earn 401 never says “Your bag is still here.”
- F03 pending pack listed, not reservable; checkout refused.
- F13 collect-from-point; preview S01 is not advertised as delivery.
- Server `cleanLines` fails closed on `pack_unconfirmed`.
