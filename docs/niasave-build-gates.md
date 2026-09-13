# NiaSave: the member app build, with audit gates

For: Codex · Reviewers: Claude, Sachin · Date: 13 September 2026

Governs: N0 to N10 of `NiaSave-PRD-v2.md`. That PRD is the specification. This document is the operating contract: what you decide alone, what you must stop for, and what proof each step carries. Where the two disagree on a member-facing contract, the PRD governs. Where this document is stricter, this document governs.

Repo: `SachinChhabra1/niasave`. Production surface: `member.html` and the commerce bundle. Central: `SachinChhabra1/rafiqi-central`, governed separately by `rafiqi-central-console-prd.md` and `grok-build-gates-central.md`.

---

## 0. How this works

You run the build. You do not check in between commits, you do not ask for permission to proceed, and you do not wait on review inside a PR. You build each PR to completion, self-check it, declare a SHA, and move to the next unblocked PR while the gate runs.

Three gates apply to every PR:

- **Gate A, self-checks.** Mechanical, run by you against the branch, quoted in the declaration.
- **Gate B, the machine gate.** `~/niasave-gate.sh <branch>` on Sachin's iMac. Six lines. You cannot run it. Declare only when you are confident it passes.
- **Gate C, the browser gate.** Preview and production checks in a real browser, on a throttled connection, run by the browser session or Sachin.

Plus one gate that is specific to this app:

- **Gate G, the Central gate.** A PR that consumes a Central contract cannot be declared until that contract's G-line exists in the ledger (§5). Building against a mock and declaring is the single fastest way to fail this brief.

**A declaration is five lines.** SHA. Files. Hunks quoted. Gate A results. Done. Nothing else. No summary, no narrative, no plan for next time.

---

## 1. Standing rules

Break one and the PR is rejected regardless of everything else.

1. **No self-merge.** Sachin merges. Always. You never push to `main`, never force-push any branch, never rewrite a merged commit.
2. **Quote every hunk** in the commit message. A commit that claims a change shows it.
3. **NiaSave decides nothing.** No pricing, stock, serviceability, PIN coverage, eligibility, allocation, reservation, hold, expiry, substitution, total, discount or delivery window is computed, defaulted, guessed or cached-as-truth on the phone or in NiaSave's server routes. If you find yourself writing a rule, the rule belongs in Central.
4. **Seven service kinds, no eighth.** `member.profile`, `live.projection`, `earn.projection`, `save.projection`, `claim.write`, `claim.status`, `books.plan`. A new kind is a PRD change and a stop condition (§7.2), not an implementation detail.
5. **One writable book.** Never dual-write. Never call a migration a no-op. Any table NiaSave still writes is named in the declaration, with the sentence "NiaSave runtime is the sole writer of this table until cutover".
6. **No staff write surface.** After P0, no NiaSave route, page or script accepts a price, stock level, serviceability flag, PIN coverage or publication switch. Re-verified by Gate A on every subsequent PR, not just P0.
7. **Send stays dark. Insurance stays off. Online payments stay off.** No amount field, no beneficiary field, no payment SDK, no partner redirect that starts a transfer. Ever, in any PR, under any framing.
8. **No invented counterparties.** No KYC vendor, no lending partner, no support partner integration, no credit bureau, no scoring library. Where a partner is planned and not contracted, the flow ends in Central with an honest state.
9. **Secrets are names, never values.** `CENTRAL_ORIGIN`, `CENTRAL_COMMERCE_KEY`, `EARN_SOURCE` and any new name appear in declarations as names only. You never read, print, rotate, commit or echo a value, and the service key never reaches the browser. All Central calls are server-to-server from NiaSave's own server routes.
10. **No member data anywhere it can leak.** Not in logs beyond a member id and a claim id, not in test fixtures, not in a declaration, not in a screenshot you attach. Fixtures use synthetic members.
11. **No route deleted without its destination in the same commit.** Legacy paths redirect. A deleted component body shows where it went.
12. **Tests only go up.** No test deleted, skipped, marked `.only`, or loosened to pass. Every new test file is registered in both `package.json` test lists, and every relative import in a file under test carries its extension. The pass count in Gate B rises by the number you added.
13. **Five languages or it does not ship.** A missing string in `commerce-locales` fails the build. No runtime fallback to English. `language-coverage.test.mjs` is extended, never weakened.
14. **Device budget is a gate.** PRD §5.7. A PR that pushes a route over its JS budget is rejected even if every test passes.
15. **No new runtime dependency** without a line in the declaration giving the package, the version, the gzipped cost and what it replaced. Leaflet stays local and pinned. Nothing is fetched from a CDN at runtime.
16. **Honesty in code.** A figure without a source and a freshness label is a bug. `asOf` is source refresh time, never fetch time. "not in source" and "we are checking" are shippable strings; a silent zero, an empty card and an infinite spinner are not.
17. **Never claim a gate you did not pass.** A mock is not a gate pass. A branch on Central is not a gate pass. A local fixture is not a gate pass. If you cannot prove it against production Central, the PR is BLOCKED (§7.3), not done.

