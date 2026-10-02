# Observability Setup — Questions

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: all seven units' `infrastructure-design/monitoring-design.md`; `nfr-design/reliability-design.md` and `performance-design.md`; `nfr-requirements/observability-requirements.md` (NFR-OBS.1-4); `infrastructure-design/infrastructure-specification.md`; `operation/deployment-execution/health-check-report.md`.
- Verified against the source: eleven Lambda functions and seven DynamoDB tables in `amplify/**/resource.ts`.
- Rules: phases/operation.md § Observability (SLOs quantified; alert thresholds below SLO breach; every component needs a health metric and an error-rate metric); project.md § Deployment.

## What is already settled and not re-asked

Affirmed at NFR Requirements and NFR Design, carried forward:

- **No X-Ray tracing** (NFR-OBS.3). Every request path is a single hop — client to AppSync to DynamoDB, or one Lambda to one table. There is nothing distributed to trace. `tracing-config.md` records this as a settled decision, not an open question.
- **Default CloudWatch metrics everywhere.** Lambda invocation/duration/error-rate and AppSync resolver call/latency/error-rate arrive free and unconfigured. The operation phase rule requiring a health metric and an error-rate metric per component is satisfied by these.
- **Custom business metrics already specified**: `feed-post-count`, `document-count-by-category`, `suggestion-count`, `registered-device-count`, `active-reminder-count`, `reminder-delivery-delta`, and the donation funnel counters.
- **Two alert channels already exist**: donation-unit's SNS email when a PENDING donation cannot be reconciled, and Firebase Crashlytics' default new-fatal-issue email.
- **Cost Anomaly Detection** was decided at Environment Provisioning (two alert budgets, anomaly detection, one action-enabled budget). That is billing anomaly detection and is not re-asked here. Q5 below is about a different thing — CloudWatch *metric* anomaly detection.

## The posture this stage inherits

Every unit's `monitoring-design.md` records the same decision: **no alarms, no dashboards, no SLOs, no tracing.** That was a considered choice at this project's scale, not an omission.

Deployment Execution then deferred alerting explicitly to this stage: its Q3 chose smoke tests as the entire health signal for the first deploy, on the stated grounds that observability-setup runs next and owns alerting properly. So the question of whether that posture holds is genuinely this stage's to ask, and asking it is not re-opening a settled decision.

## Q1. Does the no-alerting posture hold?

Today, two things would reach you: a donation that cannot be reconciled, and an app crash. Nothing else. A Lambda failing every invocation, the AppSync API returning errors to every user, or a push-delivery job silently dying would all be invisible until someone complains.

That is defensible with no users. It stops being defensible when worshippers depend on the app — and alarms cost nothing until they fire (CloudWatch gives 10 alarms free, and SNS email is free).

- A. Hold the posture — no alarms. Add them when real users arrive. The two existing channels stay as they are.
- B. Add a minimal alarm set now — one alarm on total Lambda errors across all eleven functions, and one on AppSync 5xx. Both to the same SNS email topic the donation alert already uses. Two alarms, inside the free tier, roughly fifteen minutes of setup.
- C. Add B plus a dead-letter-queue depth alarm and an EventBridge failed-invocation alarm, so a reminder that never fires is also visible.
- D. Add C plus a CloudWatch Synthetics canary hitting the AppSync endpoint every five minutes, so an outage is detected without any user traffic. This one does cost — canaries are billed per run, roughly a dollar a month at that frequency.
- X. Other (please specify)

[Answer]: C

## Q2. Log retention is specified in a way CloudWatch cannot implement

NFR-OBS.2 specifies retention **per log level**: 30 days for INFO and WARN, 90 days for ERROR (and 90 days throughout for donation-unit, as financial activity).

CloudWatch Logs sets retention **per log group**, not per level. A single Lambda writes all its levels to one group, so "30 days for INFO, 90 days for ERROR" cannot be configured as written. The requirement needs resolving rather than quietly implementing one half of it.

This also matters beyond cost. Environment Provisioning raised C-5: logs can capture request context, so retention is a privacy setting too. Keeping everything for 90 days extends the retention of personal data by accident.

- A. 90 days on every log group — simplest, satisfies the ERROR requirement everywhere, slightly over-retains INFO and WARN. At this volume the cost difference is cents.
- B. 30 days on every group except the two donation Lambdas at 90 days — satisfies the general default and the financial requirement; ERROR lines elsewhere are kept only 30 days, which is less than NFR-OBS.2 asks.
- C. 30 days on every group, with a metric filter forwarding ERROR lines to a separate 90-day group — honours the requirement exactly, at the cost of a second log group per function and more moving parts.
- X. Other (please specify)

[Answer]: B

## Q3. Service level objectives — declare them, or decline them on the record?

Every unit says "no formal SLO — best-effort". The operation phase rules say SLOs must be quantified with specific percentages and time windows. Those are not in conflict as long as the absence is a recorded decision rather than an oversight — but right now it is neither, because nothing says it out loud.

There are already measurable targets that could become SLOs: app cold start under 3s at p95 (NFR-PERF.1), screen transition under 300ms at p95 (NFR-PERF.2), and push delivery within 2 minutes at p95 (NFR-PERF.3).

- A. Record a deliberate no-SLO posture with a named trigger to revisit — the same shape as the one-environment decision, which is recorded as right-for-now with "real users arrive" as the reopening condition. No error budgets, no burn-rate alerting.
- B. Declare one SLO only — backend availability, measured as successful AppSync requests over total, at 99% over a 30-day rolling window. One number, visible, no error-budget machinery.
- C. Declare SLOs for the three measurable targets above plus availability, with error budgets.
- X. Other (please specify)

Worth knowing: an SLO you do not measure is worse than no SLO, because it reads as a commitment. B is only worth choosing if the number will actually be looked at.

[Answer]: C

## Q4. One dashboard, or none?

Every unit's design says no dedicated dashboard. That was decided per unit — nobody asked whether *one* dashboard across the whole app was worth having.

CloudWatch gives three dashboards free. One page showing Lambda errors, AppSync latency and error rate, DynamoDB throttles and the business counters would be the single place to look after a deploy or when something feels wrong.

- A. One cross-cutting dashboard for the whole application — free, and the only consolidated view that would exist.
- B. No dashboard — the AWS Console's per-service metric views are enough at this scale, and an unmaintained dashboard becomes misleading.
- X. Other (please specify)

[Answer]: A

## Q5. CloudWatch metric anomaly detection?

Distinct from the Cost Anomaly Detection already decided at Environment Provisioning. This one learns a baseline for a metric and alerts on deviation from it.

It is genuinely useful for catching gradual drift that a static threshold misses. It also costs roughly $0.30 per metric per month, and it needs a stable traffic pattern to learn from — which an app with no users does not have.

- A. None for now — there is no traffic to learn a baseline from, so it would produce noise rather than signal. Revisit once there is a few weeks of real usage.
- B. Enable on Lambda error count and AppSync latency — two metrics, under a dollar a month.
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
