# Anomaly Detection Configuration

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: `operation/environment-provisioning/environment-inventory.md` (the cost guardrails decided there); `alarms.md` and `slo-config.md` (this stage); all seven units' `infrastructure-design/monitoring-design.md`.
- [Q5] No CloudWatch metric anomaly detection for now.
- Rules: phases/operation.md § Observability.

## Status: NONE CONFIGURED — a decision, not an omission

**No CloudWatch metric anomaly detection is enabled**, and this stage does not
enable any.

## Two different things called anomaly detection

Keeping these apart matters, because one of them is already decided and the
other is what this document is about.

| | Cost Anomaly Detection | CloudWatch metric anomaly detection |
|---|---|---|
| Watches | AWS spend | A CloudWatch metric |
| Decided at | **Environment Provisioning (Q3)** — enabled | **Here (Q5)** — not enabled |
| Cost | Free | ~$0.30 per metric per month |
| Catches | An unexpected bill | Gradual drift in latency or error rate |

Cost Anomaly Detection is already part of the plan: `environment-inventory.md`
specifies two alert budgets, Cost Anomaly Detection, and one action-enabled
budget scoped to block new resource creation. **None of that changes.** It is
not re-asked here and not overridden.

## Why not metric anomaly detection

Anomaly detection learns what normal looks like and alerts on deviation from it.
It needs a baseline, and a baseline needs traffic.

This application has none. Nothing is deployed, no user has ever signed in, and
when the first ones do the pattern will be a handful of requests a day with no
shape to learn. Anomaly detection against that produces noise, and noise on the
only alert channel that exists would teach the one person operating this system
to ignore it. Alert fatigue degrades incident response faster than a missing
alert does.

The cost is real but secondary — two metrics would be about $7 a year, which on a
personally funded project is not nothing, but is not the deciding factor either.

## What covers the gap meanwhile

Anomaly detection catches **gradual drift**. Static thresholds catch **acute
failure**. The four alarms in `alarms.md` are the second kind, and acute failure
is the realistic risk for a system with no traffic.

| Risk | Covered by |
|---|---|
| A Lambda failing on every invocation | A-1, Lambda errors |
| The API returning errors to every user | A-2, AppSync 5xx |
| Events dropped after exhausting retries | A-3, dead-letter queue depth |
| A reminder that never fires | A-4, EventBridge failed invocations |
| An unexpected bill | Cost Anomaly Detection and the budgets, from Environment Provisioning |
| Latency slowly degrading | **Not covered** — this is the gap |

The last row is the honest cost of this decision. A query that gets gradually
slower as the Post table grows would not trip a static threshold; it would just
get worse. Nothing here will tell you.

What partially substitutes: the dashboard's latency widgets make drift visible
to someone who looks, and SLO-1's error-budget burn would eventually reflect a
degradation severe enough to cause failures. Neither is a substitute for
detection — both require a human to notice.

## When to enable it

Revisit once there is **three to four weeks of real usage** — enough for a
baseline to mean something. At that point the two metrics worth enabling first:

| Metric | Why first |
|---|---|
| `AWS/AppSync` → `Latency` | The clearest early signal of a query degrading as data grows |
| `AWS/Lambda` → `Errors` | A rising error rate below the A-1 threshold of 5 per 5 minutes is invisible today |

Start with a 2-standard-deviation band, which is the usual starting point, and
widen it if it proves noisy.

```bash
aws cloudwatch put-anomaly-detector --region ap-south-1 \
  --namespace AWS/AppSync --metric-name Latency --stat Average \
  --dimensions Name=GraphQLAPIId,Value=<api-id>
```

An anomaly detector only produces alerts when paired with an alarm using the
`ANOMALY_DETECTION_BAND` comparison operator — creating the detector alone
changes nothing.

## The trigger

Same condition as the other deferred decisions in this project — the one
environment, the absent staging tier, the no-burn-rate alerting: **real users
arriving**, not a date.

That consistency is deliberate. Several decisions in this workflow are right
only while nobody depends on the app, and they should all reopen at the same
moment rather than one at a time as each is remembered.

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: no CloudWatch metric anomaly detection for now (Q5), with
the Cost Anomaly Detection decided at Environment Provisioning left unchanged.