---

## 2. Gate A: self-checks on every PR

Run against the branch before declaring. Quote each result.

```
A1  git diff --name-only main...HEAD
    → every file listed in the declaration, no extras

A2  grep -rEn "price|stock|serviceab|pin_?coverage|publish" $(git diff --name-only main...HEAD | grep -E '^api/|^lib/')
    → every hit is a READ of a Central projection field; quote each one

A3  grep -rEn "POST|PUT|PATCH|DELETE" $(git diff --name-only main...HEAD | grep '^api/')
    → every write route named, and each one is claim.write, books.plan, or session

A4  grep -rn "localStorage\|indexedDB\|sessionStorage" <changed files>
    → every hit is the cache or the unsynced queue in lib/runtime/, nothing else

A5  grep -rEn "setTimeout|Date.now\(\)" <changed files touching windows or slots>
    → no computed delivery window, pickup slot, expiry or hold anywhere

A6  node scripts/locale-check.mjs   (added in P1)
    → 0 missing strings across en, hi, kn, mr, ta

A7  for each new lib/**/*.test.mjs: grep -c "<name>" package.json → must be 2

A8  grep -rn "amount\|beneficiary\|upi://\|payment" src/ commerce*.js api/ | grep -i send
    → empty

A9  node scripts/bundle-budget.mjs   (added in P1)
    → every route inside PRD §5.7

A10 the declaration lists every file and quotes every hunk
```

---

## 3. Gate B: the machine gate

Sachin runs `~/niasave-gate.sh <branch>` and pastes six lines. Pass is exactly:

```
stray files: 0
build: ok
locales: 0 missing
write routes: 0 disallowed
ℹ pass N ℹ fail 0
status: 0
```

The script, to be created once before P0 declares (you supply it in P0, Sachin installs it):

```sh
#!/bin/sh
# ~/niasave-gate.sh <branch>
set -e
cd "$NIASAVE_REPO"
git fetch --quiet origin "$1" && git checkout --quiet "origin/$1"
echo "stray files: $(git status --porcelain | wc -l | tr -d ' ')"
npm ci --silent && npm run build --silent && echo "build: ok"
echo "locales: $(node scripts/locale-check.mjs --count) missing"
echo "write routes: $(node scripts/route-audit.mjs --count) disallowed"
npm test
echo "status: $?"
```

`N` rises by the number of tests you added. A PR that adds a screen and no tests fails here.

---

## 4. Gate C: the browser gate

Common part, on the preview for the declared SHA, signed in as a synthetic member, Chrome DevTools throttled to Slow 3G with a mid-tier CPU multiplier:

```
C1  The route renders in all seven states (PRD §5.5). Screenshot each.
C2  Language switch through en, hi, kn, mr, ta: no English string survives, no layout break
C3  Boundary down (block the service route in DevTools): the screen shows its degraded
    state within 8 s, the call action is present, no money figure renders unlabelled
C4  Offline, take the PR's primary action, go online: exactly one record, state visible
    after a full app restart
C5  The PR's own checks, listed per PR below
C6  Bundle: the route's transferred JS, gzipped, quoted against its budget
```

After merge and promote, on production, the same C3 and C4 against real Central, plus the rollback ID of the previous production deployment written in `docs/launch-log.md` before promote. Every time.

---

## 5. The Central gate ledger

