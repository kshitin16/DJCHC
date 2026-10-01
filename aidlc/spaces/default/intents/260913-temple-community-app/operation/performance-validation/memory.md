<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-10-01T13:54:24Z — build-and-test/performance-test-instructions.md already specifies the measurement method in full, including the project's own learning that a load-testing framework is disproportionate here and would average cold start away. This stage's job is therefore not to design a method but to own the 17 targets, make the matrix real, and settle the one technical question the instructions raise and leave open: seven targets now route through a Lambda the original design assumed would not exist, and the client budgets do not account for cold start.
- 2026-10-01T13:54:24Z — This stage exists because the scope was recomposed at Build and Test specifically to give these targets an owning stage; that recompose is what made their deferral legitimate rather than an orphaned Unverified. Skipping it would reopen that finding, so the trade-off was stated in the question rather than assumed either way.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->
- 2026-10-01T14:29:22Z — The builder answered Q1 by saying they did not understand cold versus warm Lambda execution environments, despite knowing Lambda well. Explained the execution-environment lifecycle concretely with this project's own numbers before re-presenting the question, rather than treating the reply as a choice or pressing for one. The distinction is genuinely non-obvious to someone who has used Lambda without profiling it, and the right answer to Q1 depends entirely on understanding it.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->
- 2026-10-01T14:29:22Z — Q1 chose dual budgets (warm plus a cold-inclusive figure) over provisioned concurrency. Provisioned concurrency is the only option that would have improved the experience rather than describing it, and it was rejected on cost: four or five dollars per function per month at zero traffic would exceed everything else in this architecture combined on a personally funded project. Recorded as a deliberate cost trade, with the condition that should reopen it.
- 2026-10-01T14:29:22Z — Q2 and Q3 chose the lightest options (one 5-10 sample pass, baseline only, no release gate). Consistent with every other choice this builder has made where nobody is yet affected by being wrong. The consequence worth stating is that a p95 from 5-10 samples is not defensible as a p95; the matrix records it as an indicative measurement rather than dressing it up.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
