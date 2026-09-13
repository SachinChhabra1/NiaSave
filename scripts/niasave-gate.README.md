# Machine gate runner

Sachin installs `scripts/niasave-gate.sh` as `~/niasave-gate.sh`, exports the **name** `NIASAVE_REPO` pointing at a clean clone, and runs `~/niasave-gate.sh <branch>`. Codex supplies the runner and may syntax-check it; Codex does not run Gate B or claim its result.

The runner fetches the exact branch SHA into a disposable detached worktree. It builds the production artifact, checks bundle size, locales, API entry coverage and built staff pages, and runs all existing and new tests with no inherited service or database credentials. Nonzero counts, incomplete checks, skipped tests and dirty checkouts fail. It always emits six status lines; `unknown` or `failed` is a failure, never a zero. It does not edit the Central ledger.

The build uses the existing locked Vite/Rolldown parser. No runtime dependency was added. The production build is deliberately used instead of the unrelated default Vite artifact.
