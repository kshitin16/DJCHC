# Performance Measurement Plan

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard; Test Strategy: Standard.
- Consumed: `construction/build-and-test/performance-test-instructions.md` (the method, inherited unchanged); all seven units' `nfr-requirements/performance-requirements.md` and `nfr-design/performance-design.md`; `operation/observability-setup/dashboards.md` and `log-queries.md`; `nfr-validation-matrix.md` (this stage).
- [Q1] Dual budgets. [Q2] 5-10 samples per target. [Q3] Baseline only, informational.
- Rules: project.md § Testing Posture; team.md § Testing Posture.

## Status: NOT EXECUTED

No environment exists. Nothing in this plan has been run.

## Not a load test, deliberately

The stage is named for load testing and this plan is not one. That is a
considered departure, already recorded as a project practice:

> At this project's scale the dominant performance risk is Lambda cold start
> rather than throughput, and a load-testing framework averages cold start away.
> Prefer device-side instrumentation plus CloudWatch duration and InitDuration
> metrics, reporting cold-start samples separately from warm ones.

A k6 run against AppSync would hold environments warm by construction and report
excellent numbers while hiding the one thing that will actually make the app feel
slow to a worshipper opening it on a Sunday morning. Measuring the wrong thing
precisely is worse than measuring the right thing roughly.

**Revisit if the user base passes a few thousand.** At that point concurrency
becomes a real question and k6 against AppSync is the right tool.

## Prerequisites

| # | Prerequisite | State |
|---|---|---|
| 1 | AWS account and credentials | Account exists; AWS CLI 2.37.7 installed; `aws configure` not yet run |
| 2 | A deployed sandbox | Not yet — `npx ampx sandbox` |
| 3 | A real device | **Available** — an iPhone is connected; the Android toolchain is also green |
| 4 | Seeded data at the stated volumes | Not yet |
| 5 | Network throttling | Network Link Conditioner (iOS) or the emulator network profile (Android) |

Prerequisite 3 was a blocker when `performance-test-instructions.md` was written
and is no longer one. Both platforms build; see
`operation/deployment-execution/deployment-log.md`.

## Measurement conditions

Unchanged from the inherited method:

| Condition | Value |
|---|---|
| Network | 4G/LTE profile, throttled |
| Feed — public | ~200 non-aged-out posts |
| Feed — admin | ~500 rows (no age-out filter, so it grows) |
| PDF library | Tens of documents across three fixed categories |
| Reminders | Single-digit existing reminders per device |
| Device | A mid-range handset, not a flagship |

The device choice matters more than it looks. A flagship masks cold start and
render cost; the community will not all be using current-year phones.

## Procedure

### Step 1 — Provision and seed

```bash
aws configure                                  # region ap-south-1
aws sts get-caller-identity                    # confirm the identity
npx ampx sandbox --outputs-format dart --outputs-out-dir lib
```

Then seed: ~200 posts, ~500 admin rows, a handful of documents across the three
categories, a few reminders.

### Step 2 — Point the app at the sandbox

`ampx sandbox` writes the real `lib/amplify_outputs.dart`, replacing the stub.
Confirm it is the sandbox's, not a stale file — an outputs file pointing at the
wrong backend is the single way this whole exercise silently measures nothing.

Build a **profile** build, not debug. Debug builds carry assertion and
observatory overhead that makes every number meaningless:

```bash
flutter run --profile
```

### Step 3 — Instrument and sample

Record a timestamp at the service call site and at first frame rendered. Per
target, **5 to 10 samples** (Q2), alternating cold and warm app starts.

**Keep cold and warm separate from the first sample onward.** Do not average
them and do not discard the cold ones. Under this project's dual-budget decision
they are two different numbers answering two different questions, and the cold
one is the one most users will experience.

A sample is "cold" when the Lambda behind it has not been invoked recently
enough to have a live execution environment. The reliable way to force one is to
leave the function idle for 15+ minutes, or to redeploy.

### Step 4 — Server-side targets

`AUTH-NFR1.2` and `DON-PERF.2` come from CloudWatch, not the device.

### Step 5 — Cold start in its own right

Run query LQ-5 from `operation/observability-setup/log-queries.md` after the
sampling session. It separates `@initDuration` by construction, giving the p95
cold-start cost per function. Record it against the diagnostic row in the matrix.

This is the measurement that tells you whether the cold budgets hold and whether
the provisioned-concurrency decision needs reopening.

### Step 6 — Record

Fill in `test-results.md` and the matrix. State the sample count beside every
figure. **Do not call a 5-10 sample figure a p95** — it cannot support the claim.
Record observed values, and say what was observed.

## Suggested order

The first three are worth doing even if the session is cut short:

1. **APP-PERF.1** app cold start — the first thing every user experiences
2. **FEED-NFR1.1** public feed read — the most-used screen, and Lambda-backed
3. **AUTH-NFR1.1** sign-in — the gate to everything else
4. **PDF-PERF.1 / PDF-PERF.2** library list and open
5. Everything else

## Cadence (Q3)

**A baseline at the first sandbox, and that is all that is committed.** The
numbers are informational. Nothing gates on them and the pre-release checklist is
unchanged.

What that accepts: a future change could make the feed materially slower and
nothing would catch it. That is a real consequence of the choice, acceptable now
and worth revisiting at the same moment as the other deferred decisions in this
project — when real users arrive.

Worth re-measuring, voluntarily, after: adding a Lambda to a path that did not
have one, a change to the feed query or its indexes, a Flutter or Amplify major
upgrade, or the first real growth in post volume.

## Cost

Negligible. A sandbox runs for the length of the session and is torn down; the
services are serverless and the volumes are tiny. A few rupees.

**Tear the sandbox down when finished** — `npx ampx sandbox delete`. An orphaned
sandbox is exactly the kind of quiet cost leak the budgets from Environment
Provisioning exist to catch.

## What this plan cannot tell you

| Question | Why not |
|---|---|
| How it behaves under concurrency | Single-device measurement. No concurrency is simulated |
| How it behaves at production data volume over years | Seeded to the 12-month assumption, not beyond |
| Whether p95 holds across devices and networks | One device, one throttle profile, 5-10 samples |
| Whether performance degrades over time | No soak test, and no repeat cadence committed |

None of these is a defect in the plan. They are the boundary of what a
proportionate measurement at this scale can establish, stated so that nobody
later mistakes a green matrix for more assurance than it carries.

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: dual warm and cold-inclusive budgets (Q1); 5-10 samples per
target (Q2); baseline at the first sandbox only, informational, no release gate
(Q3); the plan and matrix produced with every target `Unverified` (Q4).
