# Guards for this UI build

- Member copy: blocks a new banned word in any of the five languages, an em dash, or the source text mm/dd/yyyy, and blocks a translation of an English line the scan already flags. Staff files `commerce-owner.js` and `commerce-ops.js` are not scanned. Run `node --test lib/commerce/member-copy-guard.test.mjs`. Break it by adding `Central`, `ಸೆಂಟ್ರಲ್`, an em dash, or `mm/dd/yyyy` to a member file.
- Small text: blocks visible member text under 14px that is not already in the baseline, using `parseFloat` on the computed font size. A line already in the baseline fails when the observed size is below the recorded size. Run `npx playwright test tests/browser/ui-clarity.spec.js`. Break it by setting one member line to 13px, or by shrinking a baselined 13px line to 8px.
- Icon word: a bottom-bar button, home tile, shop category, or attention card with an `svg`, an `img`, or a CSS background image must show a word. Run the same browser file. Break it by leaving a shop category tile as a picture with no word.
- Date input: a visible `input[type=date]` on a member screen must already be in the baseline. The source-text check for `mm/dd/yyyy` stays in the copy scan. Run the same browser file. Break it by adding a visible date input on Home.
- Copy on screen: visible banned text must match a complete baseline run on the same screen, not a shorter piece of a longer line, and not a run recorded on another screen. Run the same browser file. Break it by showing a bare `Central` on Home, or a bare `Source` on Home.
- Translation gaps: a new `t()` line with no translation fails, apart from the frozen gap list. Run `node --test lib/commerce/translation-lock.test.mjs`. Break it by calling `t()` with a new English line and leaving it out of a language file.
- Data lines: `api(`, `fetch(`, storage, and path lines stay byte for byte, including `commerce-owner.js` and `commerce-ops.js`. Run `node --test lib/commerce/data-lines.test.mjs`. Break it by editing an `api(` line.
- Server calls: the five member journeys keep the same calls. Run `npx playwright test tests/browser/data-lock.spec.js`. Break it by adding a request from a member screen.
- Queued taps: a saved bag, order, Nest, job, or send plan is still read and shown. Run the same browser file. Break it by stopping the read of `nia-commerce-pending`.
- Home splice: `entryHomepage`, `homeDashboardModel(`, and `homeDashboardMarkup(` stay in place. Run `node --test lib/commerce/home-splice-contract.test.mjs`. Break it by renaming one of those.
- Hold: a pull request labeled `hold`, or listed in `docs/ui-clarity/HOLDS.md`, fails. Run the UI guards workflow. Break it by adding the PR number to `HOLDS.md`.
- Baseline ratchet: the workflow fetches the pull request's base branch onto `refs/remotes/origin/<base>`, proves that ref resolves, and rejects any new `(kind, file, string)` row in `BASELINE.json` or `translation-gaps.snapshot.json`, and rejects a larger total. A base ref that does not resolve fails. The no-baseline success path runs only when the ref resolves and the snapshot file is absent. The ceilings in `tests/ui-clarity/limits.mjs` still apply locally. Run `node --test lib/commerce/baseline-ratchet.test.mjs`. Break it by deleting one baseline row and adding a different one, or by passing a ref that does not exist.

## Known limits

- `requests.snapshot.json` records only GET calls with empty field lists, because the signed-out journeys never POST. Request body field names are protected by the frozen data-lines test instead, which is byte-exact on the `api(` line.
- `replies.mjs` records top-level body keys only, so a nested rename inside `lines[]` would not show there.
- `sortRequests` sorts, so the order of calls is not pinned, only the set.
- `niasave-ui.js` at the repo root holds member copy and is not scanned. It is clean today.
- 553 frozen translation gaps remain. No PR is required to shrink them.
- 41 of the copy rows are clean translations recorded because their English key is flagged. They grant nothing, because copyCovers returns early for a string that is not a violation, and they dissolve when PR 1 changes those English keys.
- The UI guards workflow, the ratchet and limits.mjs all sit inside the builder's lane, so a PR could delete the step and stay green on the node and browser suites. The durable protection is branch protection making both `verify` and `hold` required checks, which is a Founders setting.
