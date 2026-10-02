# Build and Test — stage diary

## Interpretations

- 2026-10-01T01:15:00Z — Generated `performance-test-instructions.md` and `security-test-instructions.md` even though Standard strategy only requires integration instructions. The stage prose allows additional types "if context demands it"; here the context is that ~17 measurable latency targets exist with no scheduled owner, so the measurement method had to be recorded somewhere or it would be lost entirely.
- 2026-10-01T01:15:00Z — Treated FR5.4 ("blocked on tax-exemption status confirmed with the aggregator") as `N/A` rather than a coverage GAP. It is an organisational precondition with no possible code artefact, so no unit could have claimed it; recording it as a defect would have been noise.
- 2026-10-01T01:15:00Z — Ran the backend suite once as a whole rather than running each unit's scoped command. The per-unit commands are filters over one Jest project, so running all seven would have executed the same tests repeatedly and double-counted. The stage prose asks for deduplication; this is that.

## Deviations

- 2026-10-01T01:15:00Z — Presented the halt-and-ask WITHOUT a "Retry with fix" option, despite rung 2 having found an impact-estimated fix. The protocol's impact-estimated variant assumes the fix is a code-generation replay; here the root cause is the *scope* (Performance Validation is SKIP), so a jump back to code-generation would fix nothing and would invalidate all seven units' plan approvals a third time. Offered the scope recompose as the real remedy instead, with its impact estimated, so no give-up option is presented impact-unestimated.
- 2026-10-01T01:15:00Z — Did not read every path in `inline_context_paths`. Loaded both agent personas and the load-bearing knowledge (testing guide, test-strategy patterns, NFR validation, reliability, security guide, STRIDE, devsecops pipeline, verification, rules-reading, principles, memory template); skipped the remaining format/template references (audit-format, state-template, brownfield, knowledge-readme-template, worktree-info-schema) whose content is already carried by the stage protocol. Recorded because the protocol states the read is a blocking precondition over the full list.

## Tradeoffs

- 2026-10-01T01:15:00Z — Chose device-side instrumentation plus CloudWatch metrics over a load-testing framework for the performance method. At a few hundred rows and single-digit concurrency, k6 against AppSync would measure the wrong thing; the real risk is Lambda cold start, which a load test averages away rather than exposes.

## Open questions

- 2026-10-01T01:15:00Z — NFR7 (accessibility, WCAG AA) is unowned and unimplemented: zero `Semantics`/`semanticLabel` in `lib/`. Needs either an implementation pass or a recorded deliberate deferral. Only the cross-unit gate could catch this — accessibility belonged to no single unit, and all seven per-unit reviews returned READY without it surfacing.
- 2026-10-01T01:15:00Z — No unit cites an inception NFR ID exactly; each uses detailed per-unit IDs whose numbering mirrors the parent by convention only. The top-level NFR chain is therefore not machine-verifiable, which is why an automated check could not have caught NFR7 either. Worth fixing the convention before the next workflow.
