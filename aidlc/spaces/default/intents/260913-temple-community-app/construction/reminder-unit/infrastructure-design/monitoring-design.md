# Monitoring Design — reminder-unit

Implements NFR Design's observability-design.md (standard AppSync/Lambda CloudWatch metrics, delivery-timing custom metric, business metrics, structured logging with correlation) at the AWS platform level.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| AppSync resolver call count/latency/error rate (registerDeviceToken, setRemindersEnabled) | Standard AppSync CloudWatch metrics | None configured (no alerting, per NFR-OBS.4) | Baseline health of the two remaining direct-resolver operations (myReminders moved to Lambda at this stage's review, R-01). |
| Lambda invocation count/duration/error rate (all six: myReminders, snoozeReminder, cancelReminder, Contract 8 handler, deliver-push, auto-clear) | Standard Lambda CloudWatch metrics | None configured | Baseline health of every compute component (myReminders added at this stage's review, R-01). |
| `reminder-delivery-delta` | Custom metric, emitted from `deliver-push`, comparing invocation time against the Reminder's `initialFireAt`/`snoozeFireAt` | None configured | Directly measures NFR-PERF.3's 2-minute p95 delivery-accuracy target — not a proxy metric. |
| `registered-device-count` / `active-reminder-count` | Custom metrics, incremented from `registerDeviceToken`/Reminder-creation, decremented from the auto-clear/cancel paths | None | Business running-totals, the same increment/decrement pattern established on feed-unit/pdf-library-unit/suggestion-unit. |

## Alerts

None configured — consistent with this project's default posture (NFR-OBS.4).

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| Push delivery timing | No formal SLO — best-effort against the 2-minute p95 design target, matching NFR Design's reliability-design.md | N/A |

## Logs & Tracing

**Logging**: Per NFR-OBS.2's existing spec — INFO for registration/create/snooze/cancel/toggle, WARN for push delivery failures, ERROR for Contract 8 Lambda processing failures — plus a new log line per EventBridge schedule create/update/delete (which schedule, for which Reminder, what fire time), making the EventBridge-Reminder sync traceable even without an automated reconciliation job (reliability-design.md's noted residual risk).

**Correlation**: Every EventBridge schedule payload and every log line along the Contract 8 → schedule-update chain carries the triggering Post's `id` and the affected Reminder's `id` (NFR-OBS.3), so a single Post edit's downstream effects remain traceable across the Contract 8 Lambda's and the schedule-management code's logs.

**Tracing**: Not applicable — no X-Ray configured, consistent with this project's scale and every other Unit's posture.

**Dashboards**: No dedicated dashboard for this Unit.
