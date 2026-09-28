<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-14T17:50:00Z — designed against Contract 7's own Razorpay-compatible placeholder shape rather than blocking on a real aggregator account; per-environment test/live Secrets Manager separation ensures staging can never move real money, applying the auth-unit review's own lesson (name every secret explicitly) proactively to a Unit with two payment-adjacent secrets rather than waiting for a reviewer to catch the same gap twice.

## Deviations
- 2026-09-14T17:56:00Z — after review flagged R-01/R-02: added a `statusIndex` GSI (status + createdAt) so the reconciliation Lambda can actually discover PENDING Donations, and corrected functional-spec.md's own Payment Status Reconciliation workflow (an upstream defect, not just an infra-design gap) — the webhook's real lookup key is `order_id`→`id` (GetItem), never `payment_id`, which is used only for the idempotency comparison.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
