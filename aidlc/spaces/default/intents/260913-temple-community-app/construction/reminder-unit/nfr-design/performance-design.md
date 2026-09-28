# Performance Design — reminder-unit

## Design for NFR-PERF.1 (myReminders sync, <2s p95)

```
Path: AppSync query -> listPosts (Contract 3, feed-unit) enumeration -> for each new Event
  post, create a Reminder row + two EventBridge Scheduler schedules (fire, auto-clear) ->
  return the device's full Reminder set. The listPosts call and the DynamoDB writes are
  the dominant costs; creating an EventBridge schedule is a fast, single API call per
  schedule (typically single-digit milliseconds), not a bottleneck at this app's per-sync
  backfill volume (a handful of new Event posts at most per sync).
```

## Design for NFR-PERF.2 (registerDeviceToken/setRemindersEnabled/snoozeReminder/cancelReminder, <1s p95)

```
snoozeReminder: single DynamoDB write (status, snoozeFireAt) plus one EventBridge
  UpdateSchedule call replacing the fire-schedule's target time — two fast API calls,
  well within budget.
cancelReminder: single DynamoDB write plus two EventBridge DeleteSchedule calls (fire and
  auto-clear schedules) — same latency profile.
registerDeviceToken/setRemindersEnabled: single DynamoDB write, no EventBridge interaction
  (these don't affect any individual Reminder's fire time).
```

## Design for NFR-PERF.3 (push delivery timing, within 2 minutes p95) — the mechanism finally chosen (Q1)

```
EventBridge Scheduler, one-time schedule per Reminder per fire-type (Q1, confirmed):
  - "fire-<Reminder.id>": triggers at initialFireAt (or snoozeFireAt once snoozed) —
    invokes a "deliver-push" Lambda with the Reminder id as payload.
  - "clear-<Reminder.id>": triggers at the Post's dateTime — invokes a "auto-clear" Lambda
    (or the same Lambda, branching on schedule name) with the Reminder id as payload.
EventBridge Scheduler's own accuracy is well within a few seconds of the scheduled time
  under normal operation — comfortably inside the 2-minute p95 budget, with margin to
  spare for Lambda cold-start/queueing delay under this app's negligible concurrent-fire
  volume (a handful of reminders firing on any given day, never a burst).
This is chosen over a polling Lambda (donation-unit's own pattern) specifically because
  the Reminder entity has no GSI on fire-time or status (entities.md) — a polling approach
  would require either a full-table Scan every cycle or a new GSI, whereas EventBridge
  Scheduler needs neither for the deliver-push/auto-clear paths: each schedule's payload
  carries the specific Reminder's `id`, so both Lambdas only ever need a single GetItem,
  never a Scan or a GSI. Corrected at this stage's review (R-02): this "no Scan/GSI
  needed" reasoning applies ONLY to the fire/clear delivery paths above — it does NOT
  apply to the Contract 8 event handler's own lookup, which is a genuinely different
  access pattern designed separately below.
```

## Design for the Contract 8 event handler's postId lookup (corrected at R-02, narrowed to PostDeleted only after BR7.8's simplification)

```
BR7.9 (PostDeleted only — BR7.8/PostDateTimeChanged was simplified to a no-op at this
  stage's later review, per the builder's explicit simplicity-over-completeness choice, and
  needs no lookup of any kind) requires the Contract 8 handler to "look up any Reminder(s)
  for this postId" — a one-to-many lookup (entities.md: multiple devices, multiple
  Reminders, can share one postId) by a non-key attribute. Reminder's only declared key is
  its own `id`; there is no GSI on postId today. This DOES need a new secondary index,
  unlike the fire/clear paths above:

  New GSI on Reminder: partition key `postId`, no sort key needed (the handler always
  wants every Reminder for a given postId, not a range). A Query against this GSI (not a
  Scan — this is exactly the kind of access pattern a GSI exists to make a real Query
  possible) returns all matching Reminders in one low-latency call, then the handler
  cancels (sets status = CANCELLED) each SCHEDULED/SNOOZED one and deletes its EventBridge
  schedules per BR7.9. This GSI is still needed even though BR7.8 no longer uses it —
  PostDeleted is the sole remaining consumer of this access pattern.

  This GSI's write cost (one additional index write per Reminder create/update) is
  negligible at this app's scale (a few Reminder writes per device-sync, never a bulk
  operation) — no capacity-planning concern beyond DynamoDB's own on-demand mode already
  covering it.
```

## Async processing

Both "deliver-push" and "auto-clear" Lambdas are invoked directly by EventBridge Scheduler (not via a queue) — at this app's volume (a handful of fires per day), no batching or queue-based decoupling is needed; each invocation handles exactly one Reminder.
