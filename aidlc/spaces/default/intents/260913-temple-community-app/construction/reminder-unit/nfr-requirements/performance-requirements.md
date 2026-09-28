# Performance Requirements — reminder-unit

## NFR-PERF.1 — View My Reminders (sync, including lazy backfill) latency (Unit-local ID; no inception-level performance NFR names this Unit's request path — see traceability.json)

| Field | Value |
|---|---|
| Metric | Time from calling `myReminders` to receiving the device's up-to-date Reminder set (including any lazy backfill per BR7.1) |
| Target | < 2 seconds |
| Percentile | p95 |
| Load condition | 4G/LTE-equivalent connection; up to ~200 non-aged-out Event posts to enumerate via `listPosts`, against a device with typically single-digit existing Reminders. The ~200-post figure is this Unit's own working assumption about `listPosts`' realistic data volume at this project's scale, consistent with (but not independently verified against, per this review's per-unit scope) feed-unit's own NFR sizing — re-confirm at consolidation if feed-unit's actual figure differs (identified at this stage's review, R-04) |
| Measurement method | Client-side timer from the `myReminders` call to response |

## NFR-PERF.2 — Register Device Token / Set Reminders Enabled / Snooze / Cancel latency

| Field | Value |
|---|---|
| Metric | Time for each single-item mutation to respond |
| Target | < 1 second |
| Percentile | p95 |
| Load condition | Single device, single mutation at a time |
| Measurement method | Client-side timer around each AppSync mutation call |

## NFR-PERF.3 — Push delivery timing accuracy (Q1)

| Field | Value |
|---|---|
| Metric | Time between a Reminder's `initialFireAt`/`snoozeFireAt` and the push notification actually being delivered |
| Target | Within 2 minutes |
| Percentile | p95 |
| Load condition | Whatever scheduled-compute cadence Infrastructure Design selects to satisfy this budget |
| Measurement method | Deferred to Infrastructure Design/Code Generation to instrument (compare scheduled fire time vs. actual push-send timestamp) |

This is the one NFR target in this Unit that constrains a decision not yet made (the scheduled-compute mechanism, deferred per Contract 9's Open Questions) — it is stated here as the target that mechanism must satisfy, not as a claim that any particular mechanism already meets it.

## Out of scope

No throughput target is set for `myReminders`/mutation calls — this app's device count (a few hundred, intermittent use) never approaches a scale where this Unit's own request-handling performance is a bottleneck. Push notification *send* throughput (how many pushes APNs/FCM can accept per second) is bounded by those providers' own limits, far beyond this app's scale.
