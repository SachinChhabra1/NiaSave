# NiaSave

P0 mobile web experience for Nia members. The app lands on Save and includes Work, Nest, Save, and Home with a shared bag and demo checkout.

## Local development

```bash
npm install
npm run dev:api
npm run dev
```

The frontend runs at `http://127.0.0.1:5173` and proxies `/health` and `/v1` to the in-memory API at `http://127.0.0.1:8787`.

Demo member: `9876541042` · Ravi K · `NIA-1042`.

## Production

Vercel builds the Vite frontend from the repository root. `vercel.json` rewrites the public backend contract to the serverless handler under `/api`.

The send-home rail is intentionally not configured in P0 and returns `501`.
