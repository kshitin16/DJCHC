# Reliability Requirements — reminder-unit

## NFR2.1 — Availability (inherits inception NFR2)

```
SLI: successful myReminders/registerDeviceToken/setRemindersEnabled/snoozeReminder/
cancelReminder calls / total attempts, plus the separate delivery-timing SLI in
performance-requirements.md's NFR-PERF.3
SLO: best-effort, matching Amplify/AWS managed-service availability — no independent SLA (NFR2),
consistent with the rest of this project's posture.
```

## NFR2.2 — Fault tolerance

| Failure | Behavior |
|---|---|
| `myReminders`' backfill enumeration (`listPosts`) fails | Return the device's already-existing Reminders without attempting backfill this time (existing error path in functional-spec.md); retried on the next sync, not treated as a hard failure |
| Contract 8's Lambda processing fails | DynamoDB Streams' own event-source-mapping retry redelivers the record; BR7.10's idempotency makes a retry safe (existing error path) |
| The scheduled-compute mechanism (deferred to Infrastructure Design) fails to fire a Reminder on schedule | Out of this Unit's design control until that mechanism is chosen; NFR-PERF.3's 2-minute accuracy target is the budget that mechanism's own retry/catch-up behavior needs to satisfy |
| APNs/FCM delivery itself fails (stale token, provider outage) | Logged (NFR-OBS.2), no auto-disable of the device's reminders (Q2, confirmed) — the Reminder's own status transitions (FIRED) still occur based on the scheduled-compute mechanism attempting delivery, independent of whether the provider actually accepted it |

## NFR2.3 — Data durability

Reminder and DeviceToken records use DynamoDB's standard managed replication and NFR4's encryption-at-rest. No Unit-specific backup procedure beyond Amplify Data's DynamoDB backing.

## NFR2.4 — Disaster recovery

No RTO/RPO target beyond the project-wide posture (deferred to Infrastructure Design's region choice). A lost Reminder is low-consequence — a device would simply recreate it on its next `myReminders` sync (BR7.1's lazy backfill is inherently self-healing for this case), unlike this project's other Units whose data loss would be more consequential (donation records, suggestions).
