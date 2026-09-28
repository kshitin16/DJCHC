<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-14T05:11:23Z — Surfaced and resolved a real inconsistency between Domain Design (AdminAllowlistEntry as a database table) and Contract Design (cognito:groups claim) as an explicit interview question rather than silently picking one — the human chose native Cognito Groups, which also matches Contract Design's actual claim shape, so AuthUnit ends up with zero owned entities.
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-14T05:11:23Z — entities.md declares an empty entities list rather than omitting the file, since the stage still requires entities.md for a service-kind unit even when the unit genuinely owns no data.
- 2026-09-14T10:15:00Z — Re-review after the backward-jump guard recovery (NOT-READY, 3 Major) found genuine drift that accumulated while this Unit sat untouched during four other units' redo passes: (1) BR1.2/functional-spec's admin-consumer list never picked up SuggestionUnit's addition to Contract 2 — fixed by adding it to both; (2) Contract 2's own shared description in contract-summary.md still narrated the old database-backed AdminAllowlistEntry story that this Unit's Q1 decision (native Cognito Groups) had already superseded, an upstream-drift bug this reviewer caught — fixed by amending Contract 2's description; (3) FR1.3 was marked OK in traceability.json against BR1.1+BR1.2 even though neither rule actually states the public/signed-in split — re-classified as Deferred (cross-cutting, owned by each consuming Unit) per this project's own persisted convention, closing a finding first raised (but left unfixed) at the original Functional Design pass.
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
- 2026-09-14T05:11:23Z — Two business rules (BR1.3 revocation timing, BR1.4 no-first-sign-in-case) have no upstream FR — they arose from this stage's own clarifying questions. Recorded them as reverse N/A entries in traceability.json rather than forcing an artificial FR reference.
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
- 2026-09-14T05:11:23Z — None — all three questions were answered without residual ambiguity.
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
