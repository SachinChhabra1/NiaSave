# Public homepage preview

Repository: `SachinChhabra1/NiaSave`. Base: `c6201243eb6733a77ac8f48340fab7f4c93e785e` on main. Branch: `feat/niasave-public-home-preview`.

## Domain and release boundary

Verified Vercel project `niasave` (`prj_tTLIuOGLv8YcEE2CP1NHNsZFDFq6`) owns both domains. Apex redirects to www with HTTP 308. No domain, project, deployment-protection, API or indexing configuration was edited. Existing root `X-Robots-Tag: noindex, nofollow` remains; the new entry also expresses that existing restriction in HTML. Production release requires separate user approval; this branch is for review only.

Production previously copied commerce.html to dist/index.html. The new build copies public-home.html to dist/index.html, with the same dispatcher used by Vite development. The React root src prototype remains excluded from the production artifact.

## Public/member route split

- Bare `/` and `/index.html`: public marketing.
- Public fragment allowlist: `#platform`, `#enterprises`, `#investors`, `#public-main`.
- Every other nonempty fragment, including all existing member tabs, unknown-fragment fallback and `#setup?...`: unchanged member app.
- Member login: `/#account`.
- `/commerce.html`: unchanged direct member app.
- `/member.html` and `/member-services.html`: existing Vercel redirects to `/#account` remain unchanged.

The dispatcher fetches the existing same-origin commerce document, mounts its existing body and styles, then loads its original external scripts. Member code, storage, auth, Central contracts, money gates, language selection and API requests are untouched. Setup secrets stay in the fragment until the existing parser removes them. Public visits do not load commerce modules or request member APIs. Back/forward returning to a public fragment reloads the public entry before commerce can canonicalize it to #home.

Tradeoffs: first member entry adds a same-origin commerce.html read; if that read fails, the fallback link preserves query and fragment and opens the direct member document. Member styles settle before the existing scripts run. The original stylesheet imports a Google Font blocked by the existing production CSP; its error event is tolerated so the same fallback-font behavior remains usable. A production-CSP browser regression covers this. Root `/` no longer opens the language chooser until a visitor enters member services; this is the intended public/member split.

## Design and imagery review

Approved desktop and mobile concepts were supplied directly in this task and visually inspected. Original Library IDs: desktop `libfile_c1a1bc447fb48191bcb4b1497ad0e82a`, mobile `libfile_90d1023a13fc81918794ccf568f66341`. Known-ID materialization repeatedly returned signed transfers but its current bundled helper failed with `library file transfer failed: download failed`; native image reads also reported pixels unavailable. The original Library PNGs could not be placed locally. Implementation continued after the user attached both images directly. Do not claim Library materialization succeeded.

The frontend builder and imagegen skills were used. All six new illustration assets are isolated in assets/public-home; no member asset was replaced. Built-in image generation produced standalone scenes matching the concept, then WebP copies were optimized for delivery. Prompts described four workers at a factory, workers approaching housing, a worker at an assembly bench, a grocery shopper, and a family video call. The mobile hero was edited from the generated desktop hero to provide empty upper-left space for native HTML text. No webpage screenshot is used as UI.

Fidelity ledger (attached concepts versus browser screenshots inspected):

| Comparison | Result / intentional deviation |
| --- | --- |
| Hero copy and CTA order | Approved wording and order preserved; real HTML headings, links and buttons |
| Palette | White, soft grey, near-black and restrained blue; no cobalt/lime interface theme |
| Desktop composition | Left hero text, right illustration and caption; four numbered pillars; enterprise split; investor grey band |
| Mobile composition | Header login/menu; illustration behind hero copy; two columns with images preceding pillar names; stacked enterprise and investor blocks |
| Typography | System sans, bold tight headings, muted supporting copy; logical mobile sizes adjusted for readability rather than treating the mockup's raster pixels as CSS pixels |
| Image treatment | Generated matching standalone derivatives, not exact original image pixels; mobile crops refined to retain faces |
| Money honesty | Added explicit planning-only Send notice; booking remains starts-soon, no invented metrics, returns or proof logos |
| Disclosure | Footer identifies all images as generated illustrations, not actual customers/locations |
| Enquiry flow | Preview dialogs clearly state delivery is not connected; verified contact destination is a release dependency |

Above-the-fold copy matches the approved hero/header. Below-fold intentional additions are the Send planning notice and illustration disclosure. No performance/return claims added. Contact dialogs are preview-only and submit no data. They must be wired to a verified destination before release.

## Validation

Passed: engine selftest; Bison 26/26; Tanot 6/6; commerce 423/423; security 49/49; browser 76/76 (57 existing regressions and 19 new public/member tests); Vite build and production artifact build. Storage commands succeed but database integration explicitly skips without DATABASE_URL. No lint/type-check scripts exist; modified JavaScript passed node --check and git diff --check passed.

The native in-app browser verified public rendering/navigation and member-language handoff. Playwright provided repeatable responsive screenshots and regression tests. Desktop screenshot viewport 984×900, mobile 390×900; additional public layouts checked at 320, 700, 768, 1280 and 1440. Local evidence is in the task's sibling preview-evidence/ and baseline-results/. Actual screenshots were inspected with view_image; local Library concept view_image could not be satisfied because downloads failed, but both user attachments were inspected directly.

Remaining review items: confirmed enterprise/investor contact destination; approval of generated image derivatives; production release approval; database integration in a configured nonproduction environment. No merge or production deployment performed.

## Member presentation review

The follow-up polish is limited to CSS at the end of commerce-shell.css. It uses neutral text and surfaces, blue navigation accents, left-aligned journey headings, a padded Live date form, compact Earn explanation rows and quieter login panels. An empty Live card grid no longer reserves space. The existing 440px member column, three text sizes, bottom navigation, language controls, focus indicators and touch targets remain. No member JavaScript, API contract, authorization, data, photo crop or money behavior was changed.

Before/after captures use the existing approved synthetic UI fixtures behind a local read-only server that never forwards API requests. Reviewed at 390px and 1280px: Home, Live, Earn, Shop, Send and Account signed out; ready Live/Shop; synthetic signed-in Home/Earn/Send/Orders; unavailable Live/Earn/Shop/Send; login dialog and Shop purchase-detail dialog. English captures are examples, not customer data. Existing browser regressions additionally cover Hindi, Tamil, Bengali, unavailable/empty Central, password login, touch/keyboard controls and the 500KB first-load budget. Native browser navigation from Live to Earn and opening login were verified without submitting credentials.

Evidence: the task's sibling member-review/before and member-review/after directories, plus test logs in member-review. Housing reservation quotes and authenticated mutation outcomes are covered by existing tests, not screenshots of live member transactions. Storage integration remains skipped without DATABASE_URL. No production merge or deployment occurred.

## Release contact resolution

Enterprise/investor enquiry links now go to https://www.nia.one/contact in the same tab. Nia's current homepage explicitly routes both workforce discussions and investor conversations there, making this the verified existing channel for both audiences. Header/hero partner links remain #enterprises; model links remain #investors; member login remains /#account. The disconnected preview dialogs and their handlers were removed. No email, WhatsApp conversation or form submission was sent during verification. Earlier preview-dialog notes above document the review stage, superseded by this release resolution.
