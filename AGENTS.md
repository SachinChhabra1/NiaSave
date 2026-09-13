# NiaSave build guardrails

The user's current request governs. Specifications: `docs/niasave-prd-v2.md` and `docs/niasave-build-gates.md`.

- Codex never writes PASS in `docs/central-gate-ledger.md`. Append PENDING with exact missing evidence. Only Sachin or the reviewing browser session writes PASS, with captured success AND failure against production Central. Do not edit previous blocks.
- Only P0 proceeds before Central is finished. Never build a blocked screen against a mock, stub Central, or prepare its rules locally. Read the next PR; append a three-line BLOCKED note to `docs/launch-log.md`; move on.
- NiaSave contains no new business decisions. A rule belongs in Central. Audit changed files for price/stock/publication writes, computed windows/slots/holds, and browser storage outside `lib/runtime/`.
- Exactly four stop conditions: change a PRD lock; change the seven service kinds or a gate definition; a load-bearing FOUNDER_ASK; move money/touch a real member/enable a partner. Record NEEDS SACHIN and continue unaffected work. Resolve ordinary ambiguity by reading, choosing and logging one line.
- Service kinds stay `member.profile`, `live.projection`, `earn.projection`, `save.projection`, `claim.write`, `claim.status`, `books.plan`.
- Never self-merge, push main or force-push. Preserve all tests. Do not skip or weaken them to obtain a green result. Quote every commit hunk. No Gate B or C claim by Codex.
- P0 supplies `route-audit`, `locale-check`, `bundle-budget`, `niasave-gate.sh`, inventory and the twelve PENDING blocks. Gate B is installed and run by Sachin; never run it from Codex.
- Send, insurance, online payments and uncontracted partners remain off. Secrets are names only. Production/member/financial actions require the user's explicit authorisation.
