# Earn map: pay and return commute contract

The NiaSave Earn map now shows each numbered mandate's company, role, monthly pay, CTC confirmation status and estimated return travel cost per workday. Desktop labels sit beside the pins; phones show matching numbered summaries below the map. A pin or summary opens full details, including an illustrative monthly travel budget at 26 workdays. This is a travel budget, not take-home pay.

## Central implementation required

Central remains the source of record. Extend the member-scoped Walk2Work projection and NiaSave gateway/public-job allowlist to publish these optional fields; they are not present in the current feed:

- `compensation: { type: "ctc", verified: true, min, max, period: "month" | "year" }`. Values are INR. Keep existing `payMin`, `payMax` and `payPeriod` separate: monthly pay must not be relabelled CTC. Until confirmed, NiaSave displays “CTC not confirmed”.
- `commute: { studioId, jobRevision, mode, returnMin, returnMax, source, asOf, validUntil, routeVerified: true }`. Values are INR per return journey/workday. Modes currently supported: walk, bus, shuttle, metro, auto. Bind the estimate to the member's current studio and mandate revision. Resolve an actual usable route and include both directions, connections and applicable fares; do not derive fares or walking suitability from straight-line distance. Retain route evidence and operator verification in Central.

The frontend accepts commute estimates only when the studio and job revision match, the route is verified, the source is populated, the amounts are ordered and nonnegative, and the estimate is no more than 24 hours old and not expired. Missing/stale estimates show “Return fare awaiting route estimate”. Central should refresh estimates independently of operator browser sessions. Changes to residence, workplace or mandate must invalidate earlier route estimates.

## Presentation data currently displayed

Only explicitly marked demo mandates whose employer starts with “Demo ·” receive illustrative fallback budgets: ₹0 for walking where straight-line distance is under 1 km; otherwise ₹30–₹50 for a bus return journey. These are invented presentation assumptions, not verified fares, routes or a recommendation that walking is suitable. The UI labels them “Example budget; route unverified”. Replace these fallbacks with Central-owned demo commute records when the projection is extended; live mandates never receive them.

The popup multiplies the daily range by 26 for an explicitly labelled monthly illustration. Once Central supplies scheduled workdays, use those with a displayed basis instead of assuming attendance.

## Acceptance checks

- Verified CTC is shown with its actual month/year period; ordinary pay remains separate.
- Return costs are member-residence scoped, use valid route/fare evidence and cannot leak across members.
- Changed mandate revision, moved residence, stale/expired estimates and absent routes suppress the old estimate.
- No demo fallback reaches live mandates.
- Company and role content is escaped. All four numbered jobs remain readable on desktop and phone, and opening a pin still links to the correct job card.

Validation completed: 48 commerce tests, production build, and browser checks at 1280px and 390px widths.
