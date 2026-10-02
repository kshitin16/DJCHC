# Reliability Design — reminder-unit

## Design for NFR2.1-2.4 (best-effort availability)

```
Resilience pattern: no circuit breaker (unchanged from NFR Requirements) — EventBridge
  Scheduler and Lambda both have their own AWS-managed retry behavior for transient
  failures; no additional design needed.
Failure handling for schedule-sync operations (Q2), corrected at this stage's review
  (R-03) to cover BOTH triggering paths, not just mutation resolvers:

  Mutation-resolver path (snoozeReminder, cancelReminder): if an EventBridge
  Create/Update/DeleteSchedule call fails, the resolver's own error path (existing
  error+retry) applies — the DynamoDB write and the EventBridge call are not wrapped in a
  single atomic transaction, so a resolver-level failure after the DynamoDB write succeeds
  but before the EventBridge update completes could leave a schedule briefly out of sync.
  Corrected at this stage's review (R-04): a bare client retry does NOT self-correct this
  on its own, because BR7.3's/BR7.10's idempotent no-op branches short-circuit before ever
  reaching the EventBridge call — a naive retry would return success without re-syncing the
  schedule. rules.md's BR7.3 and BR7.10 logic fields are corrected accordingly, and further
  tightened at this stage's re-review (R-02/R-03) once the fix's own wording was checked
  against how many schedules each operation actually owns:
  - **snooze-on-already-SNOOZED** (BR7.3): unconditionally re-issues the fire-schedule's
    EventBridge UpdateSchedule call before returning — snooze owns only the fire schedule,
    never the auto-clear schedule (see Auto-clear reliability below), so one call suffices.
  - **cancel-on-already-terminal** (BR7.10): unconditionally re-issues BOTH the fire-schedule
    AND the auto-clear-schedule EventBridge DeleteSchedule calls before returning (R-02:
    an earlier fix wording named only one call, but cancelReminder's non-no-op path already
    deletes both — see performance-design.md's NFR-PERF.2 design — so the no-op re-sync path
    must match).
  - **snooze-on-already-terminal** (BR7.3): a plain no-op with NO EventBridge action (R-03:
    an earlier fix wording incorrectly cross-referenced BR7.10 for an obligation here, but
    snooze is never the operation responsible for cleaning up a terminal Reminder's own
    schedule — that already belongs to whichever path put it in that terminal state:
    self-consumption on FIRED, BR7.4's auto-clear path on CLEARED, or cancelReminder/BR7.10
    itself on CANCELLED).
  Re-issuing the same EventBridge call with the same target on every no-op that does need one
  is itself idempotent from EventBridge's own API semantics (an UpdateSchedule to the same
  time, or a DeleteSchedule on an already-deleted schedule, both succeed as no-ops), so none
  of this closes one gap by opening another.

  Contract 8 event handler path (BR7.9/PostDeleted reactions ONLY — BR7.8/
  PostDateTimeChanged was simplified to a no-op at this stage's later review, per the
  builder's explicit simplicity-over-completeness choice, so the handler no longer takes
  any action, and therefore has no failure mode to design around, for that event type):
  this Lambda is DynamoDB-Streams-triggered, with at-least-once redelivery on failure — a
  materially different retry story than a client-retried mutation. If the handler's
  EventBridge DeleteSchedule call (for BR7.9's cascade-cancel) fails AFTER it has already
  written the Reminder's CANCELLED status to DynamoDB, the stream record's own redelivery
  re-runs the whole handler, including the EventBridge call — safe because BR7.10's
  idempotency (keyed on postId + updatedAt) means the DynamoDB write itself is a no-op on
  redelivery, and re-issuing the same EventBridge DeleteSchedule call is itself idempotent
  (a DeleteSchedule on an already-deleted schedule succeeds as a no-op from EventBridge's
  own API semantics). If the failure instead happens BEFORE the DynamoDB write, the whole
  handler is safely retried from scratch by the same redelivery, with no partial state to
  reconcile.
```

## Data durability

DynamoDB's standard managed replication + NFR4.1 encryption for both tables. EventBridge Scheduler's own schedule definitions are AWS-managed and durable — no additional backup mechanism needed (a lost schedule due to an AWS-side failure is regenerable by re-deriving it from the Reminder's own DynamoDB state, though this project does not build an automated reconciliation job for that at this scale — noted as a residual, low-likelihood gap, not designed around further).

## Auto-clear reliability (BR7.4)

The auto-clear schedule (Q1) fires independently of whether the fire-schedule already fired — both are created at Reminder-creation/reschedule time and are independent EventBridge entities, so a failure in one does not affect the other's own scheduled firing.

> **Decided 2026-10-01 at Incident Response (Q4), then carried here when that
> stage reported skipped.** A failed EventBridge Scheduler invocation is
> retried automatically, bounded by a fixed attempt cap, and alarm A-4 in
> `operation/observability-setup/alarms.md` still fires so the retry is visible
> rather than silent. This is a partial mitigation of the residual
> schedule-sync risk named above: it recovers a transient delivery failure
> without closing the gap that there is no reconciliation job for a schedule
> left out of sync. Not yet implemented.
