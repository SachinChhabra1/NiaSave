# NiaSave data connections: frozen list

Taken from main at 896201c (26 Sep 2026). This build changes words, layout and pictures only. Everything on this list must work exactly the same after every PR. Grok never changes it; the supervisor never merges a PR that does.

## 1. Calls from member screens to the NiaSave server (all under /api/commerce)

All go through one helper, `api()` in `commerce.js` (and `commerce-member-auth.js` for sign-in paths). The server passes them on to Central.

| Area | Paths |
| --- | --- |
| Sign-in | /auth/login, /auth/logout, /auth/request, /auth/verify, /auth/set, /auth/update, /auth/preview, /auth/password, /auth/password/request, /auth/password/set, /auth/password/verify, /auth/passkey/options, /auth/passkey/verify |
| Membership | /membership, /membership/enrol, /membership/recovery, /recovery |
| Live | /nests, /nests?start=, /nests/availability, /nests/quote, /nests/bookings, /nests/cancel |
| Earn | /earn, /earn/applications, /earn/applications/withdraw |
| Shop | /catalogue, /quote, /orders, /cancel |
| Send and books | /books, /books/entries, /books/consent, /books/plan, /books/plan?month= |
| Help and partners | /support, /partners, /partners/referrals, /partners/withdraw |

Frozen for each: the path, the method, the request body field names, the idempotency-key header, the timeout, and the response fields the screen reads.

## 2. Staff calls on the member site (owner view)

`/v1/staff/login` and `/v1/staff/storefront` in `commerce-owner.js`, and `/api/commerce/staff/` in `commerce-ops.js`. Not touched by this build at all.

## 3. Things stored on the member's phone

| Key | What it holds | Why it matters |
| --- | --- | --- |
| nia-language | chosen language | member keeps their language |
| nia-commerce-bag | Shop bag | member keeps their bag |
| nia-commerce-pending, nia-commerce-cancel-pending | Shop taps not yet sent to Central | the unsynced queue: renaming loses a member's order |
| nia-nest-pending | Live booking taps not yet sent | same |
| nia-earn-pending, nia-earn-withdraw-pending | job applications not yet sent | same |
| nia-send-plan | Send plan draft | member keeps their draft |
| niaOpsToken, niaOwnerView (session only) | staff owner view | staff stay signed in |

Frozen: the key names and the shape of what is stored.

## 4. Translations

Every screen line is looked up by its English text (`t('English line')`). Changing an English line changes the lookup key. The new English line must be added to all six language files in the same PR, or members in Hindi, Tamil, Bengali, Kannada and Marathi see English.

## 5. Files outside the build

`api/**`, all non-test `lib/**`, `vercel.json`, `vercel-build.sh`, environment variables, staff pages, and the rafiqi-central repo. Not touched.
