<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-14T04:33:46Z — Consolidated the identity-resolution and admin-authorization checks into two shared-schema contracts (rather than one per consuming Unit) since the claim shape is identical across all consumers — five separate near-duplicate specs would have added no information over one shared spec plus a consumer list.
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-14T04:33:46Z — Used GraphQL-shaped fenced blocks for the five in-system data contracts instead of forcing an OpenAPI wrapper, per the confirmed answer (Q1) that the spec should reflect what Amplify Gen2 actually generates — the stage's own instructions explicitly allow 'any other contract format appropriate to the integration mechanism.'
- 2026-09-14T09:35:00Z — Redo pass introduced this project's first AsyncAPI-shaped contract (Contract 8, FeedUnit->ReminderUnit) rather than forcing a GraphQL shape onto an internal event boundary — an event-driven mechanism (DynamoDB Streams) genuinely doesn't fit the GraphQL request/response shape used everywhere else, and the stage's own instructions name AsyncAPI as the format for event-driven contracts.
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-14T04:33:46Z — Specified the donation-aggregator webhook in full now with a Razorpay-typical placeholder shape, per the confirmed answer (Q3), accepting that the exact payload will need revision once a real aggregator account exists — flagged explicitly in the Open Questions table rather than treated as settled.
- 2026-09-14T09:35:00Z — Closed the two gaps disclosed at Domain Design and Units Generation (Post-deletion cascade, app-wide toggle field) directly in this stage's contracts rather than carrying them forward a third time, since Contract Design is exactly where API/data shapes get pinned down — consistent with the newly-adopted 'resolve open questions directly' practice.
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-09-14T04:33:46Z — None beyond what's already tracked in the artifact's own Open Questions table (webhook payload shape, Cognito claim names to verify at Functional Design time).
- 2026-09-14T09:35:00Z — The exact scheduled-compute mechanism that fires reminders at their target times, and whether FR7.6's auto-clear is computed at read-time or written explicitly, are both deferred to Infrastructure Design/Functional Design — flagged in the artifact's own Open Questions table.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
