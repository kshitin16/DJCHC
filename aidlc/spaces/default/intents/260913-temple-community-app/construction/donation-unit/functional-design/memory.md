<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-14T05:19:31Z — Modeled RECURRING Donation records as the mandate itself rather than one record per periodic charge, since individual charge execution/history is the aggregator's responsibility — flagged explicitly as an assumption to revisit once the real aggregator's recurring-payment API is known, rather than over-designing against an unconfirmed shape.
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-14T05:25:06Z — Iteration 1 review (NOT-READY, 1 Critical + 1 Major + 1 Minor) found that CANCELLED, frequency, and cancelledAt were introduced in this Unit's own artifacts without amending the shared Contract 5 in contract-summary.md, which FlutterAppUnit actually consumes — an upstream artifact drift, not just a local defect. Fixed by amending Contract 5 additively (new enum value, new optional fields, new cancelDonation mutation), explicitly labeled as a Functional-Design-time amendment, consistent with the project's no-formal-versioning/update-both-sides-together practice. Also fixed the state table's guard condition (explicit donationType=RECURRING + requester-identity check instead of relying on an informal row label) and clarified that amount's 0.01 floor is a technical constraint, not a contradiction of Q1's 'no minimum' business decision.
- 2026-09-14T05:19:31Z — Added a CANCELLED status value to the Donation entity beyond what Contract Design's Contract 5 enumerated (INITIATED/PENDING/SUCCEEDED/FAILED only) — Q3's in-app-cancellation decision requires it. This is a downstream refinement of an upstream artifact's enum, not a contradiction of it.
- 2026-09-14T10:20:00Z — Re-review after the backward-jump guard recovery (NOT-READY, 1 Critical + 1 Major) found two real defects that predated the redo: (1) the entity identifier was named `donationId` throughout while Contract 5 names it `id` — the same defect class already caught once at suggestion-unit but missed here — fixed by renaming to `id`; (2) `initiateDonation`'s return type `DonationInitiation` was referenced in Contract 5 but never defined — the same class of gap as pdf-library-unit's `DocumentUploadTarget` — fixed by defining it (donationId, checkoutUrl, checkoutReference) in Contract 5 and describing its shape in the Initiate Donation workflow.
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-14T05:19:31Z — Kept the question set to 3 (amount limits, frequency, cancellation) rather than also asking about donation receipts/confirmations, given this Unit is a later-release, placeholder-level design already flagged for revision once the real aggregator exists.
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-09-14T05:19:31Z — None beyond what's already in entities.md's Assumptions section (recurring-charge modeling) and contract-summary.md's existing Open Questions table (webhook payload shape).
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
