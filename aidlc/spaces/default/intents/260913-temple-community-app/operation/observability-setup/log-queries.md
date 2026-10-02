# Log Queries and Retention

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: all seven units' `nfr-requirements/observability-requirements.md` (NFR-OBS.2) and `infrastructure-design/monitoring-design.md`; `operation/environment-provisioning/validation-report.md` (check C-5).
- [Q2] 30-day retention on every log group except the two donation Lambdas at 90 days.
- Rules: phases/operation.md § Observability; project.md § Mandated (encrypt personal data at rest and in transit).

## Status: NOT CREATED

No AWS account exists. No log group has been created and no query has been run.

## Retention — and an amendment to NFR-OBS.2

### The conflict this stage found

NFR-OBS.2 specifies retention **per log level**: 30 days for INFO and WARN, 90
days for ERROR, with donation-unit at 90 days throughout as financial activity.

CloudWatch Logs sets retention **per log group**. A Lambda writes every level to
one group, so "30 days for INFO, 90 days for ERROR" in the same function cannot
be configured. The requirement could not be implemented as written, and
implementing half of it silently would have left a requirement that reads
satisfied and is not.

### The resolution (Q2)

| Log group | Retention | Why |
|---|---|---|
| `/aws/lambda/donation-webhook` | **90 days** | Financial activity — NFR-OBS.2's donation-unit requirement, honoured in full |
| `/aws/lambda/donation-reconciler` | **90 days** | Same |
| Every other Lambda log group (nine) | **30 days** | The project's general default |
| AppSync log group | **30 days** | Same |

**This narrows NFR-OBS.2.** ERROR lines outside the two donation functions are
now kept 30 days rather than 90. That is a deliberate override chosen with the
trade-off visible, not an oversight — and the upstream requirement is amended
with a supersession note rather than left in silent conflict with this document.

What it buys: less personal data retained. Environment Provisioning raised this
as check C-5 — log context can carry personal data, so retention is a privacy
setting and not only a cost one. Thirty days is a materially smaller window of
exposure across nine functions.

What it costs: an ERROR in, say, `submit-suggestion` two months ago is gone. At
this project's rate of change that is unlikely to matter; if it ever does, the
answer is option C from Q2 — forward ERROR lines to a separate 90-day group.

### Why this is not just about cost

`environment-provisioning/environment-inventory.md` names CloudWatch Logs as one
of the four realistic sources of a runaway bill, and notes that logs kept forever
cost forever. Setting retention at creation time rather than after a surprising
bill is the cheap version of that lesson.

### How to set it

Amplify Gen2's `defineFunction` exposes this through a `logging` block, so it
belongs in code rather than in the console:

```ts
// amplify/functions/<name>/resource.ts
export const fn = defineFunction({
  name: "<name>",
  logging: {
    retention: '1 month',   // '3 months' for donation-webhook and donation-reconciler
  },
});
```

> **Corrected 2026-10-01 during provisioning.** An earlier version of this
> document gave the property as `logRetention: 30`. That is not the Amplify
> Gen2 API and would not compile: the option is `logging.retention`, and its
> type is a string union (`'1 day'`, `'1 week'`, `'1 month'`, `'3 months'`, …),
> not a number of days. The corrected form above is what was actually applied.

Setting it in `resource.ts` rather than by hand is what stops it being drift.
A console-set retention is reverted by the next deploy that recreates the group.

**Applied 2026-10-01** to all eleven function definitions and deployed: `1 month`
everywhere except `donation-webhook` and `donation-reconciler` at `3 months`.
Before this, every log group reported `retentionInDays: None` — logs kept
forever. The gap was found by querying the first deployed sandbox rather than by
reading the design documents.

## Saved queries

CloudWatch Logs Insights queries worth saving in the console so they are one
click away during an incident rather than written under pressure.

### LQ-1 — What is erroring, right now

```
fields @timestamp, @log, @message
| filter level = "ERROR" or @message like /ERROR/
| sort @timestamp desc
| limit 50
```

Run across all log groups. The first query to run when alarm A-1 or A-2 fires.

