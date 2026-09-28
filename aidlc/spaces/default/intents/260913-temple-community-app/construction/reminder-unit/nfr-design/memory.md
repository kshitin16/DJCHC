<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

## Deviations
- 2026-09-14T16:35:00Z — after the stage-level gate flagged R-04 (Critical, unresolved after 2 review iterations): amended BR7.3/BR7.10's logic fields in functional-design/rules.md so every no-op branch (already-SNOOZED snooze, already-terminal cancel) unconditionally re-issues the corresponding EventBridge Update/DeleteSchedule call before returning, closing the gap where a retry after a partial DynamoDB-succeeded/EventBridge-failed failure never re-synced the schedule.
- 2026-09-14T16:45:00Z — the READY re-review of the above fix surfaced 2 new Major gaps in the fix's own wording: cancelReminder's no-op only re-issued one of its two owned schedules (fire + auto-clear), and snooze-on-already-terminal's no-op incorrectly cross-referenced BR7.10 (which doesn't govern snoozeReminder) for an obligation it doesn't actually have. Fixed both directly rather than letting them ride to the gate as open findings, per this project's own learned practice of closing a review-disclosed gap in the next pass that has enough information to do so.

## Tradeoffs
- 2026-09-14T17:15:00Z — builder's explicit choice, mid-recovery from a redo-jump: simplified BR7.8 (reschedule on Post dateTime change) to a no-op, favoring a simple/flexible reminder module over a 100%-complete one. A date change now surfaces as an additional Reminder on the device's next sync (BR7.1, widened) rather than an in-place reschedule; the old Reminder is left pointing at the stale date. Accepted consequence: a device can transiently hold two Reminders for the same Post, and feed-unit's BR2.5 revival scenario no longer revives a CLEARED Reminder in place.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
