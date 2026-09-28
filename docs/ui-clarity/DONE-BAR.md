# DONE-BAR: NiaSave picture cards and trust fixes

The only definition of done. Copy to `docs/ui-clarity/DONE-BAR.md` in the first PR. Status: open, passed (with production evidence), or parked (with owner).

## Gate 1: screens (PRD section 8)

| # | Check | Status | Production evidence |
|---|---|---|---|
| A1 | Shop grid photos fill the card, square, nothing cut | **passed** | 390px: photo 173 of a 175 card, square, 1px border only. 1280px: 198 of 200. Aisle photo full card width after fix round 2. |
| A2 | Earn steps: full-width photo cards, right pictures, left aligned | **passed** | Three cards, photo 356 of a 358 card at 390px, 16/10. Title, subtitle, heading and all three cards share left edge 16 (390) / 436 (1280), en and hi. Step 3 shows the gate signpost, not a person walking; real photo parked with Founders. |
| A3 | Fresh Home: Send tile shows "Add your family photo" box, no stock family photo | open | |
| A4 | Send tile opens Send, "Your family" card first | open | |
| A5 | Tall group photo fills, heads in view, on Send and Home | open | |
| A6 | Photo survives reload and language switch | open | |
| A7 | Change and Remove (with Cancel) work on both screens | open | |
| A8 | PDF, 25 MB file, private window: error line, rest of Send works | open | |
| A9 | Zero new requests while adding, changing, removing photo | open | |
| A10 | Notebook photo gone, four money rows unchanged | open | |
| A11 | Signed out: no "Details did not load."; network off: it shows | **passed locally** | Shop at 390 and 1280, en and hi: a 200 and a 403 both say "Log in to see what is here". Home stays quiet on a 403. A failed catalogue read (network abort, 500, 503) says "Details did not load." Production check waits until this branch is merged. |
| A12 | Bag line reworded; true reason and Call Nia above disabled Continue | **passed locally** | Both review lines are "The Nia team will confirm the final price before you pay." With reservations paused, that reason and Call Nia sit above a disabled Continue, en and hi, 390 and 1280. Each other cause has its own test. |
| A13 | Live, Home tiles (words), Earn signed in, NiaBooks unchanged | **passed locally** | Home, Live, Earn signed in, and Send (NiaBooks) text is the same before and after, en and hi, 390 and 1280. |
| A14 | All section 6 guards green in CI on each PR | **passed for PC-1** | verify + hold green on e9e123a. 417 unit, 44 browser, calls-frozen, member-copy-guard, data-lines, translation-lock, home-splice-contract all pass. Baseline 0 rows. |
| A15 | "This photo stays on this phone. Nia never sees it." shows under the photo in every state (empty, with photo, after Change), in all six languages | open | |

## Gate 2: data proven on production (PRD section 8b)

| # | Check | Status | Production evidence |
|---|---|---|---|
| D1 | Four addresses: same status and top-level fields as before | **passed for PC-1** | Four addresses unchanged in status and top-level fields against the snapshot taken before PC-1. |
| D2 | Same requests on every journey as main at 1957736 | **passed for PC-1** | Same two calls on every journey, en and hi: GET /api/commerce/catalogue, GET /api/commerce/nests. Zero page errors. |
| D3 | Prices, Nest names, plan amount still show in the new cards | **passed for PC-1** | Six Shop category cards, six with a photo, six with a word, in both languages. |
| D4 | Real failures still show "Details did not load." | **passed locally for PC-3** | Network abort, a 500, and a 503 still say "Details did not load." A 403 while a member session is already open is not treated as sign-in. A signed-out 401 or 403 is sign-in. Production check waits until this branch is merged. |
| D5 | Photo never leaves the phone, checked on production | open | |
| D6 | Bag and queued taps survive the deploy | **passed for PC-1** | Bag storage readable after the deploy in both languages. |

## Parked

| Item | Owner | Note |
|---|---|---|
| Call Nia phone number | Founders | Button opens Help until the number is given. One-line PR plus one data-guard exception when it comes. Not part of this build's done. |
| Real photo of a Member walking to a factory gate (Earn step 3) | Founders | Asset ask, does not block. |
