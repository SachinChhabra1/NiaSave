# Security actions for the niasave.com showcase

9 September 2026. No secrets in this file.

This origin is an invited walkthrough. It is not a member launch and must not hold real phones, Aadhaar, bank, or UPI data. All testers share one fictional member.

## Rotate (Vercel / password manager only)

- HTTP Basic invite password for realm `NiaSave invited access`
- `SHOWCASE_CENTRAL_KEY`
- `STAFF_PASSWORD` and `STAFF_TOKEN_SECRET`
- Any password that was pasted into chat, email, or tickets

Do not write the new values into Git, this document, or a pull request.

## Set on the live Vercel project

- `STAFF_AUTH_REQUIRED=1` — the `.env.example` default does not change production by itself
- Keep `DEMO=1` and `DUMMY_DATA=1` on this host

## Previews

Gate or delete stale `niasave-*-projects.vercel.app` deployments. Confirm each remaining preview still challenges unauthenticated visitors.

## Release constraint

Do not promote this change with a normal `main` deploy that replaces the domain assembler. Follow [hosted-showcase.md](hosted-showcase.md). Use the rollback URL recorded there if the assembled domain breaks.

Launch blockers that remain after tonight are in [HANDOVER.md](HANDOVER.md) section 4 (OTP, UPI, staff identity, ledger, remittance).
