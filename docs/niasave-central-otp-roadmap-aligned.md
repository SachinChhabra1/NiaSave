# NiaSave + Central OTP roadmap — 25 September 2026 alignment

Status is for owner review of the aligned candidate based on NiaSave e6a395d03316263d9f2c825fe19f22fe944f3bc6, published only to the private ambitionii/NiaSave-OTP-review repository. It is not a live-release or paired-deployment attestation.

| Workstream | Status |
|---|---|
| Local NiaSave alignment/review/tests | Complete for the bounded source review; final command counts are recorded in `docs/niasave-central-whatsapp-otp-review.md`. |
| Central SOURCE contract | Compatible by source inspection of the supplied Central audit at `c3ea185d1e579379ead3d8b00693deaf1cf172c0`; this does not verify DEPLOYMENT. |
| Central current gate | Fails at `npm test`; `ui-parity` also fails. Root cause is not established. |
| Local Central tests | Not run. |
| Final independent NiaSave checks | Focused 54/54, commerce 316/316, security 46/46, self-test, both build modes and diff check passed after corrections. |
| Final browser checks | 16/16 passed: 14 unchanged upstream viewport cases and 2 fresh-browser personal-login submission cases at 390/1280px, all using local mocks. |
| Deployment/config/member/template checks | Pending. |
| Owner Preview deployment | Pending. |
| Real mobile WhatsApp UAT | Pending; fake Central fixtures and the labelled TEST phone are not UAT. |
| Private review publication | Updated aligned branch is local; publication approval pending. Original review branch is preserved. |
| Upstream PR/merge | Pending owner approval; no upstream writes performed. |

Required variable names to verify by the owner are listed in the review handoff; values and secrets are intentionally absent. No Central source, connector, schema, migration, deployment, or production configuration change is included.

## Build and Preview owner verification

In Preview, `COMMERCE_STOREFRONT=1` selects `commerce.html` at `/`; otherwise `vercel-build.sh` can select the legacy `member.html`. The flag's live value is **UNKNOWN**. This remains an owner verification, not an automatically changed setting or a confirmed missing setting. The supervisor's test-only storefront build matched `dist/index.html` to `commerce.html`.

The compatible SOURCE contract must remain distinct from verified DEPLOYMENT: no deployment configuration, Central schema/credential/template state, live member eligibility, or WhatsApp delivery was verified here. The Central gate status above is evidence of a current failing gate, not an established root cause.
