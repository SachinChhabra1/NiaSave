# Phase 1 overlay

Storefront wiring for F01–F04 + F13 on `grok/ui-truth-recovery`.

- commerce.js local helpers: packReady, reserveReady, bagHasUnconfirmedPack, stayPanel, earnErrorPanel
- No `lib/` import from commerce.js
- Nav send label: My money
- Live/Earn never render bag copy
- Pending pack listed, not reservable; checkout refused if bag has unconfirmed pack
- Product detail keeps Pay at pickup; drops or delivery
- Payments, OTP, UPI, Send transfers remain off
