<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-14T11:10:00Z — Identified a real gap in the contracts before generating artifacts: FR7.2's "on by default" can't mean a Reminder is created server-side the instant a Post exists, since Reminder requires a specific device's guest identity. Raised as Q1 rather than silently assuming a mechanism; the human chose lazy per-device creation on sync, which also meant Contract 8 does not need a PostCreated event.
- 2026-09-14T11:10:00Z — Closed three gaps the Contract Design review had disclosed but left open across two prior reviews (Contract 8 idempotency, PostDeleted/cancelReminder terminal-state behavior, missing AsyncAPI notational note) directly in this pass, per Q2, rather than letting them ride a fourth time.

## Deviations
- 2026-09-14T11:10:00Z — Added BR7.11 (push delivery mechanism) beyond the two interview questions, to give FR7.3 a real traceability target — the delivery mechanism was otherwise only implicit in the DeviceToken entity and Register Device Token workflow, not stated as its own rule.

## Tradeoffs
- 2026-09-14T11:10:00Z — Interpreted FR7.6's "auto-clears whether or not acted on" as applying only to SCHEDULED/SNOOZED reminders (never a FIRED one) — a FIRED reminder already delivered its notification and is already terminal, so there's nothing left to "clear." Recorded this as an explicit interpretation note in BR7.4 rather than leaving the state machine ambiguous about whether FIRED also transitions to CLEARED.

## Open questions
- 2026-09-14T11:10:00Z — None — both questions were answered without residual ambiguity.

## Deviations (iteration 1 fixes)
- 2026-09-14T11:40:00Z — Iteration 1 review (NOT-READY, 2 Critical + 2 Major + 2 Minor) found: (1) BR7.1's lazy-creation mechanism had no actual contract letting ReminderUnit enumerate Event-type Posts — Domain Design's own component diagram named this as a dependency distinct from Contract 8's change-notice stream, but it was never realized in any contract. Fixed by amending Contract 3 to add ReminderUnit as a second consumer of FeedUnit's existing public listPosts query (no schema change needed). (2) Contract 9's own Open Questions had explicitly deferred to this stage whether auto-clear is computed or an explicit write, and no workflow resolved it — fixed by making it an explicit write via the same scheduled-compute mechanism that delivers pushes, and asked the human whether FIRED reminders should also eventually clear (they should, per FR7.6's literal wording) — added a new 'Auto-Clear (scheduled sweep)' workflow. (3) BR7.8's reschedule logic no-opped against an already-CLEARED reminder, meaning a Post correctly revived by feed-unit's own BR2.5 could never get a live reminder again on a device that had already cleared one — fixed by widening BR7.8 to also revive CLEARED reminders. (4) Reworded the entities.md snoozeFireAt invariant from a historical predicate to a current-status one, consistent with BR7.8's actual behavior. (5) Added explicit 'Reminder not found' error paths to Snooze/Cancel, distinct from the ownership-refusal case.
