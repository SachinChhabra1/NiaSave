# Passkey acceptance environment

Deployed 9 September 2026. This is separate from niasave.com and Central's investor-showcase environment. No live member data was copied.

## Addresses

- Member site: https://niasave-access-uat-sachinchhabra37-8426s-projects.vercel.app/#account
- Staff Central: https://rafiqi-central-access-uat-sachinchhabra37-8426s-projects.vercel.app/members
- The shorter https://niasave-access-uat.vercel.app address redirects to the exact configured passkey origin. Passkeys registered here will not sign into niasave.com.
- The member site uses the existing showcase invitation username/password as an outer gate. It then requires each test member's own passkey; the shared preview-member login is rejected.

## Setup

1. Configure RESEND_API_KEY for Production on the **rafiqi-central-access-uat** Vercel project, then redeploy that project. Its inherited Preview source had an empty key; the existing production key cannot be retrieved. Until this is configured, staff email sign-in is unavailable. Do not place the key in documents or chat.
2. An approved staff admin signs into the test Central. Create and review a test enrolment under Jat Unit → Members; no real member identity documents are needed for a synthetic training record. Keep any synthetic profile clearly named UAT.
3. In the member's passkey setup action, record the relevant verification reference and the own-phone confirmation. Create the ten-minute setup code. Never describe synthetic training evidence as verified real KYC.
4. On the member's own phone, open the member test address, choose Member sign in → First time or a replacement phone?, enter the setup code, confirm own-phone use, then choose Set up my passkey. The device owner approves the fingerprint, face or screen-lock prompt.
5. Subsequent visits use Sign in with a passkey. Staff recovery issues a replacement setup code and immediately revokes previous credentials and sessions.

## Configuration and isolation

- Dedicated Vercel projects: niasave-access-uat and rafiqi-central-access-uat. Their Production targets are **test environments**, not member production launch.
- Separate empty Postgres databases and dedicated roles on the existing test infrastructure: niasave_access_uat and central_access_uat. Each application role cannot connect to the other's database.
- New service-signing key and staff session secrets are scoped to these projects. The member runtime has passkey access and durable persistence enabled, with dummy mode off and no imported showcase orders, stock or profiles.
- Central applied migrations 0001–0015. Scheduled source refresh is absent from this isolated deployment. No production Sheets sources or existing database credentials were copied into it.
- Existing staff admin/operator email allowlists are retained. Staff Central continues to require its authenticated session; no auth-off deployment or permanent test-admin bypass was added.
- Unavailable partner integrations remain unavailable. Real fulfilment and stock verification remain separate operational work.

## Verification

Nine hosted browser checks passed with a synthetic identity and Chrome's virtual authenticator: signed-out catalogue privacy; registration through the real UI and Central signature verification; Secure HTTP-only session storage; logout; discoverable sign-in; immediate recovery revocation; old-credential rejection; replacement retaining the history owner; suspension stopping the next request. The account page rendered after registration and recovery at phone and desktop sizes without browser errors. This does not replace device-owner approval or real-phone/PWA acceptance.

The synthetic automated profile is suspended after verification. No actual person's passkey has been created by the agent. Boundary checks also confirmed the outer password gate, canonical-address redirect, legacy preview-login rejection, staff session enforcement and Central signature enforcement.

Deployments: Central dpl_BzSYg8ddECdRxBrfDzZonFbvj4rM; NiaSave dpl_JAvy6N9MPF45eoc4zqUNvDtrRAon. Both Ready.

## Rebuild

Run `node scripts/build-access-uat.mjs <separate-output-directory>` from this repository and deploy that artifact to the dedicated NiaSave test project. The builder includes only member runtime surfaces and the signed Central operations gateway, checks static member imports, preserves the outer password gate and enforces the canonical passkey origin. It does not change niasave.com's domain or deployment.

Required member settings: ACCESS_UAT_ENABLED, ACCESS_UAT_ORIGIN, ACCESS_UAT_PASSWORD, DATABASE_URL, CENTRAL_ORIGIN, CENTRAL_COMMERCE_KEY, COMMERCE_MEMBER_AUTH=passkey, COMMERCE_ENABLED=1, COMMERCE_BOOKS_ENABLED=1, DUMMY_DATA=0, STAFF_AUTH_REQUIRED=1, STAFF_TOKEN_SECRET, STAFF_PASSWORD and EARN_SOURCE=central. Central requires its database and staff-auth settings plus MEMBER_PASSKEYS_ENABLED=1 and MEMBER_PASSKEY_ORIGIN equal to ACCESS_UAT_ORIGIN. Keep credentials in the deployment configuration only.
