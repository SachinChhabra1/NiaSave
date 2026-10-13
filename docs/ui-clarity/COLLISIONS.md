# Open PR collisions: NiaSave UI clarity build
Scan date 27 Sep 2026. Base main 896201c. 16 open PRs in SachinChhabra1/niasave.

## A. Real collisions with this build

| PR | Branch | Age | Lane files it touches | Call |
| --- | --- | --- | --- | --- |
| 124 | grok/p5-support-pillars | 3 days | commerce.js, commerce-support.js, commerce-locales/{hi,ta,bn}.js, language-coverage.test.mjs | Merges FIRST if the Founders want it, otherwise it rebases behind us. Not superseded (under 7 days). Direct overlap with PR 1 and PR 2 copy. Also touches vercel-build.sh and lib/commerce/*.mjs, both outside our lane. |
| 123 | grok/p1-owner-readonly-view | 3 days | commerce-capabilities.js, commerce-owner.js, language-coverage.test.mjs | Staff owner view, not member screens. Low overlap: only language-coverage.test.mjs. Rebase behind us. |
| 67 | grok/card-type-left-edge | 11 days | apple-home-guardrails.test.mjs, mesha-home.test.mjs | SUPERSEDED by PR 3 (Home rebuilt from the approved mockup). Diff, carry anything real into PR 3, close with a note. |
| 66 | cursor/mojo-followup-home-copy-locks | 13 days | apple-home-guardrails.test.mjs, mesha-home.test.mjs | SUPERSEDED by PR 0 + PR 3 (home copy and photo locks are replaced by the copy guard and the data lock). Same treatment. |
| 64 | grok/card-names-bold | 13 days | apple-home-guardrails.test.mjs, mesha-home.test.mjs | SUPERSEDED by PR 3. Same treatment. |

## B. No collision (leave alone, do not touch)

| PR | Why |
| --- | --- |
| 128, 127, 126, 125 | Each adds one new lib/commerce module plus its own new test file. No file this build rewrites. |
| 110 | Marked "quarantine only (Founders merge)". Someone else's call. |
| 80 | commerce-ops.js (staff ops) and its own test lane. |
| 72, 7, 6, 5, 4 | Staff pages, rabbit/, api/, vercel files. All outside our lane. |

## C. Merge order
1. PR 0 (guards and data lock) from today's main. Nothing waits on it because it changes no app file.
2. PR 1 to PR 9 in PRD order, each cut from main after the previous merged.
3. PRs 64, 66, 67 closed as superseded at the point PR 3 is dispatched, after diffing them against main and carrying anything real into PR 3's brief.
4. PRs 124 and 123 rebase onto main behind this build. They are not ours to merge.

## D. Note for the team
PR 124 touches vercel-build.sh and non-test lib/commerce files, both outside this build's lane. If the Founders merge it mid-build, the next PR 0 snapshot comparison will flag its commerce.js data lines. Tell the supervisor before merging it.

## E. Carry-over from the superseded PRs, for the PR 3 brief
Read from each PR's diff and description on 27 Sep, before closing them.

- PR 64 is stale on its own terms: it names the four cards Live / Earn / Save / Send. The bar is Live, Earn, Shop, Send. Nothing to carry.
- PR 66 changed `lib/commerce/apple-home.snippet.js` and `scripts/splice-apple-home.mjs`, both outside Grok's lane, to lock exact Home copy tokens into the splice. If it ever merges, it will reject PR 3's new approved copy at build time. Its intent, a lock so Home copy cannot silently regress, is carried into PR 0 instead: the copy guard plus the splice contract test. Nothing else to carry.
- PR 67 holds one real layout fact worth keeping: `commerce.css` still styles Home tiles as the old circular rail (`align-items:center` and `text-align:center` on `.mesha-rail-d`), and those rules beat the font-only overrides in `apple-desktop.css`. So the tiles do not share one left gutter today. PR 3 must set the tile layout from the mockup and will have to override or replace those rail rules in `commerce.css`, which is in the lane. Give this to Grok in the PR 3 brief.
