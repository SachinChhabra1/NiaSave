# Protected Central UAT access

NiaSave can call a Vercel-protected Central UAT deployment without changing its signed member-service contract. Configure these **server-only** settings on the isolated NiaSave deployment:

- `CENTRAL_ORIGIN`: the exact HTTPS Central UAT origin.
- `CENTRAL_PROTECTION_BYPASS_ORIGIN`: that same HTTPS origin, independently pinned.
- `CENTRAL_PROTECTION_BYPASS_SECRET`: the target **Central UAT project's** authorized automation bypass secret.

An origin may have one trailing slash, but must not contain credentials, a path, query or fragment. A mismatched or incomplete pin fails before sending a request. Do not use NiaSave's own `VERCEL_AUTOMATION_BYPASS_SECRET`, a browser cookie, or a secret in a URL. Keep these settings out of client bundles and logs. Vercel's automation secret grants access across the target project's deployments; use the dedicated UAT project.

With `CENTRAL_PROTECTION_BYPASS_SECRET` unset, request headers and production behavior remain unchanged. When configured, only `x-vercel-protection-bypass` is added. The existing `x-niasave-signature`, signed body, member authorization, timeout and redirect rejection remain. No bypass cookie is requested. Central still verifies its service signature and member permissions.

This setting only resolves deployment protection. It does not configure WhatsApp, approve a member, migrate Central, or prove OTP delivery. Follow the existing real OTP/password acceptance flow after the isolated backend is ready.

Provider reference: [Vercel Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