`docs/central-gate-ledger.md`, created in P0, appended by you, never edited in place.

One block per gate G1 to G12 (PRD §4):

```
G6 save.projection
  central SHA:      <sha>
  request:          <captured signed request, key redacted>
  response:         <captured response, synthetic member>
  failure captured: <the boundary-down or refused-freshness response>
  verified by:      <who ran it> on <date>
  status:           PASS | PENDING
```

Rules:

- A gate is PENDING until both a success and a failure are captured against **production** Central. A gate with no captured failure is PENDING.
- You may write PENDING blocks with exactly what is missing. You may not write PASS. **Only Sachin or the reviewing browser session writes PASS.**
- A PR blocked on a PENDING gate is not started against a mock. It is skipped, and you move to the next unblocked PR.
- If Central's response shape differs from the PRD, you do not adapt silently. You raise a **contract request** (§7.4) and skip the PR. You never patch Central from this brief.

---

## 6. The PRs

Build in this order. Skip a blocked one, come back to it.

### P0 · The second brain comes out (N0)

**Unblocked by anything. Start here, today.**

**Scope.** Inventory every route, page and script in NiaSave that can write a price, stock level, serviceability flag, PIN coverage or publication switch. Candidates to audit include `api/stock.mjs`, `api/order.mjs`, `api/orders.mjs`, `api/settlements.mjs`, `api/scan.mjs`, `api/ledger.mjs`, `api/cash.mjs`, `api/recon.mjs`, `api/source.mjs`, the `staff/` surface, `commerce-ops.js` and `commerce-owner.js`. Do not trust that list; produce your own from the code.

For each: remove it, or hard-disable it behind a fail-closed guard that returns 410 with a one-line reason. Removal is preferred. Anything a member journey still depends on is named in the declaration with the journey and the replacement gate.

Also in P0: `scripts/route-audit.mjs` (asserts zero disallowed write routes, used by Gate A and Gate B), `scripts/locale-check.mjs`, `scripts/bundle-budget.mjs`, `~/niasave-gate.sh`, `docs/central-gate-ledger.md` with all twelve gates as PENDING.

**Tests required.** `route-audit.test.mjs` (a route that accepts a price fails the audit; a read route passes), plus one test per disabled route asserting 410 and no write.

**C5.** Every disabled route returns 410 signed in and signed out. `member.html` still loads. No member journey regressed: Live, Earn and Save each render whatever they rendered before.

**This PR is the only work that proceeds before Central finishes. Declare it first.**

### P1 · The shell (N1) · needs G1, G2

**Scope.** PRD §5 in full, as `lib/runtime/`: the seven universal states, the read cache with per-kind freshness and refusal, the unsynced queue, the claim state machine, the idempotency and 409 handling, the error envelope, the session, the five-language loader, the call action, the device-budget harness. Navigation Home · Live · Earn · Save · Send with Send visibly off. No screen content.

