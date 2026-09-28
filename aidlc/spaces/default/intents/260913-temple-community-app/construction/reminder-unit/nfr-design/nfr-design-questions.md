# NFR Design — Questions (reminder-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/reminder-unit/nfr-requirements/*.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/reminder-unit/functional-design/functional-spec.md`, `entities.md`, `rules.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 3, 8, 9)

This is the stage that finally picks the scheduled-compute mechanism deferred since Contract Design (push firing at `initialFireAt`/`snoozeFireAt`, and the auto-clear sweep at the Post's `dateTime`). The `Reminder` entity has only a single UUID primary key (`id`), no GSI — the same key shape that led suggestion-unit's design into a Query/Scan mistake this stage already caught once; that lesson is applied proactively here rather than repeated.

## Q1. Scheduled-compute mechanism: donation-unit chose a scheduled *polling* Lambda (scan for stale PENDING donations every ~1 minute) for its own reconciliation trigger. Does that same pattern fit this Unit's push-firing/auto-clear need, or does a different mechanism fit better?

- A. EventBridge Scheduler, with a per-Reminder ONE-TIME schedule (not polling) — when a Reminder is created or rescheduled, this Unit creates two individually-named EventBridge Scheduler schedules: one firing at `initialFireAt`/`snoozeFireAt` (delivers the push), one firing at the Post's `dateTime` (BR7.4's auto-clear). Both invoke a Lambda with the Reminder's `id` as payload — no DynamoDB Scan or GSI is ever needed to find "which Reminders are due," since EventBridge itself tracks each schedule's fire time. This fits this Unit's need better than donation-unit's polling pattern because reminders fire at genuinely per-item, precise moments (not "check everything older than N minutes") — donation-unit's simpler bulk-scan approach fits its own "notice anything stale" need, but would require either a full-table Scan every polling cycle or a new GSI on fire-time here, exactly the kind of design gap this stage's earlier review caught on suggestion-unit. (Recommended)
- B. Reuse donation-unit's scheduled polling Lambda pattern here too — specify
- X. Other (please specify)

[Answer]: A. EventBridge Scheduler, per-item one-time schedules.

## Q2. Schedule cleanup: snoozing, cancelling, or a Post-dateTime change (BR7.8) all change or invalidate a Reminder's fire time. How are the EventBridge schedules kept in sync?

- A. Every mutation that changes `initialFireAt`/`snoozeFireAt`/status (snoozeReminder, cancelReminder, the Contract 8 event handler's BR7.8/BR7.9 reactions) updates or deletes the corresponding EventBridge schedule(s) in the same operation: snoozing replaces the fire-schedule with a new one at `snoozeFireAt` (and leaves the auto-clear schedule untouched, since the Post's `dateTime` hasn't changed); cancelling deletes both schedules; a `PostDateTimeChanged` reschedule (BR7.8) updates both schedules to the new times; a `PostDeleted` cascade (BR7.9) deletes both. This keeps EventBridge's own schedule state authoritative and in sync with the Reminder's DynamoDB state at every transition, with no orphaned schedules left firing after a Reminder no longer needs them. (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Every relevant mutation updates/deletes schedules in place.

> **Superseded in part** (post-gate revision, builder's explicit simplicity choice): the
> `PostDateTimeChanged` reschedule (BR7.8) named in this answer no longer happens — BR7.8
> was simplified to a no-op. A Post's dateTime change is instead picked up lazily via
> BR7.1's widened backfill condition on the affected device's next sync (a new Reminder for
> the new date, with the old one left in place, unrescheduled). Every OTHER mutation this
> answer names (snoozing, cancelling, the `PostDeleted` cascade) is unaffected and still
> keeps its schedules in sync exactly as answered above.

## Consolidated Summary Confirmation

- Scheduled compute is EventBridge Scheduler with two per-Reminder one-time schedules (fire, auto-clear) — not a polling Lambda, and not a DynamoDB Scan/GSI-based approach.
- Every Reminder mutation/event handler that changes fire time or status keeps both schedules in sync (update, replace, or delete as appropriate), so no orphaned schedule ever fires for a Reminder that no longer needs it.
- The disclosed push-token-abuse accepted risk (NFR-AUTHZ.2) and BR7.3's re-snooze-of-an-already-SNOOZED-Reminder edge case are addressed directly in this stage's artifacts (a proactive one-line rules.md clarification for BR7.3 — re-snoozing an already-SNOOZED Reminder is an idempotent no-op, since `snoozeFireAt` is always the same fixed 9:00 PM IST time regardless of when snooze is tapped, so there is no actual behavioral difference to design around — and NFR-AUTHZ.2's accepted-risk framing carries forward unchanged).
- Every no-op branch (snooze-on-already-SNOOZED, cancel-on-already-terminal) unconditionally re-issues its owned EventBridge schedule call(s) before returning, so a client retry after a partial DynamoDB-succeeded/EventBridge-failed failure genuinely re-syncs the schedule.
- **Builder's explicit simplicity choice**: BR7.8 (reschedule on Post dateTime change) is simplified to a no-op — a date change is picked up lazily via a widened BR7.1 backfill (an additional Reminder appears on the device's next sync; the old one is left pointing at the stale date, un-rescheduled). This is a deliberate accepted trade-off, not an oversight.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
