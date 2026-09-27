# Contract requests

## 1. lib/commerce/truth-recovery.mjs holds member wording, and it is outside the lane
Raised 27 Sep 2026 by the supervisor, during PR 1.

What happened: PR 1 changed every member-facing "Sign in" to "Log in". Grok also changed the same two strings inside lib/commerce/truth-recovery.mjs, which is a non-test lib file and outside this build's lane, so the change was reverted along with its test.

Why nothing is broken: that file is not copied into dist by vercel-build.sh, and no member file imports it. Only its own test and two old docs refer to it. The strings members actually read live in commerce.js and now say "Log in".

What is left: the file keeps the old wording, so it now disagrees with the member screens. Nothing a member sees is wrong, but the next person reading that file will find stale copy. Someone with the server lane should align these two strings, or delete the file if it is dead:
  expired: 'Please sign in again to continue.'  ->  'Please log in again to continue.'
  personal: 'Sign in to view your accommodation details.'  ->  'Log in to see where you stay.'
and the matching expectations in lib/commerce/truth-recovery.test.mjs.

## 2. Open jobs by area, without sign-in
Raised 27 Sep 2026 by the Live, Earn and Send UI build.

What we need: a Central read of open jobs by area that works with no sign-in. Today the Earn screen reads jobs from /earn, and that call needs a signed-in member. A signed-out member therefore cannot be shown real jobs.

What this build did: the signed-out Earn screen explains the three steps (stay in a Nest, see jobs near it, walk to work), then Log in and Call Nia. It does not invent a job, and it does not add a call.

What to build, outside this lane: a read of open jobs for an area, with no sign-in, using the job fields the Earn screen already shows. An empty reply means there are no jobs. It must not be filled with an example job.

