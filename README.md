# NiaSave

NiaSave is a phone-first member application with three connected products in 2 Para: Polo for Save operations, Bison for Living operations, and Tanot for enterprise demand.

## What is live

- Member journeys: **Live, Earn, Save and Send**
- Five interface languages: English, Hindi, Bangla, Tamil and Kannada
- Embedded Nia voice assistant through ElevenLabs
- Save catalogue, bag, pickup-code and order-reservation flow
- Operation Polo for orders, stock, packing, dispatch, collection, invoicing and reconciliation
- Bison for the theatre → studio → nest book, member contracts, clocks and collections
- Tanot for enterprise campaigns, qualified demand, contracts, Studio allocation, mobilisation and live activation
- Shared, durable runtime state in Neon Postgres
- One Vercel origin for the phone, Operation Polo and APIs

Production:

- Member app: <https://www.niasave.com/>
- Operation Polo: <https://www.niasave.com/ops.html>
- 2 Para: <https://www.niasave.com/2para.html>
- Bison: <https://www.niasave.com/bison.html>
- Tanot: <https://www.niasave.com/tanot/>
- Health: <https://www.niasave.com/health>

## Current release boundary

The system is a controlled pilot. OTP and payments are deliberately skipped. Send is planning only and does not move money. Seeded member, price and operating data must not be reported as live commercial activity.

Before loading real member data or money, complete the control gates in [docs/HANDOVER.md](docs/HANDOVER.md), especially staff access control, audit logging, provider webhooks, privacy controls and recovery testing.

## Repository and deployment

- GitHub: `SachinChhabra1/NiaSave`
- Production branch: `main`
- Vercel project: `niasave`
- Vercel project ID: `prj_tTLIuOGLv8YcEE2CP1NHNsZFDFq6`
- Vercel automatically builds and deploys merges to `main`
- GitHub Actions runs tests and a production build on pull requests and pushes to `main`

The production build is controlled by `vercel.json` and `vercel-build.sh`. The build copies `member.html` to `dist/index.html`, publishes the static Polo and Bison surfaces, and compiles the Tanot React application to `dist/tanot/`. The React files under the root `src/` are not the current production phone surface.

## Local development

```bash
npm ci
npm run dev:api
```

In another terminal:

```bash
npm run dev
```

Run the release checks:

```bash
npm test
npm run test:bison
npm run test:storage
npm run build:production
```

`test:storage` runs the full persistence integration only when `DATABASE_URL` is present. `build:production` runs the same artifact builder used by Vercel. Copy `.env.example` to a local untracked file and supply development-only values when needed.

## Team handover

Start with [docs/HANDOVER.md](docs/HANDOVER.md). It records the architecture, release process, environment contract, production blockers, ownership questions and definitions of done. Provider teams should also use the detailed [OTP](docs/OTP.md) and [UPI](docs/UPI.md) integration contracts.