**Tests required.** `cache-freshness.test.mjs` (each kind's rule; a refused payload renders nothing derived from it), `unsynced-queue.test.mjs` (durability across restart, ordering, backoff, 24-hour surfacing, never invents a result), `claim-state.test.mjs` (every state renders a next step; unknown state degrades to checking), `idempotency.test.mjs` (replay returns one claim; 409 re-renders and does not resubmit), `states.test.mjs` (no route can render a blank region or a spinner past 8 s).

**C5.** Every state forced by hand in DevTools renders. Send shows its off screen with no input. Cold load inside budget on Slow 3G.

### P2 · Home (N2) · needs G3
### P3 · Live (N3) · needs G4
### P4 · Earn (N4) · needs G5, G7
### P5 · Save, browse and claim (N5) · needs G6, G7
### P6 · My requests (N6) · needs G8
### P7 · NiaBooks (N7) · needs G9
### P8 · My plan this month (N8) · needs G9
### P9 · Nia health, read-only (N9) · needs G10
### P10 · Help and support cases (N10) · needs G11

Each of P2 to P10 takes its scope, rules, degraded state and acceptance tests verbatim from the matching PRD section (§6.1 to §6.10). For each, the declaration additionally carries:

- the PRD acceptance tests it satisfies, by number (A1 to A27), each with the test file that proves it;
- the C5 list, which you write from the PRD's rules for that screen and Sachin approves as part of the gate;
- the bundle number for the route;
- the screenshot set: seven states, five languages, boundary down, offline-to-online.

Write the C5 list for P<n+1> when P<n> merges, the same way Central's brief does it, so each screen's checks are written with the previous screen's evidence in hand.

---

## 7. Running on your own

### 7.1 What you decide alone

Everything not in §7.2. Specifically: file and module layout, naming, component structure, how the cache is stored, test design, copy drafting in English (then translated), commit granularity, refactors inside the files a PR already touches, the order in which you attack blocked and unblocked PRs, and every judgment call the PRD does not name. Make the call, record it in one line in `docs/launch-log.md`, and keep moving. Do not open a question you can answer by reading the PRD.

### 7.2 Stop conditions

Exactly four. Stop, write the question in `docs/launch-log.md` under `NEEDS SACHIN`, and continue with other work.

1. A change to one of the twelve locks.
2. A change to the seven service kinds, or to a gate's definition.
3. One of the eleven FOUNDER_ASKs (PRD §9) becomes load-bearing for the PR in front of you. Name the ask by number and say what you will assume if no answer arrives in 48 hours, then proceed on that assumption and mark the code with the assumption.
4. Anything that moves money, touches a real member's data, or turns on a partner.

Nothing else is a stop. Not an ambiguous spec (read the PRD, choose, record). Not a missing Central contract (that is a BLOCKED, §7.3). Not a design preference.

### 7.3 When a PR is blocked

```
BLOCKED P<n> · <gate> · <the exact field, shape or behaviour missing>
what I tried:     <one line>
what unblocks it: <one line, addressed to Central>
moving to:        P<m>
```

Append to the launch log, move on. Do not build it against a mock. Do not stub the Central side. Do not "prepare" the screen by writing its logic locally, because that logic is the thing this whole build exists to remove.

### 7.4 Contract requests to Central

When Central's shape is wrong or missing, write one block in `docs/central-contract-requests.md`: the kind, the field, why the member screen needs it, the exact shape you need, and the PRD line that requires it. That file is the only channel. You do not patch Central from this brief, and you do not work around it in NiaSave.

### 7.5 Daily report

One append to `docs/launch-log.md` per working day, five lines, no prose:

```
date
declared:  <PRs and SHAs>
merged:    <PRs>
blocked:   <PRs and gates>
decisions: <one line each, the calls you made under 7.1>
```

### 7.6 Pace

Declare a PR when it is complete, not when it is large. If a PR has run more than two days without a declaration, split it and declare the half that is done. A branch nobody has reviewed for two days is a branch that is drifting from Central.

---

## 8. Final gate, before members are let in

All of it, quoted, before NiaSave is pointed at real members:

```
F1  PRD §10, every line, each with pass or untested and the evidence
F2  A1 to A27, each mapped to a named test that runs in CI
F3  G1 to G12, every block PASS, each with a captured success and a captured failure
F4  niasave-gate.sh on main: six clean lines
F5  route-audit: 0 disallowed write routes, and the same audit run against the built dist
F6  Source audit: every member-facing figure traced to a Central projection field
F7  Seven states x five languages, captured, on every shipped screen
F8  Device budget on a real mid-tier Android on a real weak connection, numbers quoted
F9  Offline-to-online cycle on production: exactly one record per action, visible after restart
F10 Access revocation in Central reflected in the app within one cache window
F11 Send, insurance and online payments all provably off in the built bundle
F12 Rollback ID of the prior production deployment in the launch log
```

F1 and F6 are the long ones and they are the point. An app that passes F4 to F12 and half of F1 is a renderer with a nice navigation bar.

---

## 9. Deliberately not in this brief

- Central's build. That is Grok's, under `grok-build-gates-central.md`. You raise contract requests; you do not open PRs there from this work.
- The member visual redesign. The four-tab prototype and the Apple-lever palette are a separate track; this brief ships behaviour, states and honesty into whatever chrome is current.
- Send, in any form.
- Nia health's calculation. Central's, and gated at G10.
- Any partner integration until contract, connector, consent and ownership exist.
- Populating Central's records. That is the operating team's, and every screen must render correctly with them empty. That is the day-one state and the acceptance state.
