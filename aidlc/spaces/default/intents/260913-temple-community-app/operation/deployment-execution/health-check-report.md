# Health Check Report

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: `operation/deployment-pipeline/rollback-runbook.md`; `operation/deployment-pipeline/deployment-strategy.md`; `operation/environment-provisioning/environment-inventory.md`; `smoke-test-results.md` (this stage).
- [Q3] The smoke tests are the whole health signal; no alarms. [Q4] Straight to `main`.
- Rules: phases/operation.md § Deployment Procedures (rollback steps mandatory), § Observability.

## Status: NOT RUN

Nothing is deployed, so no health check has been performed. This document
defines the health signal and the rollback trigger. Until this stage ran, the
project had a rollback *procedure* but nothing that said when to use it.

## The health signal (Q3)

**The three smoke tests in `smoke-test-results.md` are the entire signal.**

| They | Then |
|---|---|
| All pass | The deploy stands. Nothing further to check. |
| Any one fails | Roll back: redeploy the previous commit. |

No CloudWatch alarms. No dashboards. No error-rate thresholds. Nothing
automated.

### Why that is defensible, and exactly when it stops being

It is defensible today because there are no users. An unnoticed failure affects
nobody, and the cost of noticing late is a few minutes of your own time. Setting
up alarms before anyone depends on the system would be effort spent on a risk
that does not yet exist.

It stops being defensible the moment real worshippers use the app. Then a
failure that the three smoke checks do not touch — a Lambda retry loop, a
donation webhook silently erroring, the push sender timing out — runs
undetected until someone complains. There is no automated path by which you
would learn.

**Observability Setup (4.4) runs next and owns that properly** — metrics, alarms,
and alerting are its deliverables, not this stage's. This is a legitimate
deferral to a scheduled stage rather than a dropped concern, which is the only
reason it is recorded as a posture rather than a gap.

The trigger to revisit is the same one `deployment-strategy.md` names for adding
a staging environment: **real users arriving**.

## Health checks

| # | Check | Expected | How to settle it | Status |
|---|---|---|---|---|
| H-1 | The Amplify build succeeded | Green build in the Amplify Console for the `main` branch | Amplify Console → the app → `main` → build history | Not run |
| H-2 | All backend stacks reached a complete state | No `*_FAILED` or `*_IN_PROGRESS` stack | `aws cloudformation describe-stacks --region ap-south-1 --query "Stacks[].{Name:StackName,Status:StackStatus}" --output table` | Not run |
| H-3 | The AppSync API answers | A GraphQL request returns a response, even an auth error | `aws appsync list-graphql-apis --region ap-south-1` then a signed request to the endpoint | Not run |
| H-4 | All seven DynamoDB tables exist and are ACTIVE | `TableStatus: ACTIVE` on each | `aws dynamodb list-tables --region ap-south-1` | Not run |
| H-5 | All eleven Lambda functions are deployed | Each present, `State: Active` | `aws lambda list-functions --region ap-south-1 --query "Functions[].FunctionName"` | Not run |
| H-6 | The Cognito User Pool exists with the `Admin` group | Pool present; group present | `aws cognito-idp list-user-pools --max-results 10 --region ap-south-1` | Not run |
| H-7 | The S3 bucket exists and is not public | Bucket present, all four public-access blocks on | `aws s3api get-public-access-block --bucket <name>` | Not run |
| H-8 | The three smoke tests pass | `smoke-test-results.md` all green | By hand on a device | Not run |

H-1 through H-7 run from the CLI and need no device, so they can be done the
moment the backend deploys and before the app is built. H-8 needs a device and
is the one that actually decides.

## Rollback trigger

| Condition | Action |
|---|---|
| Any smoke test (SM-1, SM-2, SM-3) fails | Roll back the backend: redeploy the previous commit |
| H-1 red, or H-2 shows a `*_FAILED` stack | Amplify has usually rolled the stack back itself; confirm, then fix forward |
| SM-1 fails *before* deploy step 12 | **Not a rollback.** The OAuth redirect URI is not registered yet. Complete step 12 and retry. |
| IT-1 fails | **Not a rollback.** Build and Test predicts this; it is a known defect to fix forward, not a deploy regression. |

The last two matter. Two of the most likely first-deploy failures are *expected*,
and rolling back on either would be chasing a problem that the rollback does not
fix.

### Rollback procedure

Unchanged from `rollback-runbook.md`:

- **Backend** — redeploy the previous commit. Amplify reconciles the stack back. Minutes.
- **App** — halt the rollout, ship a higher build number. **Devices that already updated cannot be reverted** by either store.

### Abort criteria

With one environment and in-place reconciliation there is no traffic-shifting to
abort mid-flight. The deploy either completes or Amplify fails the stack and
reverts it. The only human decision point is after the deploy, on the smoke
results.

## What this stage does not establish

| Gap | Owner |
|---|---|
| Metrics, dashboards, alarms, alerting | **observability-setup (4.4)** — runs next |
| Incident runbooks and escalation | **incident-response (4.5)** |
| Latency targets measured against a real environment | **performance-validation (4.6)** — added back to scope at Build and Test |
| The admin allowlist boundary proven server-side | Unowned. Offered as a smoke check at Q2 and not selected; see `smoke-test-results.md` |
| Personal-data deletion path (DPDP right to erasure) | Unowned. A feature, not a setting; see `environment-provisioning/validation-report.md` C-6 |
| Accessibility (NFR7) | Unowned, unbuilt, no gate |

The first three have scheduled owners. The last three do not, and the next three
stages will not create one for them.

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: smoke tests as the whole health signal with no alarms (Q3);
straight to `main` with no sandbox rehearsal (Q4); critical-path-only smoke
tests (Q2).
