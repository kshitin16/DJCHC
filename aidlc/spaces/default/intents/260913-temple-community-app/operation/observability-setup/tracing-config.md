# Tracing Configuration

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: all seven units' `nfr-requirements/observability-requirements.md` (NFR-OBS.3) and `infrastructure-design/monitoring-design.md`; `nfr-design/observability-design.md`.
- Settled upstream at NFR Requirements and NFR Design; not re-asked at this stage.
- Rules: phases/operation.md § Observability.

## Status: NO TRACING — a settled decision, not a gap

**AWS X-Ray is not enabled, and this stage does not enable it.** That is the
decision NFR-OBS.3 records for every one of the seven units, affirmed at NFR
Design, and nothing this stage found changes the reasoning.

This document exists to make the decision explicit and reviewable rather than
leave a declared output empty. An absent capability that nobody wrote down looks
identical to one that was forgotten.

## Why there is nothing to trace

Distributed tracing earns its cost when a request crosses several services and
you cannot tell which hop is slow or failing. This system has almost no such
paths.

| Path | Hops | Traceable value |
|---|---|---|
| Feed read | Client → AppSync → DynamoDB | One hop. The AppSync latency metric already says everything a trace would |
| PDF list / open | Client → AppSync or `document-api` → DynamoDB/S3 | One or two hops within a single Lambda invocation |
| Suggestion submit | Client → `submit-suggestion` → DynamoDB (+ one CloudWatch PutMetricData) | Single invocation |
| Sign-in | Client → Cognito → Google | Entirely outside this system's instrumentation; X-Ray cannot see Cognito's federation flow |
| Reminder register | Client → AppSync/`reminder-api` → DynamoDB | One hop |

Each unit's design reached this conclusion independently, and together they are
consistent: there is no request in this application that fans out across
services in a way a trace map would illuminate.

## The two paths that are genuinely multi-step

Two flows do have real sequence, and both are worth naming because they are the
cases where this decision could eventually be wrong.

### Donation reconciliation

`donation-api` → payment aggregator → `donation-webhook` → DynamoDB, with
`donation-reconciler` polling the aggregator separately on a schedule.

This crosses a third-party boundary, which X-Ray cannot see into anyway. What
makes it diagnosable is not a trace but a correlation key: both Lambdas log
`donationId` and `payment_id`, and query LQ-2 in `log-queries.md` reconstructs
the whole history from those.

### Reminder scheduling

Post change → Contract 8 handler → EventBridge Scheduler → `deliver-push` → FCM.

The longest chain in the system, and the one with a known residual risk — the
EventBridge-to-Reminder sync has no automated reconciliation. reminder-unit's
design handles this the same way: every schedule create, update and delete is
logged with the triggering Post id and the affected Reminder id, and query LQ-3
follows the chain.

**Correlation ids are doing the job tracing would do**, at no cost and with no
instrumentation. That is the substance of the NFR-OBS.3 decision, not merely a
cost argument.

## What this costs

X-Ray's free tier is 100,000 traces recorded per month, which this application
would never exceed. So the decision is not really about money — it is about
instrumentation effort and moving parts that would illuminate single-hop
requests.

Enabling X-Ray would mean turning on tracing for AppSync and each of the eleven
Lambdas, adding the SDK, and creating custom subsegments for anything beyond the
automatic AWS SDK instrumentation. That is real work whose output would be trace
maps of one-hop requests.

## The known correlation gap

flutter-app-unit's design records it: **there is no request-id propagation
between the app and the backend.** Amplify's generated client does not surface a
per-request correlation header the app could log, so correlating a client-side
crash with a backend error is done by timestamp and app version.

This is a genuine gap, accepted at this project's scale. X-Ray would not close it
either — it would need the client to generate and send a trace header, which is
an application change rather than a configuration one.

## When to revisit

Enable tracing if any of these becomes true:

- **A service-to-service hop is added** — a Step Function, a queue between two Lambdas, a second API calling the first. The moment a request has a middle, a trace has something to say.
- **A latency problem appears that the metrics cannot locate** — if AppSync p99 rises and the per-function duration metrics do not explain it, a trace would.
- **The donation flow grows** — recurring UPI Autopay subscriptions add retry and state-machine behaviour across invocations, which is harder to follow in logs than a single payment.

Until one of those happens, the correlation ids plus the saved queries in
`log-queries.md` are the better tool for this shape of system.

## Confirmation

Tracing was settled at NFR Requirements and NFR Design and was not re-asked at
this stage's summary checkpoint; the decisions confirmed there were alarms (Q1),
retention (Q2), SLOs (Q3), the dashboard (Q4) and anomaly detection (Q5).
