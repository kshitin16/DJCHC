# Observability Design — reminder-unit

## Metrics architecture (NFR-OBS.1)

```
CloudWatch metrics: standard AppSync/Lambda built-ins (call count/latency/error rate) for
  every resolver and all three Lambdas (Contract 8 handler, deliver-push, auto-clear).
Delivery metrics (the core signal for NFR-PERF.3's timing target): a custom metric emitted
  from the deliver-push Lambda comparing its own invocation time against the schedule's
  originally-requested fire time (both known at invocation — the schedule payload carries
  the Reminder id, and the Lambda reads the Reminder's current initialFireAt/snoozeFireAt
  to compute the delta) — this directly measures the actual delivery-accuracy distribution
  against the 2-minute p95 target, not a proxy metric.
Business metric: registered-device count and active-Reminder count over time, as custom
  metrics emitted from registerDeviceToken (increment) and the auto-clear/cancel paths
  (decrement from "active"), the same increment/decrement running-total pattern
  established on feed-unit/pdf-library-unit/suggestion-unit.
```

## Structured logging (NFR-OBS.2)

Per NFR Requirements' existing spec — INFO for registration/create/snooze/cancel/toggle, WARN for push delivery failures, ERROR for Contract 8 Lambda processing failures — plus a new log line per schedule create/update/delete (which schedule, for which Reminder, what fire time), so the EventBridge-Reminder sync (reliability-design.md's noted residual risk) is at least traceable after the fact even without an automated reconciliation job.

## Correlation (NFR-OBS.3's lightweight practice, carried forward)

Every EventBridge schedule payload and every log line along the Contract 8 → schedule-update chain carries the triggering Post's `id` and the affected Reminder's `id`, so a single Post edit's downstream effects (reschedule, cascade-cancel) remain traceable across the Contract 8 Lambda's and the schedule-management code's logs — the same lightweight correlation practice NFR Requirements already established, now extended to cover the new EventBridge interactions too.

## Alerting (NFR-OBS.4)

None configured — consistent with this project's default posture.
