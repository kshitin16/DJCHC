# Observability Requirements — reminder-unit

> Unit-local IDs (`NFR-OBS.x`) — no inception-level observability NFR exists to derive these from; see traceability.json.

## NFR-OBS.1 — Metrics

- **Application metrics**: myReminders call count/latency (split into backfill-triggered vs. not), registerDeviceToken/setRemindersEnabled/snoozeReminder/cancelReminder call counts, Contract 8 Lambda invocation count/latency
- **Delivery metrics**: pushes scheduled vs. pushes actually sent vs. pushes confirmed delivered by APNs/FCM vs. pushes failed (stale token, provider error) — the core signal for NFR-PERF.3's timing target and this Unit's actual feature health
- **Business metric**: registered-device count, active-Reminder count over time
- **Retention**: standard CloudWatch defaults

## NFR-OBS.2 — Logging

| Log Level | Event | Retention |
|---|---|---|
| INFO | Device registered; Reminder created (lazy backfill), snoozed, cancelled; app-wide toggle changed | 30 days |
| WARN | Push delivery failure (invalid/expired token, provider error) — logged, not auto-acted-on (Q2, confirmed) | 30 days |
| ERROR | Contract 8 Lambda processing failure (before Streams' own retry); unexpected query/mutation failure | 90 days |

> **Amended 2026-10-01 at Observability Setup.** CloudWatch Logs sets retention
> per log GROUP, not per log level, so the per-level split above cannot be
> configured as written. Resolved at that stage (Q2): **30 days on every log
> group except `donation-webhook` and `donation-reconciler`, which are 90 days.**
> ERROR lines outside the two donation functions are therefore retained 30 days
> rather than 90 — a deliberate narrowing chosen with the trade-off visible, and
> one that reduces how long personal data in log context survives
> (`environment-provisioning/validation-report.md` check C-5). The per-level
> table above remains the record of what was originally asked for. See
> `operation/observability-setup/log-queries.md`.

## NFR-OBS.3 — Tracing

Not applicable at this app's scale for the synchronous request paths (single AppSync-to-DynamoDB hop each). The Contract 8 event chain (FeedUnit write → DynamoDB Streams → Lambda → Reminder update) is the one place a correlation id (e.g. the triggering Post's `id` + `updatedAt`) is worth including in every log line along that chain, so a single Post edit's downstream effects are traceable across the Lambda's logs — a lightweight correlation practice, not full distributed tracing infrastructure.

## NFR-OBS.4 — Alerting

None configured (Q4, confirmed) — consistent with feed-unit's/pdf-library-unit's/suggestion-unit's posture. The one deliberate exception in this project remains donation-unit's reconciliation-failure alert, which does not apply here.
