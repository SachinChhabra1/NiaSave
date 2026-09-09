# Para 2 — current names and ownership

Authoritative naming update · 9 September 2026 · requested by Sachin

Use these names in screens, reports, roadmaps, handoffs and status messages across Rafiqi Central and NiaSave.

| Para 2 unit | Function | NiaSave relationship | Retired public name |
|---|---|---|---|
| Jat Unit | Living | Live: Nests, residence, enrolment and KYC | Bison / Operation Bison |
| Sikh Unit | Save operations | Save: essentials, orders and insurance when integrated | Polo / Operation Polo |
| Dogra Unit | Enterprise demand | Employer demand supporting Walk2Work → Earn | Tanot |
| Assam Unit | Member acquisition | Acquisition and referrals into the shared member record | Madras |

NiaSave member navigation remains **Live · Earn · Save · Send** (LESS). Walk2Work owns the Earn mandates and applications. Send contains NiaBooks and monthly plans; money transfer requires the payments-bank integration. Send is not a fifth operations unit, and Assam must not be relabelled Send.

Enrolment and KYC belong to **Jat Unit (Living), Para 2**. Assam links to that member record; it does not independently approve KYC.

## Compatibility rule

Existing paths such as `/api/bison`, `/bison.html`, `/api/polo`, `/ops.html`, `/tanot/`, product identifiers and database/state/environment keys remain unchanged for compatibility. The Assam deployment hostname also retains its existing technical name. Do not rename or migrate those as part of a presentation refresh. Mention a legacy identifier only in code-level diagnostics, explicitly labelled technical.

Say **“Jat Unit database quota”** in a user-facing status update, not “Bison quota.” Refer to **“Sikh Unit stock, price and pickup-location verification.”** Historical commit/PR descriptions are historical records; current handoffs must use this contract.

## Current integration state

Central PR #16 merged to main at `3fd6856`; test/showcase was synchronized at `83054aa`. Central migrations 0008 and 0009 are deployed. NiaSave's protected showcase reads Walk2Work Earn and monthly plans from the signed Central test boundary. Its `CENTRAL_ORIGIN` remains the test alias. Central production service access remains unconfigured and fail-closed.

Remaining work: Jat Unit enrolment/access; partner integrations; Jat Unit database quota; Sikh Unit stock/price/location verification; native-speaker and real-device checks. Naming changes do not resolve these operational gaps.
