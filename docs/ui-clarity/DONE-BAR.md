# DONE-BAR: NiaSave picture cards and trust fixes

The only definition of done. Copy to `docs/ui-clarity/DONE-BAR.md` in the first PR. Status: open, passed (with production evidence), or parked (with owner).

## Gate 1: screens (PRD section 8)

| # | Check | Status | Production evidence |
|---|---|---|---|
| A1 | Shop grid photos fill the card, square, nothing cut | open | |
| A2 | Earn steps: full-width photo cards, right pictures, left aligned | open | |
| A3 | Fresh Home: Send tile shows "Add your family photo" box, no stock family photo | open | |
| A4 | Send tile opens Send, "Your family" card first | open | |
| A5 | Tall group photo fills, heads in view, on Send and Home | open | |
| A6 | Photo survives reload and language switch | open | |
| A7 | Change and Remove (with Cancel) work on both screens | open | |
| A8 | PDF, 25 MB file, private window: error line, rest of Send works | open | |
| A9 | Zero new requests while adding, changing, removing photo | open | |
| A10 | Notebook photo gone, four money rows unchanged | open | |
| A11 | Signed out: no "Details did not load."; network off: it shows | open | |
| A12 | Bag line reworded; true reason and Call Nia above disabled Continue | open | |
| A13 | Live, Home tiles (words), Earn signed in, NiaBooks unchanged | open | |
| A14 | All section 6 guards green in CI on each PR | open | |

## Gate 2: data proven on production (PRD section 8b)

| # | Check | Status | Production evidence |
|---|---|---|---|
| D1 | Four addresses: same status and top-level fields as before | open | |
| D2 | Same requests on every journey as main at 1957736 | open | |
| D3 | Prices, Nest names, plan amount still show in the new cards | open | |
| D4 | Real failures still show "Details did not load." | open | |
| D5 | Photo never leaves the phone, checked on production | open | |
| D6 | Bag and queued taps survive the deploy | open | |

## Parked

| Item | Owner | Note |
|---|---|---|
| Call Nia phone number | Founders | Button opens Help until the number is given. One-line PR plus one data-guard exception when it comes. Not part of this build's done. |
| Real photo of a Member walking to a factory gate (Earn step 3) | Founders | Asset ask, does not block. |
