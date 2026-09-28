# Monitoring Design — donation-unit

Implements NFR Design's observability-design.md (CloudWatch metrics + custom EMF metrics, structured logging, SNS alerting) at the AWS platform level.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Webhook Lambda invocation count/duration/error rate | Standard Lambda CloudWatch metrics | Error rate alarm not configured (below) — tracked passively | Baseline health of the payment webhook receiver. |
| Reconciliation Lambda invocation count/duration/error rate | Standard Lambda CloudWatch metrics | Same | Baseline health of the scheduled poller. |
| `donations-initiated-count` / `donations-succeeded-count` / `donations-failed-count` | Custom EMF metric, emitted from the respective Lambda/resolver (NFR Design) | None — business visibility, not an alerting signal | Tracks the donation funnel without a separate BI tool. |
| `reconciliation-failures-count` | Custom EMF metric, emitted from the reconciliation Lambda when a Donation exhausts reconciliation attempts unresolved | Alarm-worthy — see Alerts below | The signal that actually matters operationally: a donation stuck in limbo. |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Donation reconciliation failure | Reconciliation Lambda publishes to the `donation-reconciliation-alerts` SNS topic when a PENDING Donation still cannot be resolved after its reconciliation attempts are exhausted | Page-equivalent for a solo builder — a financial record left inconsistent | Email subscription on the SNS topic (the builder's own primary email, per Q2) |

No CloudWatch Alarm is configured for the Lambda error-rate/duration metrics above — the business-logic-triggered SNS alert (not a metric-threshold alarm) is this project's chosen signal for the one failure mode that actually matters (NFR Design's own framing); infrastructure-level Lambda failures big enough to matter would themselves prevent PENDING donations from ever reconciling, surfacing through the same SNS alert.

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| Reconciliation resolution time (PENDING → SUCCEEDED/FAILED) | No formal SLO — best-effort, matching NFR Design's reliability-design.md | N/A |

## Logs & Tracing

**Logging**: Both Lambdas log structured JSON (timestamp, level, donationId, `payment_id` where relevant, event) to CloudWatch Logs, 90-day retention (financial activity, per NFR-OBS.2) set via each Lambda's `logRetention` CDK property (Amplify Gen2's `defineFunction` exposes this).

**Tracing**: Not applicable at this project's scale (NFR-OBS.3) — no X-Ray configured for this Unit's two-Lambda, single-hop-per-call topology.

**Dashboards**: No dedicated CloudWatch dashboard provisioned for this Unit — the custom EMF metrics and SNS alert are the chosen visibility mechanisms at this project's scale.
