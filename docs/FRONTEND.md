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

`desk.html` is the 2 Para product entry point. It opens Sikh Unit at `/ops.html` for Save operations, Jat Unit at `/bison.html` for Living operations, Dogra Unit at `/tanot/` for enterprise demand, and Assam Unit at `https://para-2-madras.vercel.app` for member acquisition.

Dogra Unit is a production-built React surface under the technical `tanot/` path. Its current campaign, opportunity, Studio and BD-executive records are explicitly illustrative and persist only in the browser until governed source integrations are added.

## Production source boundary

The files under the root `src/` contain an earlier React/Vite member prototype. They are not the current production phone because the custom Vercel build copies `member.html` directly. Dogra Unit's React source under the technical `tanot/src/` path is canonical and is compiled by `vercel-build.sh` into `dist/tanot/`.

## Product rules

- Phone-first and usable at narrow widths.
- One typeface and one card system across journeys.
- Titles should do the work in three direct words where possible.
- Product images carry meaning; avoid decorative or generic human imagery.
- Show rupees saved, MRP and the member price clearly.
- Never imply that seeded prices, earnings or savings are verified live data.
- Keep regulated or financial actions explicit about what Nia does and does not provide.

See [HANDOVER.md](HANDOVER.md) for the production integration and release gates.
