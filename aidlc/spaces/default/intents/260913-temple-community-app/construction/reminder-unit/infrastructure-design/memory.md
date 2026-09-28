<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-15T17:05:00Z — Selected Firebase Cloud Messaging as the push provider (deferred to this stage by NFR Design's security-design.md) because it reuses the Firebase project already established for Crashlytics client-side and gives one unified API for both iOS/Android, relaying to APNs automatically rather than a separate direct-APNs integration.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-09-15T17:05:00Z — Implemented deliver-push and auto-clear as two separate Lambda functions rather than one branching on schedule name (both were valid per NFR Design's logical-components.md) — a cleaner IAM boundary per function outweighs the minor duplication.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
