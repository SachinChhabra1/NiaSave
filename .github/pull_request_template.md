## What changed

Describe the member, staff, API or operating change in plain language.

## Proof

- [ ] `npm test`
- [ ] `npm run test:storage`
- [ ] `npm run build:production`
- [ ] Relevant phone screen checked at narrow width
- [ ] Relevant API request and response checked
- [ ] Data persisted or explicitly confirmed as non-persistent

## Production impact

- [ ] No environment change
- [ ] Environment change documented in `docs/HANDOVER.md`
- [ ] No database migration
- [ ] Migration and rollback plan included
- [ ] Demo and live data are clearly distinguished
- [ ] No OTP, token, phone, bank or payment secret appears in code or logs

## Rollback

State the last known-good deployment or explain how to disable the change safely.
