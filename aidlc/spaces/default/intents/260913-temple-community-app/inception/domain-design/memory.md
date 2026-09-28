<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-14T02:35:10Z — FR4.1 (English+Hindi localization) traces to no single domain component — it's a cross-cutting presentation concern, not business logic any component owns. Marked N/A in traceability.json rather than forcing it onto a component or leaving it as a GAP, following verification.md's status vocabulary.
- 2026-09-14T02:35:10Z — FR5.4 (blocked on tax-exemption confirmation) is an organizational precondition, not a design gap — marked Deferred in traceability.json rather than OK or GAP, since no component design work resolves it.
- 2026-09-14T08:35:00Z — Redo pass (Calendar & Reminders): adopted the AWS platform perspective inline (per this project's own standing practice for inline-mode support agents) to resolve FR7.8's open technical question directly — confirmed Amplify Data's guest/unauthenticated authorization mode is a real mechanism, not a workaround, letting reminders skip sign-in entirely rather than deferring the decision further downstream.
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-14T02:35:10Z — None — followed the stage's four-question interview plus the Step 4 component-boundary option-block mechanism for the two genuine trade-off decisions (admin-allowlist boundary, Post entity shape).
- 2026-09-14T08:35:00Z — Redo pass generated a narrow 3-question interview (component boundary, sign-in resolution, reschedule-on-edit behavior) rather than a full domain re-elicitation, since only one new capability was being added to an already-approved catalogue.
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-14T02:35:10Z — Folded admin-allowlist management into AuthComponent rather than a separate component, per the builder's clarification that it's a backend-only, no-in-app-UI process — a component boundary with nothing on the other side of it (no feature) isn't worth the added complexity for a solo builder.
- 2026-09-14T08:35:00Z — Split ReminderComponent out from FeedComponent rather than folding reminders in, mirroring the same "materially different concern" reasoning already used for SuggestionComponent — a distinct identity model (guest vs. Google-federated) and distinct external dependencies (push delivery, scheduled compute) made the split the obvious call once named explicitly.
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-09-14T02:35:10Z — The exact DynamoDB table name and a ready-to-run CLI command for managing the admin allowlist post-build are deferred to Functional Design/Code Generation, once the real Amplify Data schema exists — flagged explicitly in components.md so it isn't lost.
- 2026-09-14T08:35:00Z — The exact scheduled-compute mechanism that fires reminders at their target times (EventBridge Scheduler vs. DynamoDB TTL+Streams vs. polling Lambda) is explicitly deferred to Infrastructure Design — a cost/ops trade-off outside Domain Design's scope.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
