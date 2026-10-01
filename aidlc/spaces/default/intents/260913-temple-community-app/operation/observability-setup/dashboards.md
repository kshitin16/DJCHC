# Dashboard Configuration

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: all seven units' `infrastructure-design/monitoring-design.md`; `infrastructure-design/infrastructure-specification.md`; `slo-config.md` and `alarms.md` (this stage).
- [Q4] One cross-cutting dashboard. [Q3] Four SLOs, so SLO compliance is on the page.
- Rules: phases/operation.md § Observability.

## Status: NOT CREATED

No AWS account exists. The dashboard below is a specification.

## Why one, when every unit said none

Each unit's `monitoring-design.md` concluded it did not need a dedicated
dashboard, and each was right — a dashboard per unit would be seven pages nobody
opens. But nobody asked whether *one* page across the whole application was worth
having, because no stage before this one looked at all seven units together.

CloudWatch includes three dashboards at no charge. One page is the only
consolidated view this system will have, and it matters more now that there are
four SLOs to watch rather than none.

**Name:** `temple-app` · **Region:** `ap-south-1` · **Cost:** free (under the
three-dashboard allowance)

## Layout

Six rows, read top to bottom, worst news first.

### Row 1 — SLO compliance

The row that answers "is the system meeting its commitments".

| Widget | Metric | Notes |
|---|---|---|
| Backend availability (SLO-1) | Metrics Math: `(requests - errors) / requests * 100` over AppSync `Request` and `5XXError` | Single-value widget with a 99.0% annotation line. The only SLO that burns in real time today |
| Push delivery accuracy (SLO-4) | `reminder-delivery-delta`, p95 | Line widget with a 2-minute annotation. Empty until a reminder has actually been delivered |

SLO-2 (cold start) and SLO-3 (screen transition) are **deliberately absent**.
They are measured by a manual profile run on a device, not by any CloudWatch
metric — putting an empty widget on the page would imply they are tracked when
they are not. See `slo-config.md`.

### Row 2 — Golden signals, backend

| Widget | Metric |
|---|---|
| AppSync request rate | `AWS/AppSync` → `Request`, sum per 5 minutes |
| AppSync latency | `AWS/AppSync` → `Latency`, p50 / p95 / p99 |
| AppSync errors | `4XXError` and `5XXError` on one axis — the gap between them is the difference between authorization working and the system failing |

### Row 3 — Compute health

| Widget | Metric |
|---|---|
| Lambda invocations | `AWS/Lambda` → `Invocations`, summed, split by function |
| Lambda errors | `AWS/Lambda` → `Errors`, summed, split by function, with the A-1 alarm annotation at 5 |
| Lambda duration | `AWS/Lambda` → `Duration`, p95, split by function |
| Cold starts | Logs Insights widget on `@initDuration` — see `log-queries.md` query LQ-5 |

Splitting by function matters: "Lambda errors are up" is not actionable, but
"`donation-webhook` errors are up" is.

Cold start deserves its own widget because `project.md` records it as this
project's dominant performance risk — at this scale cold start, not throughput,
is what users feel.

### Row 4 — Data layer

| Widget | Metric |
|---|---|
| DynamoDB consumed capacity | Read and write units across all seven tables |
| DynamoDB throttles | `ThrottledRequests` — expected to stay flat at zero on on-demand capacity; a non-zero value means something is wrong with an access pattern, not with capacity |
| DynamoDB latency | `SuccessfulRequestLatency`, p95, by table |
| S3 bucket size | Daily storage metric for the documents bucket — the PDF library's growth, and the main driver of S3 cost after the free tier |

### Row 5 — Business counters

The metrics the unit designs specified, on one page for the first time.

| Widget | Metric | Source unit |
|---|---|---|
| Feed posts | `feed-post-count` | feed-unit |
| Documents by category | `document-count-by-category` | pdf-library-unit |
| Suggestions | `suggestion-count` (increment only — BR3.4 means no delete path) | suggestion-unit |
| Registered devices / active reminders | `registered-device-count`, `active-reminder-count` | reminder-unit |
| Donation funnel | `donations-initiated-count`, `donations-succeeded-count`, `donations-failed-count` | donation-unit |

**Every one of these is emitted by application code that has never run.** They
will be empty until the backend is deployed and used. That is expected, not a
defect — but a widget showing nothing is indistinguishable from a widget whose
metric is broken, so when the system first runs, confirm each counter actually
appears.

The donation funnel will stay empty longer than the rest: donations are
flag-gated off (`DONATIONS_ENABLED` is false) pending the payment aggregator
account.

### Row 6 — Alarm state

A single alarm-status widget showing all four alarms from `alarms.md` plus the
donation reconciliation alert. One glance to see whether anything is firing.

## How to create it

The dashboard is one JSON document. Build it in the console first — it is faster
than hand-writing the JSON — then export and commit it so it is reproducible:

```bash
aws cloudwatch get-dashboard --region ap-south-1 --dashboard-name temple-app \
  --query DashboardBody --output text > ops/dashboards/temple-app.json

aws cloudwatch put-dashboard --region ap-south-1 --dashboard-name temple-app \
  --dashboard-body file://ops/dashboards/temple-app.json
```

Committing the exported JSON is what stops the dashboard being console drift —
the same principle `org.md` applies to infrastructure generally. A dashboard
built by clicking and never exported is lost the moment the account changes.

## The honest caveat

A dashboard nobody opens is worse than no dashboard, because it creates an
impression of oversight that nothing backs. This one earns its place only if it
is the page you open after a deploy and when something feels wrong.

If after a few months it has not been opened, delete it. The four alarms are the
part that works without anyone looking.

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: one cross-cutting dashboard (Q4); four SLOs, of which two are
measurable and shown here (Q3); four alarms shown in the alarm-state row (Q1).