### LQ-2 — A donation's full history

```
fields @timestamp, @log, level, donationId, payment_id, event, @message
| filter donationId = "DONATION_ID"
| sort @timestamp asc
```

Across `/aws/lambda/donation-webhook` and `/aws/lambda/donation-reconciler`.
Replace `DONATION_ID`. This reconstructs what actually happened to one donation
across both Lambdas — the question that matters when someone says their money
left their account and the app disagrees.

### LQ-3 — Reminder schedule sync trail

```
fields @timestamp, level, postId, reminderId, event, @message
| filter ispresent(reminderId) or ispresent(postId)
| sort @timestamp asc
```

reminder-unit's design deliberately logs every EventBridge schedule
create/update/delete with the triggering Post id and affected Reminder id,
precisely because there is no automated reconciliation job. This query is that
design's payoff: it is the only way to find a schedule left out of sync.

### LQ-4 — Admin actions audit

```
fields @timestamp, @message
| filter @message like /createPost|updatePost|deletePost|confirmDocumentUpload|deleteDocument/
| sort @timestamp desc
| limit 100
```

Across the AppSync log group. Who changed what, when. NFR-OBS.2 requires this to
be logged; this is how it gets read.

### LQ-5 — Cold start impact

```
filter @type = "REPORT"
| stats count() as invocations,
        avg(@duration) as avgDuration,
        avg(@initDuration) as avgColdStart,
        max(@initDuration) as worstColdStart
        by bin(1h)
```

`project.md` records that at this scale cold start, not throughput, is the
dominant performance risk, and that cold-start samples should be reported
separately from warm ones. `@initDuration` is present only on cold invocations,
so this query separates them by construction.

### LQ-6 — Suggestion rate-limit refusals

```
fields @timestamp, @message
| filter @message like /daily cap|300-word|refused/
| stats count() by bin(1d)
```

On `/aws/lambda/submit-suggestion`. A sudden rise means either abuse or a limit
set too low for how people actually use the suggestion box.

### LQ-7 — Non-admin attempting an admin action

```
fields @timestamp, @message
| filter @message like /Unauthorized|non-admin|BR2.3|forbidden/
| sort @timestamp desc
```

The admin allowlist is this project's only privilege boundary, and
`deployment-execution/smoke-test-results.md` records that it reaches production
unproven. Until a test covers it, **this query is the only evidence that the
boundary is working** — a refusal appearing here is the boundary doing its job.

## What must not be in the logs

`project.md` Mandates that personal data is encrypted at rest and in transit, and
Forbids raw payment details anywhere in the system. Logging is where that gets
accidentally violated, so, explicitly:

| Never log | Where the risk is |
|---|---|
| Suggestion text | `submit-suggestion` — free-text personal content, the most sensitive data in the app |
| Card numbers, UPI handles, UPI PIN | Any donation path. Forbidden outright, not merely discouraged |
| Email addresses or names | Any handler. Log the Cognito subject id instead |
| Tokens, secrets, authorization headers | Any handler |
| Full request or response bodies | Any handler — the most common way the above leaks by accident |

Log identifiers, not content. A `suggestionId` is enough to find the record; the
suggestion's text in a log group is a copy of personal data outside the
encrypted store.

flutter-app-unit's design already applies the same rule to Crashlytics
breadcrumbs — no suggestion text, no donation amount, no email.

## Open items this stage does not close

| Item | Why it is still open |
|---|---|
| ~~`logRetention` not set in any `resource.ts`~~ **Closed 2026-10-01** | ~~A code change to eleven files, not yet made~~ Applied as `logging.retention` to all eleven and deployed |
| No structured-logging conformance check | The designs specify JSON logging with correlation ids; nothing verifies handlers actually do it |
| No automated check that personal data stays out of logs | The rule above is a discipline, not a gate |
| The queries have never been run | No log group exists to run them against |

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: 30-day retention everywhere except the two donation Lambdas
at 90 days (Q2), accepted as a deliberate narrowing of NFR-OBS.2.
