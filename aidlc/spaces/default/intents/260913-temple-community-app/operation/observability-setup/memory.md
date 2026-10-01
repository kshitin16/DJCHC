<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-10-01T10:43:35Z — Every unit's monitoring-design.md records the same deliberate no-alerting, no-dashboard, no-SLO, no-tracing posture (NFR-OBS.3/NFR-OBS.4), with exactly two exceptions: donation-unit's SNS email on reconciliation failure, and flutter-app-unit's default Crashlytics new-fatal-issue email. This stage's job is therefore to make the specified signals concrete and settle what the design left open, not to invent an observability stack the project deliberately declined.
- 2026-10-01T11:26:18Z — Q1 chose four alarms and Q3 chose SLOs with error budgets, so the alarm thresholds were set below SLO breach per the operation phase rule rather than picked arbitrarily. The two choices interact and designing them independently would have produced alarms unrelated to the thing they are meant to protect.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-10-01T13:34:49Z — Amended NFR-OBS.2 in all six backend units' observability-requirements.md with a dated supersession note recording that the per-level retention split cannot be configured in CloudWatch and what replaced it, rather than leaving six approved requirements in silent conflict with log-queries.md.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-01T11:26:18Z — Q3 chose four SLOs with error budgets, reversing the no-formal-SLO posture every unit recorded. Two of the four (cold start NFR-PERF.1, screen transition NFR-PERF.2) are only measurable by a manual profile run on a device, so their error budgets cannot burn continuously. Stated that plainly in slo-config.md rather than implying all four are tracked, because an SLO that reads as measured but is not is worse than no SLO.
- 2026-10-01T11:26:18Z — Q2 chose 30-day retention everywhere except the two donation Lambdas at 90 days. This NARROWS NFR-OBS.2, which asks for 90 days on ERROR lines generally. Treated as a deliberate override per the project rule that a later more specific answer overrides rather than contradicts, and amended NFR-OBS.2 with a supersession note rather than leaving the two in silent conflict.
- 2026-10-01T13:34:49Z — Wrote tracing-config.md and anomaly-config.md as explicit no-decision records rather than leaving two declared outputs thin. An absent capability nobody wrote down is indistinguishable from one that was forgotten, and both of these were deliberate choices with real reasoning behind them.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
- 2026-10-01T10:43:35Z — NFR-OBS.2 specifies CloudWatch log retention per log LEVEL (30 days INFO/WARN, 90 days ERROR) but CloudWatch sets retention per log GROUP. The requirement cannot be implemented as written. Raised as a question rather than silently picking one, per the project rule about a requirement whose literal wording cannot happen given the mechanism.
