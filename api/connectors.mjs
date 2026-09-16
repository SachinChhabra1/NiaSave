// Save connectors run on the shared router. rabbit/engine.mjs owns
// GET /api/connectors and POST /api/connectors/upload; api/server.mjs keeps
// both behind the staff gate. Vercel rewrites /api/* to api/index.mjs, so this
// file only keeps the legacy function path pointed at the real handler.
export { default } from "./server.mjs";
