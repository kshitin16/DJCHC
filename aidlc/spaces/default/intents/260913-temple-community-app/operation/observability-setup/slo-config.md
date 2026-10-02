# SLO Configuration

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: all seven units' `nfr-design/performance-design.md` and `reliability-design.md`; `infrastructure-design/monitoring-design.md`; `nfr-requirements/observability-requirements.md`.
- [Q3] Four SLOs with error budgets. [Q1] Four alarms, thresholds set below SLO breach.
- Rules: phases/operation.md § Observability (SLOs quantified with specific percentages and time windows; alerting thresholds set below SLO breach).

## Status: DEFINED, NOT MEASURED

No AWS account exists, so no SLI has ever been computed and no error budget has
ever burned. Every figure below is a target, not an observation.

## A change of posture, stated plainly

Every unit's `monitoring-design.md` records "no formal SLO — best-effort". That
posture is **superseded here** by the builder's answer to Q3. The earlier
decision was not wrong; it was made per unit, at a point where nothing was
deployed and nothing could be measured. This stage asked the question across the
whole system and got a different answer.

What has not changed: there are still no users, so no SLO has anyone depending
on it yet.

## The four SLOs

### SLO-1 — Backend availability

| | |
|---|---|
| **SLI** | Successful AppSync requests ÷ total AppSync requests |
| **Target** | **99.0%** over a **30-day rolling window** |
| **Error budget** | 1.0% — about 7.2 hours of failed requests per 30 days |
| **Measured from** | AppSync CloudWatch metrics `5XXError` and `Request`, via Metrics Math |
| **Continuously measurable?** | **Yes** |

99% rather than 99.9%: the backend is serverless with no idle component to fail,
and the realistic failure mode is a bad deploy rather than infrastructure. A
tighter target would be a number nobody is positioned to defend. Tighten it once
there is a month of real data showing what the system actually does.

Exclude health checks and synthetic traffic from the denominator if either is
ever added.

### SLO-2 — App cold start

| | |
|---|---|
| **SLI** | Proportion of cold starts completing in under 3 seconds |
| **Target** | **95%** (p95 under 3s), per NFR-PERF.1 |
| **Error budget** | 5% of sampled launches |
| **Measured from** | A manual `flutter run --profile` pass with the DevTools timeline, on a mid-range device, from app start to first Feed frame |
| **Continuously measurable?** | **No — sampled once per release** |

### SLO-3 — Screen transition

| | |
|---|---|
| **SLI** | Proportion of screen transitions completing in under 300ms |
| **Target** | **95%** (p95 under 300ms), per NFR-PERF.2 |
| **Error budget** | 5% of sampled transitions |
| **Measured from** | The same manual profile pass, navigating each first-release screen |
| **Continuously measurable?** | **No — sampled once per release** |

### SLO-4 — Push delivery accuracy

| | |
|---|---|
| **SLI** | Proportion of reminder pushes delivered within 2 minutes of their scheduled fire time |
| **Target** | **95%** (p95 within 2 minutes), per NFR-PERF.3 |
| **Error budget** | 5% of deliveries |
| **Measured from** | The `reminder-delivery-delta` custom metric, emitted by `deliver-push`, comparing invocation time against `initialFireAt`/`snoozeFireAt` |
| **Continuously measurable?** | **Yes, once the metric is actually emitted** — the metric is specified in reminder-unit's design but has never run |

## What "error budget" honestly means here

This matters more than the numbers, so it is stated rather than implied.

**Two of these four cannot burn continuously.** SLO-2 and SLO-3 are measured by a
person running a profiling pass on a device before a release. There is no
production instrumentation for either — flutter-app-unit's design explicitly
declines Firebase Performance Monitoring. So their "error budget" is a pass/fail
judgement on a handful of samples taken a few times a year, not a quantity that
depletes as users hit the app.

An SLO that reads as measured but is not is worse than no SLO, because it invites
confidence nothing earned. SLO-2 and SLO-3 are **release-gate checks wearing SLO
clothing**. They are useful as such. They are not a reliability signal.

**SLO-1 is the only one that burns in real time today.** SLO-4 will, once a
reminder has actually been delivered — the metric exists in the design and in no
deployed Lambda.

### If you want SLO-2 and SLO-3 to be real

Add Firebase Performance Monitoring to the app. It would make cold start and
screen transition continuously measured across real devices rather than one
developer's handset. It was declined at Infrastructure Design on cost and
simplicity grounds, and that is still defensible — but the decision is what makes
these two SLOs nominal, and the two facts belong next to each other.

## Error budget policy

| Budget remaining | Status | Action |
|---|---|---|
| Over 50% | Healthy | Ship normally |
| 25–50% | Caution | Check what consumed it before the next deploy |
| Under 25% | At risk | Fix reliability before shipping features |
| Exhausted | Frozen | No feature releases until the budget recovers |

For a solo builder this is not a process to administer — it is a prompt to
notice. The useful version is: if SLO-1's budget is visibly burning, do not ship
a feature that week.

## Burn-rate alerting

**Not configured.** The four alarms in `alarms.md` are static-threshold alarms set
below SLO breach, which is what the operation phase rule requires. Multi-window
multi-burn-rate alerting is the next step up and is disproportionate for a system
with no traffic — it needs a stable request volume to produce meaningful rates.

Revisit alongside anomaly detection, after a few weeks of real usage.

## How to create these

SLOs are not an AWS resource. SLO-1 is computed on the dashboard via Metrics
Math:

```
(m_requests - m_5xx) / m_requests * 100
```

where `m_requests` is AppSync `Request` and `m_5xx` is AppSync `5XXError`, both
summed over the period. SLO-4 uses a percentile statistic on
`reminder-delivery-delta`. SLO-2 and SLO-3 are recorded by hand in the release
checklist.

## When to revisit

- **After 30 days of real traffic** — SLO-1's target was chosen without data. Replace 99.0% with something the measured baseline supports.
- **When real users arrive** — the same trigger that reopens the one-environment and no-staging decisions.
- **If SLO-2 or SLO-3 ever needs to be a real signal** — that requires client-side performance instrumentation, which is a design change, not a configuration one.

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: four SLOs with error budgets (Q3), four alarms with
thresholds below SLO breach (Q1), one cross-cutting dashboard (Q4).
