# NiaSave production frontend

## Member phone

The current protected showcase uses `commerce.html` at `/`, published by the domain assembler. `member.html` is the earlier member surface. See [hosted-showcase.md](hosted-showcase.md) for the current release process and [para2-naming.md](para2-naming.md) for Unit ownership.

The member journeys are:

- **Live**: Studio and everyday services
- **Earn**: Extra work, gig shifts, referrals and salary history
- **Save**: Essentials catalogue, bag, pickup/delivery and insurance information
- **Send**: NiaBooks and monthly planning; bank transfers await integration

The interface is available in English, Hindi, Tamil, Kannada and Marathi. 

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
