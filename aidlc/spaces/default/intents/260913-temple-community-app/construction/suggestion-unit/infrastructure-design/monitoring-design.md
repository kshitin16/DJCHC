# Monitoring Design — suggestion-unit

Implements NFR Design's observability-design.md (standard AppSync/Lambda CloudWatch metrics, custom suggestion-count metric, structured logging) at the AWS platform level.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| AppSync resolver call count/latency/error rate (`myPastSuggestions`) | Standard AppSync CloudWatch metrics | None configured (no alerting, per NFR-OBS.5) | Baseline health of the one remaining direct-resolver operation. |
| `submitSuggestion` Lambda invocation count/duration/error rate | Standard Lambda CloudWatch metrics | None configured | Baseline health of the submission compute (re-corrected at this stage's review — `submitSuggestion` is Lambda-backed, not a direct resolver). |
| `allSuggestions` Lambda invocation count/duration/error rate | Standard Lambda CloudWatch metrics | None configured | Baseline health of the Scan-loop-and-sort compute. |
| `suggestion-count` | Custom CloudWatch metric, emitted directly via `cloudwatch:PutMetricData` from inside the `submitSuggestion` Lambda (re-corrected at this stage's review — a Lambda has full AWS SDK access, unlike an AppSync resolver, so no log-filter workaround is needed). Increment only — BR3.4 means no delete path exists to decrement. | None | The running-total business metric NFR Design established, now backed by a directly achievable AWS mechanism with no intermediate log-parsing step. |

## Alerts

None configured — consistent with this project's default posture.

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| N/A | No formal SLO — best-effort, matching NFR Design's reliability-design.md | N/A |

## Logs & Tracing

**Logging**: Per NFR-OBS.2's existing spec (submitter+timestamp on submit, 5/day cap hits, 300-word-limit refusals) — the `submitSuggestion` Lambda logs this as structured JSON to its own CloudWatch Logs group (re-corrected at this stage's review — no longer AppSync's own resolver logging, since `submitSuggestion` is Lambda-backed); `myPastSuggestions` (still a direct resolver) uses AppSync's own CloudWatch Logs integration; the `allSuggestions` Lambda logs structured JSON to its own CloudWatch Logs group.

**Tracing**: Not applicable (NFR-OBS.3) — each request path is a single hop to DynamoDB (plus, for `submitSuggestion`, one CloudWatch API call), or a small bounded number of sequential hops within the `allSuggestions` Lambda's own invocation.

**Dashboards**: No dedicated dashboard for this Unit.
