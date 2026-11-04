# Investor demo (TEST data only)

This is a separate investor presentation built on the isolated showcase entry.
It uses the existing commerce quote, reservation, payment-record and collection
functions with a local fictional fixture. It never reads Central or calls an OTP,
WhatsApp or payment provider. All 20 products, INR prices, two pickup Nests,
stock and the shared `preview-member` are fictional and labelled DEMO.

Activation requires **both** `NIA_SHOWCASE=1` and `NIASAVE_INVESTOR_DEMO=1` in
the separately assembled showcase entry. Default is off. The normal storefront,
production CSP / X-Frame-Options, member cookies and staff auth are unchanged.
The standard root build does not enable this mode. Do not use the domain assembler
or the existing www.niasave.com deployment for this demo.

## Three-minute walkthrough

1. **0:00–0:45 · Shop.** Open the password-gated `/investors` website. Enter the
   privately shared investor password. The phone frame signs in the fictional
   member automatically, without phone details. Browse the DEMO essentials and
   add rice (or another product) to the bag. Prices are illustrative INR amounts.
2. **0:45–1:30 · Reserve.** Open Bag, choose a fictional Nest and press Reserve
   bag. Show the confirmation and collection code. Emphasise that nothing was
   charged and no real collection was arranged. Note the code before switching.
3. **1:30–2:15 · Operations.** Open “Open demo operations” inside the frame, or
   `/ops.html?view=commerce` on the demo origin. The reservation is in the same
   shared book. Enter a **fictional 12-digit** UPI reference and the exact displayed
   INR amount, then Record pretend payment. Never use a real bank reference.
4. **2:15–3:00 · Collect.** Enter the collection code from confirmation and press
   Mark collected. Show “Collected”, then reload: the test record persists.
   This is an offline pretend receipt; no gateway or money transfer is involved.

All invited visitors share one fictional member and demo operator. Demo ops is
intentionally available to demo visitors; it cannot access ordinary operations.
A fresh instance has 100 units per product. Repeated bootstrap preserves stock,
reservations and receipts; it does not reset edits. The fixture pickup windows
last one year from initial seed. Reservations expire after two hours for pickup;
this is a synthetic presentation, not evidence of live fulfilment readiness.

## Prepare a separate Preview deployment

Do this only in the **niasave-showcase** Vercel project using its dedicated
**niasave-showcase-db** Neon test database. Do not deploy to main/production,
change DNS, edit production settings, or reuse DATABASE_URL / Central live data.
These instructions are a handoff; this PR does not set env vars or deploy.

1. Have the project owner configure the Preview environment variables named
   below. Keep values in the secret manager / Vercel UI, never in commands,
   source, screenshots or documentation. Select a fresh instance identifier
   matching `showcase-[a-z0-9-]{8,64}` so existing showcase records remain separate.
2. Assemble the standalone artifact from the reviewed demo branch:

   ```sh
   NIA_SHOWCASE=1 NIASAVE_INVESTOR_DEMO=1 node scripts/build-showcase.mjs ../niasave-investor-artifact
   cd ../niasave-investor-artifact
   npx vercel link --project niasave-showcase
   npx vercel deploy
   ```

   Verify the CLI is linked to `niasave-showcase` before deploying. Omit `--prod`.
   Build flags select the demo documents and demo-only framing CSP; runtime flags
   are also required. The shared root vercel.json is never relaxed. The artifact
   has no X-Frame-Options and permits only self, nia.one, www.nia.one and Vercel
   preview parents. The runtime fails closed if showcase storage is unconfigured.
3. Verify the Preview URL contains only fictional DEMO records and that the frame
   works from the website Preview. Existing Vercel deployment protection can block
   cross-site visitors; the project owner must provide an appropriate investor
   Preview URL. Do not put bypass tokens, Basic credentials or secrets in URLs.
4. In the website project's **Preview** environment, set INVESTOR_DEMO_URL to the
   verified HTTPS demo URL and configure the server-side password. Rebuild the
   website Preview on `demo/investors-page`. No deployment is part of this PR.

### Environment variable names (values intentionally omitted)

`niasave-showcase`, build and runtime activation:

- NIA_SHOWCASE
- NIASAVE_INVESTOR_DEMO

`niasave-showcase`, existing showcase readiness / test storage:

- SHOWCASE_INSTANCE
- SHOWCASE_DATABASE_URL
- SHOWCASE_PASSWORD
- SHOWCASE_CENTRAL_KEY

The last two remain required by the existing readiness contract. Investor mode
does not use Basic auth or expose the Central gateway. It rejects all API paths
outside its own commerce demo endpoints. No Central origin/key from a live system
is needed. VERCEL_ENV is supplied by Vercel; use Preview, not Production.

Website project (`nia-one-website-pages`; confirm its linked Vercel project name):

- INVESTOR_DEMO_URL
- INVESTORS_PASSWORD
- INVESTORS_COOKIE_SECRET (optional; password is the signing key if absent)

## Local evidence

```sh
npm ci
npx playwright install chromium
npm run test:commerce
npm run test:security
npm run test:investor-demo
```

Playwright starts a local HTTP server with a transactional, cloned in-memory store;
that test seam is never packaged in the hosted function. No database or Central
connection is made. Hosted writes require the existing PostgreSQL CAS runner and
use only `SHOWCASE_INSTANCE:investor-demo-v1` inside SHOWCASE_DATABASE_URL. Store
failures cannot acknowledge successful mutations. A separate fake-SQL test proves
the state prefix, conflict retries and failure rollback.

Screenshots default to `~/demo-shots/demo-01-shop.png` through
`demo-06-collected.png`, each 390×844. CI uploads them as an artifact. Set
DEMO_SHOTS_DIR to change only the test output directory. No test records real
passwords, bank information or payment details. Browser cookies use HttpOnly,
Secure, SameSite=None and Partitioned only in this demo. Other browsers may handle
third-party framing differently; verify the final Preview on the intended device.
