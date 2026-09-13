#!/bin/sh
# Supplied by P0. Sachin installs as ~/niasave-gate.sh and runs it on the iMac.
# Never changes the caller's checkout; never merges, promotes, or writes G PASS.
set -u
stray=unknown
build=failed
locales=unknown
routes=unknown
passes=0
fails=1
status=1
task_dir=''
finish() {
  if [ -n "$task_dir" ]; then
    git -C "$NIASAVE_REPO" worktree remove --force "$task_dir/repo" >/dev/null 2>&1 || true
    rm -rf "$task_dir"
  fi
  printf 'stray files: %s\nbuild: %s\nlocales: %s missing\nwrite routes: %s disallowed\nℹ pass %s ℹ fail %s\nstatus: %s\n' "$stray" "$build" "$locales" "$routes" "$passes" "$fails" "$status"
}
trap finish EXIT
trap 'exit 1' HUP INT TERM
: "${NIASAVE_REPO:?Set NIASAVE_REPO to the reviewed checkout}"
[ "$#" -eq 1 ] || exit 1
git check-ref-format --branch "$1" >/dev/null 2>&1 || exit 1
cd "$NIASAVE_REPO" || exit 1
stray=$(git status --porcelain --untracked-files=all | wc -l | tr -d ' ')
[ "$stray" = 0 ] || exit 1
task_dir=$(mktemp -d "${TMPDIR:-/tmp}/niasave-gate.XXXXXX") || exit 1
git fetch --quiet origin "refs/heads/$1" >"$task_dir/fetch.log" 2>&1 || exit 1
sha=$(git rev-parse FETCH_HEAD) || exit 1
git worktree add --quiet --detach "$task_dir/repo" "$sha" >"$task_dir/worktree.log" 2>&1 || exit 1
cd "$task_dir/repo" || exit 1
# Build and tests receive no database, member, partner or service credentials.
env -i PATH="$PATH" npm --cache "$task_dir/npm-cache" --userconfig "$task_dir/npmrc" ci --ignore-scripts --silent >"$task_dir/install.log" 2>&1 || exit 1
env -i PATH="$PATH" npm --cache "$task_dir/npm-cache" --userconfig "$task_dir/npmrc" run build:production --silent >"$task_dir/build.log" 2>&1 || exit 1
node scripts/bundle-budget.mjs >"$task_dir/bundle.log" 2>&1 || exit 1
build=ok
locales=$(node scripts/locale-check.mjs --count 2>"$task_dir/locales.log") || exit 1
routes=$(node scripts/route-audit.mjs --count 2>"$task_dir/routes.log") || exit 1
node scripts/route-audit.mjs --dist >"$task_dir/dist.log" 2>&1 || exit 1
node scripts/run-tests.mjs >"$task_dir/tests.log" 2>&1
test_status=$?
passes=$(sed -n 's/^# pass //p' "$task_dir/tests.log" | tail -1)
fails=$(sed -n 's/^# fail //p' "$task_dir/tests.log" | tail -1)
[ -n "$passes" ] && [ -n "$fails" ] || exit 1
[ "$test_status" = 0 ] && [ "$fails" = 0 ] || exit 1
! grep -Eq '^# (skipped|todo) [1-9]' "$task_dir/tests.log" || exit 1
[ "$(git status --porcelain --untracked-files=all | wc -l | tr -d ' ')" = 0 ] || exit 1
status=0
exit 0
