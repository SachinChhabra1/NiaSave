# P0 connection recovery and canonical-origin cutover

Prepared 10 September 2026. Code readiness is not hosted acceptance.

## Temporary preview connection

The Central adapter now supports two server-only NiaSave environment settings:

- `CENTRAL_PROTECTION_BYPASS_SECRET`: a newly generated Central automation-bypass credential, set by Sachin as Sensitive.
- `CENTRAL_PROTECTION_BYPASS_ORIGIN`: the exact HTTPS origin also configured as `CENTRAL_ORIGIN`. For the existing showcase this is `https://rafiqi-central-git-test-showcase-sachinchhabra37-8426s-projects.vercel.app`.

The adapter sends the credential only as `x-vercel-protection-bypass`, alongside the existing signed service envelope. It rejects an origin mismatch, never follows redirects, never creates a bypass cookie and never forwards a browser credential. It does not change Vercel Authentication or add a public alias exception. A Vercel bypass credential is project-wide at Vercel; the exact-origin restriction is enforced by this adapter, not a narrower Vercel token scope.

Sachin must generate and set the new credential. Do not reuse the Aug 26 value. Rotate `SHOWCASE_CENTRAL_KEY` in NiaSave and `CENTRAL_COMMERCE_KEY` in Central's Preview / `test/showcase` together. Rotate the other disclosed credentials from the brief in the same controlled release. No values belong in Git, terminal transcripts, chat, PRs or tests.

Rebuild through `docs/hosted-showcase.md`'s domain assembler. Deploy without assigning the production domain, verify the resulting artifact, then promote it. A normal main-branch build does not reproduce the preserved legacy operations release.

## Repeatable hosted acceptance

`node scripts/check-hosted-showcase.mjs` reads credentials from its process environment. Supply `SHOWCASE_PASSWORD`, optional `SHOWCASE_ACCEPTANCE_ORIGIN`, the four comma-separated `SHOWCASE_EXPECTED_JOB_IDS`, and `SHOWCASE_EXPECTED_APPLICATIONS` as an array of `{id,status}` expected held records. Obtain these non-secret record identifiers from the authorised test desk; do not guess them or refresh expired fixtures implicitly.

The default performs only reads after creating a test session. Set `SHOWCASE_ACCEPTANCE_WRITE=1` only for the isolated fictional showcase to run the complete loop: read revision, save the same existing figures, exact retry, stale 409 and reload. It also checks four expected Demo mandates and held application states. This advances the fictional plan revision once but does not change the saved figures. Output contains check names only, never credentials or member data. The script refuses a backend that does not identify itself as the isolated showcase with payments off.

Verify separately that an unsigned request to another Central preview still meets the Vercel login gate; a valid transport bypass without a Central signature must still get application 401. Record evidence against the actual deployed commit. Local stub tests do not establish hosted persistence.

## Canonical Central cutover

After Sachin configures the matching production service credential, confirm the canonical Central endpoint has the intended authorised fictional access/source records. Point NiaSave `CENTRAL_ORIGIN` to `https://rafiqicentral.com` and repeat the same acceptance script through the assembled domain release. A key alone does not migrate the preview's test records or authorise a real member dataset.

The adapter never sends the preview bypass to `https://rafiqicentral.com`, even if the temporary settings remain. After successful cutover, delete those two NiaSave settings, revoke the temporary Central bypass, and verify the test alias is behind SSO with no exception. Do not change `SHOWCASE_INSTANCE`, replace either database, or silently convert the hosted showcase into member production.

## Current evidence

The four new adapter tests pass, and the full commerce suite passed locally before release. Hosted acceptance, paired rotations, redeploy/promotion and canonical-origin cutover are pending. No secret was generated, read from the dashboard, or entered by this change.

Reference: [Vercel automation bypass documentation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

## Per-caller service credentials

After Central's registry change is deployed, Sachin can set a distinct `CENTRAL_SERVICE_KEY_ID` and `CENTRAL_SERVICE_KEY` for each NiaSave production, preview and UAT caller. The ID must identify the matching slot in Central's `CENTRAL_SERVICE_KEYS` registry. Both NiaSave settings are required together; partial configuration fails closed and cannot silently use the shared key. The signature algorithm and member-scoped envelope remain unchanged.

For rotation, first add the new current slot in Central and retain the old slot as previous with a short explicit expiry (recommended at most 24 hours). Then update the matching NiaSave caller and redeploy via the assembler. Verify both slots during the window, other callers unchanged, then remove the previous slot after expiry. Once the registry exists, Central does not accept the legacy shared-key fallback. Inventory and migrate all callers together before first enabling the registry. This change covers NiaSave-to-Central member calls; the reverse operator gateway still uses its separate existing signing context and needs its own coordinated migration.
