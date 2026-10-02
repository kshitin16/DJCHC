# Observability Requirements — donation-unit

> Unit-local IDs (`NFR-OBS.x`) — no inception-level observability NFR exists to derive these from; see traceability.json.

## NFR-OBS.1 — Metrics

- **Business metrics**: total donations initiated, total succeeded, total failed, active RECURRING mandate count — direct signals of adoption for this later-release feature
- **Application metrics**: Initiate Donation latency (NFR-PERF.1), webhook processing latency (NFR-PERF.2), reconciliation-timeout-check invocation count
- **Retention**: standard CloudWatch defaults

## NFR-OBS.2 — Logging

| Log Level | Event | Retention |
|---|---|---|
| INFO | Donation initiated, status transition (PENDING→SUCCEEDED/FAILED, SUCCEEDED→CANCELLED) | 90 days (financial activity — longer than this project's general 30-day default, given the stakes) |
| WARN | Webhook signature verification failure; timeout-driven reconciliation triggered | 90 days |
| ERROR | Reconciliation failure (aggregator record doesn't resolve after the timeout check — see NFR-OBS.4's alert) | 90 days |

No log line ever includes a raw payment credential (there is none to log, per BR5.1) or the full webhook payload verbatim if it could contain sensitive fields beyond `payment_id`/`amount`/`status`.

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

Not applicable at this app's scale — the two request paths this Unit owns (Initiate Donation, webhook reconciliation) are each a single hop to the aggregator, not a multi-service chain that would benefit from distributed tracing.

## NFR-OBS.4 — Alerting

```
Alert: Donation reconciliation failure
SLI: reconciliation-failure count (a Donation still unresolved after BR5.4's timeout-driven check)
Threshold: any occurrence (count > 0) — this is the one alert in this project with a real
notification target, since real money is at stake (Q3, confirmed)
Severity: ticket (next time the builder checks, not a wake-up page — this is still a solo
best-effort app, not a 24/7 operation)
Notification: email/SNS to the builder
Runbook: manually check the aggregator's own dashboard for the payment_id in question
Auto-remediation: none — a human decides the correct resolution
```

This is a deliberate, disclosed exception to this project's otherwise no-alerting posture (established at auth-unit's NFR pass), justified specifically because this is the one Unit where an unresolved failure has a real financial consequence.
