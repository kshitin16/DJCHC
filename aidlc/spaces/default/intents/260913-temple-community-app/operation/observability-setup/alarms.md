# Alarm Configuration

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: all seven units' `infrastructure-design/monitoring-design.md`; `nfr-design/reliability-design.md`; `slo-config.md` (this stage); `operation/deployment-execution/health-check-report.md`.
- Verified against the source: eleven Lambda functions in `amplify/functions/*/resource.ts`.
- [Q1] Four alarms. [Q3] Thresholds set below SLO breach.
- Rules: phases/operation.md § Observability (alert on symptoms not causes; thresholds below SLO breach; every component needs a health and an error-rate metric).

## Status: NOT CREATED

No AWS account exists. Nothing below has been created. Each row carries the
command that creates it.

## A change of posture, stated plainly

Every unit's `monitoring-design.md` records "no alerting configured" as a
deliberate decision (NFR-OBS.4), with donation-unit's reconciliation SNS email as
the single exception. Deployment Execution's Q3 then chose smoke tests as the
entire health signal for the first deploy, explicitly on the grounds that this
stage owns alerting and would settle it.

It is settled here: **four alarms**, chosen because the previous posture meant a
Lambda failing on every invocation would have been invisible until a worshipper
complained.

All four are inside the CloudWatch free tier (10 alarms, 1,000 email
notifications per month) and route to the SNS topic the donation alert already
uses. Adding them costs nothing and changes nothing until something breaks.

## Notification routing

One topic, one subscriber. There is one person operating this system, so a
severity ladder with escalation paths would be ceremony.

| | |
|---|---|
| **Topic** | `temple-app-alerts` (reuse `donation-reconciliation-alerts` if preferred — one topic is enough) |
| **Subscriber** | The builder's primary email |
| **Severity** | All four are the same severity: something is wrong, look at it today |

Email is not a pager. Nothing here will wake you at 3am, and at this stage
nothing should.

## The four alarms

### A-1 — Lambda errors across all functions

| | |
|---|---|
| **Metric** | `AWS/Lambda` → `Errors`, summed across all eleven functions |
| **Condition** | Sum ≥ 5 over 5 minutes, 2 of 3 evaluation periods |
| **Treat missing data** | `notBreaching` — no invocations is not a failure |
| **Why this threshold** | SLO-1 allows 1% failure over 30 days. Five errors inside five minutes is far above that rate and is a real fault, not noise. A single error will not fire it. |
| **Status** | **Not created** |

Covers all eleven: `feed-api`, `donation-api`, `donation-webhook`,
`donation-reconciler`, `reminder-api`, `reminder-stream-handler`, `deliver-push`,
`document-api`, `submit-suggestion`, `all-suggestions`, `auto-clear`.

One alarm across all of them rather than eleven alarms is deliberate: eleven
would stay inside the free tier but would mean eleven things to maintain, and the
response to any of them is the same — open the logs.

```bash
aws cloudwatch put-metric-alarm --region ap-south-1 \
  --alarm-name temple-lambda-errors \
  --namespace AWS/Lambda --metric-name Errors --statistic Sum \
  --period 300 --evaluation-periods 3 --datapoints-to-alarm 2 \
  --threshold 5 --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions <sns-topic-arn>
```

### A-2 — AppSync 5xx errors

| | |
|---|---|
| **Metric** | `AWS/AppSync` → `5XXError` for the GraphQL API |
| **Condition** | Sum ≥ 5 over 5 minutes, 2 of 3 evaluation periods |
| **Treat missing data** | `notBreaching` |
| **Why this threshold** | This is the SLO-1 numerator failing. Set below SLO breach: a sustained 5-per-5-minutes rate would exhaust the 30-day error budget long before the window closes, so the alarm fires while the budget is still recoverable. |
| **Status** | **Not created** |

Alarms on 5xx only, not 4xx. A 4xx is the API correctly refusing something — a
non-admin attempting an admin mutation produces one, and that is the system
working.

### A-3 — Dead-letter queue depth

| | |
|---|---|
| **Metric** | `AWS/SQS` → `ApproximateNumberOfMessagesVisible` on each DLQ |
| **Condition** | Maximum ≥ 1 over 5 minutes, 1 evaluation period |
| **Treat missing data** | `notBreaching` |
| **Why this threshold** | A single message in a dead-letter queue is one event that was permanently dropped after exhausting retries. There is no acceptable non-zero level. |
| **Status** | **Not created** |

**Check this applies before creating it.** Amplify Gen2 does not attach a DLQ to
every function automatically. Confirm which of the asynchronous consumers —
`reminder-stream-handler`, `deliver-push`, `donation-webhook` — actually have one
configured, and add DLQs where they are missing. An alarm on a queue that does
not exist silently monitors nothing.

### A-4 — EventBridge Scheduler failed invocations

| | |
|---|---|
| **Metric** | `AWS/Scheduler` → `InvocationAttemptsFailedToBeSentToDeadLetterCount` and `TargetErrorCount` for the reminder schedule group |
| **Condition** | Sum ≥ 1 over 15 minutes, 1 evaluation period |
| **Treat missing data** | `notBreaching` |
| **Why this threshold** | A failed schedule invocation is a reminder that never fired. Nobody will report it — the user simply does not get told about the event they asked to be reminded of. This is the project's most silent failure mode. |
| **Status** | **Not created** |

This one is the strongest argument for the whole set. reminder-unit's reliability
design notes a residual risk: the EventBridge-to-Reminder sync has no automated
reconciliation job, so a schedule left out of sync is detectable only through
logs. A-4 is the one signal that would surface it.

## What deliberately has no alarm

| Not alarmed | Why |
|---|---|
| Lambda duration / cold start | A slow function is not a broken one at this scale, and cold start is expected on a system with no steady traffic |
| DynamoDB throttles | On-demand capacity; throttling is not a realistic failure mode at this volume. Visible on the dashboard |
| Cognito sign-in failures | A failed sign-in is usually a user, not a fault. Alarming would be alert fatigue on day one |
| 4xx responses | The API correctly refusing something. Alarming on these would punish working authorization |
| Cost | Already covered by the budgets and Cost Anomaly Detection decided at Environment Provisioning |
| SLO burn rate | See `slo-config.md` — needs stable traffic to be meaningful |

Alert on symptoms, not causes. Every entry above is a cause or a non-event.

## Existing channels, unchanged

| Channel | Fires when | Decided at |
|---|---|---|
| `donation-reconciliation-alerts` SNS email | A PENDING donation cannot be resolved after reconciliation attempts are exhausted | NFR Design, donation-unit |
| Crashlytics new-fatal-issue email | A never-seen or regressed fatal crash appears in a release build | NFR Design, flutter-app-unit |

Neither is modified here. The donation alert remains the sharpest signal in the
system, because it is the only one tied to money.

## Creation order

1. Create the SNS topic and confirm the email subscription — **an unconfirmed subscription delivers nothing**, and the confirmation email is easy to miss.
2. Create A-1 and A-2. Both work immediately.
3. Confirm which functions have a DLQ; add any that are missing; then create A-3.
4. Create A-4 once the reminder schedule group exists.
5. Verify delivery: put one alarm into `ALARM` state by hand and confirm the email arrives.

Step 5 is the one that is usually skipped and the one that matters. An alarm
whose notification path was never tested is a belief, not a safeguard — the same
reason `environment-provisioning/validation-report.md` insists on actually
restoring a backup once.

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: four alarms (Q1); thresholds set below SLO breach against the
four SLOs (Q3); no metric anomaly detection for now (Q5).
