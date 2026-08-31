# NiaSave production frontend

## Member phone

The production phone is `member.html`. `vercel-build.sh` publishes it as `/index.html`.

The member journeys are:

- **Live**: Studio and everyday services
- **Earn**: Extra work, gig shifts, referrals and salary history
- **Save**: Essentials catalogue, bag and pickup flow
- **Send**: Monthly planning and insurance information; no money movement

The interface is available in English, Hindi, Bangla, Tamil and Kannada. Nia voice support is embedded using the ElevenLabs conversational widget.

## Staff surface

`ops.html` is the Operation Polo entry point. The linked staff pages cover pickup, reconciliation, prediction, hub, next beat, cash, source, inventory, ageing, purchase orders, dispatch, invoices and biker runs.

## Production source boundary

The files under `src/` contain an earlier React/Vite prototype. They are not the current production phone because the custom Vercel build copies `member.html` directly. A future frontend rewrite must first choose one canonical implementation and remove the unused surface to prevent divergent fixes.

## Product rules

- Phone-first and usable at narrow widths.
- One typeface and one card system across journeys.
- Titles should do the work in three direct words where possible.
- Product images carry meaning; avoid decorative or generic human imagery.
- Show rupees saved, MRP and the member price clearly.
- Never imply that seeded prices, earnings or savings are verified live data.
- Keep regulated or financial actions explicit about what Nia does and does not provide.

See [HANDOVER.md](HANDOVER.md) for the production integration and release gates.
