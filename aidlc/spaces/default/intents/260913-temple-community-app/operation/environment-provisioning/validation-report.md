# Infrastructure Validation Report

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Consumed: `environment-inventory.md` (this stage); every unit's `infrastructure-design/infrastructure-specification.md`; `operation/deployment-pipeline/cd-config.md`; `construction/*/nfr-requirements/`.
- [Q1] PITR + versioning. [Q2] AWS-managed keys. [Q3] Two alert budgets, anomaly detection, one action budget.

## Verdict: NOT VALIDATED

No check in this report has been run. There are no AWS credentials on the build
machine, so nothing was provisioned and nothing could be inspected.

Every row below reads `Not run` and carries the command that settles it. None reads
`Pass`. Writing `Pass` for a check that was never executed is how a deployment
inherits a false sense of safety, and this project has enough genuinely unverified
surface already.

## Security posture (DevSecOps perspective)

| # | Check | Expected | Status |
|---|---|---|---|
| S-1 | S3 public access blocked | All four block settings on | Not run |
| S-2 | Bucket policy grants no `Principal: "*"` | No anonymous access | Not run |
| S-3 | Every Lambda role free of `Action: "*"` or `Resource: "*"` | Least privilege, per Infrastructure Design | Not run |
| S-4 | The `appsync:GraphQL` grant is field-scoped | The Code Generation narrowing survived deployment | Not run |
| S-5 | Cognito self-sign-up disabled | `allowAdminCreateUserOnly: true` | Not run |
| S-6 | User Pool Client has no secret | Public client, as designed for a mobile app | Not run |
| S-7 | `Admin` group exists and is enforced server-side | A non-admin is refused by the API, not just by a hidden screen | **PASS — 2026-10-02** |
| S-8 | Secrets resolve from SSM, absent from source | No literal credential anywhere in the repo | Not run |
| S-9 | DynamoDB encryption at rest active | AWS-owned keys (Q2) | Not run |
| S-10 | TLS enforced on all endpoints | No plaintext path | Not run |

> **S-7 PASSED, 2026-10-02 — the first time this boundary has ever been tested.**
>
> Run against the deployed `all-suggestions` Lambda in the sandbox, both
> directions, because a refusal proves nothing unless the permitted case is
> permitted:
>
> | Identity | Result |
> |---|---|
> | `groups: ["Admin"]` | `200`, returns `[]` — allowed |
> | `groups: []` | `SuggestionAuthorizationError: "Only an admin can view all suggestions"` |
>
> `allSuggestions` was chosen deliberately as the target. It is one of the three
> operations that is NOT group-gated at the AppSync layer — Amplify silently
> drops `allow.group('Admin')` for Lambda-backed operations (see
> `amplify/data/resource.ts`) — so `requireAdmin` inside the Lambda is its only
> defence, and it returns every suggestion-box submission in the app. If the
> boundary were going to fail anywhere, it would fail here.
>
> This closes what `team.md` Q5 recorded as a deliberate deferral: the builder
> chose a smoke-level bar for the admin gate at the walking skeleton, with a
> real pass/fail assertion expected later. This is that assertion, and it was
> made against deployed code rather than a mock.
>
> Still not covered: the same check on `listAllPostsForAdmin` and
> `confirmDocumentUpload`, the other two operations in the same position.
> `confirmDocumentUpload` now has a unit test for it; neither has been
> exercised against a deployed environment.

**S-7 is the one to run first among these.** The admin allowlist is the project's
only privilege boundary, and `team.md` records a deliberate choice to hold the
walking skeleton to a smoke-level test here rather than a real pass/fail assertion.
That choice was reasonable at the time and explicitly made. It means this boundary
has never been proven, and a live environment is the first place it can be. Sign in
as a non-admin and attempt an administrative operation; the API must refuse it.

**S-4** matters because it is a fix, not a default. An over-broad `appsync:GraphQL`
grant was found and narrowed during Code Generation. A deployment is where you
confirm the narrowing survived.

## Data protection (Q1)

| # | Check | Expected | Status |
|---|---|---|---|
| D-1 | PITR enabled on all seven tables | `PointInTimeRecoveryStatus: ENABLED` | Not run |
| D-2 | Bucket versioning enabled | `Status: Enabled` | Not run |
| D-3 | Noncurrent version lifecycle rule present | Expiry at 90 days | Not run |
| D-4 | A restore actually works | Restore one table to a timestamp, in a sandbox | Not run |

**D-4 is the check people skip, and it is the one that matters.** A backup that has
never been restored is a belief, not a safeguard. Do it once in a sandbox, where a
mistake costs nothing, so that the first restore is not attempted during a real
incident.

## Compliance posture (Compliance perspective)

The applicable obligation here is India's Digital Personal Data Protection Act,
2023, which governs personal data of people in India. No payment-card obligation
attaches to the application itself, because `project.md` Forbids raw payment
details from ever touching it — all card and UPI handling goes through the
aggregator's own tokenized flow, which keeps PCI-DSS scope with the aggregator.
That exclusion is worth preserving deliberately; the moment the app touches a card
number, it inherits a compliance regime it is not built for.

| # | Check | Expected | Status |
|---|---|---|---|
| C-1 | Personal data encrypted at rest | Satisfied by default (Q2) | Not run |
| C-2 | Personal data encrypted in transit | TLS everywhere | Not run |
| C-3 | Data residency in `ap-south-1` | Personal data of Indian users stays in India | Not run |
| C-4 | No raw payment details stored | No card or UPI field in any table | **Verifiable now — see below** |
| C-5 | CloudWatch log retention set | Logs not kept indefinitely | Not run |
| C-6 | Deletion path for a user's data | Not designed | **Gap** |

**C-3 is why the region choice is a compliance matter and not only a latency one.**
Keeping Indian users' personal data in `ap-south-1` is the simplest posture under
the DPDP Act. Creating the Amplify app in the wrong region is a one-click mistake
that is painful to undo once data exists.

**C-6 is a real gap this stage cannot close.** The DPDP Act gives people the right
to have their personal data erased. Nothing in this system implements it — there is
no account-deletion path, and personal data sits across `Donation`, `Reminder`,
`DeviceToken`, `Suggestion` and `SuggestionDailyCount`. It is not a provisioning
setting; it is an unbuilt feature. Donation records may also carry a retention
obligation that outlives a deletion request, which is exactly the kind of conflict
worth deciding deliberately rather than discovering later. Recorded here as an
open gap for the builder, not asserted as resolved.

**C-5** also has a privacy dimension beyond cost: logs that capture request
context can hold personal data, and keeping them forever extends the retention of
that data by accident.

## Cost guardrails (Q3)

| # | Check | Expected | Status |
|---|---|---|---|
| B-1 | Tripwire budget exists | Monthly, low fixed threshold, email alert | Not run |
| B-2 | Target budget exists | Alerts at 80% and 100% | Not run |
| B-3 | Cost Anomaly Detection monitor active | AWS-wide, email alerts | Not run |
| B-4 | Action-enabled budget configured | Deny policy at threshold, scoped to block new resource creation only | Not run |
| B-5 | The action does not break the running app | Verify the deny policy's scope before arming it | Not run |
| B-6 | CloudWatch log retention set on every group | 30 days | Not run |

**B-5 before B-4 is armed.** An action-enabled budget that denies too broadly would
take the temple's app offline to save a small amount of money. Read the policy's
scope, confirm it blocks creation rather than operation, and only then enable it.

## Upstream corrections needed

Found while verifying this inventory against the source:

| Document | Says | Actually |
|---|---|---|
| `auth-unit/infrastructure-design/cicd-pipeline.md` | Google OAuth credentials in AWS Secrets Manager | Amplify `secret()` → SSM Parameter Store |
| `reminder-unit` infrastructure design | FCM credential in Secrets Manager (`reminder-fcm-service-account`) | Amplify `secret()` → SSM Parameter Store |
| `flutter-app-unit/infrastructure-design/cicd-pipeline.md` | Secrets table lists Secrets Manager for both | Same correction |
| Backend units' `cicd-pipeline.md` | `main` → staging, `production` branch → production | One environment; `main` is production (deployment-pipeline Q1/Q2) |

None changes what gets built. The first three correct a cost claim in the builder's
favour — SSM standard parameters are free, Secrets Manager would have been about
$24 a year. The fourth is a consequence of a decision made after those documents
were written.

## What must be true before the first real deploy

1. AWS credentials available, CLI installed
2. Google OAuth client created
3. Firebase project created, both platforms registered
4. All five secrets set
5. Amplify app created in `ap-south-1` — **confirm the region before proceeding**
6. First `Admin` group member added
7. PITR, versioning, lifecycle rule, log retention enabled
8. Budgets and anomaly detection configured; action budget scope verified before arming
9. Branch protection on `main` — with one environment, an unblocked merge over a red CI run deploys to production

## Standing gaps this stage does not close

| Gap | Owner |
|---|---|
| Accessibility (NFR7) — unbuilt, unowned, no gate | Needs a decision; no stage owns it |
| Personal-data deletion path (C-6) — DPDP right to erasure | A feature, not a setting |
| 25 `Unverified` targets from Build and Test | Most settle at the first sandbox deploy |
| IT-1, signed-in reminder authorization | Predicted to fail; one sandbox sign-in settles it |
| ~~No app build has ever run~~ **Closed 2026-10-01 at Deployment Execution** | ~~Android SDK and Xcode not installed~~ Both platforms now build; the toolchain claim was stale |

### Added 2026-10-01, carried from Incident Response when that stage reported skipped

| Item | Decision |
|---|---|
| Recovery targets for PITR (Q3) | **Two tiers.** Donation records: zero tolerated data loss, restore the same day. Everything else (posts, documents, reminders, suggestions): a few hours of loss tolerable, restore within a few days. This qualifies the PITR decision above, which until now made restore possible without saying how fast or how much loss was acceptable. |
| Sole-operator continuity (Q5) | **Credential escrow plus written continuity notes.** The AWS account recovery details, the Android upload keystore and its password, and the Firebase and Google account recovery paths go somewhere a trusted second person can reach — a sealed envelope with a temple trustee, or a shared vault — together with written notes on what this system is, where everything lives and who to contact. **Not yet done.** Roughly an hour of work; it removes the one genuinely unrecoverable scenario in this project. |
| Incident response procedures | **Deliberately none.** The builder's decision at Incident Response Q1: this is a community application, nothing about it is critical, and a day of unresolved breakage would not matter. No severity tiers, no response-time commitment, no escalation matrix. Recorded as a decision rather than a gap. |

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: point-in-time recovery on all seven tables and S3 versioning
with a 90-day noncurrent expiry (Q1); AWS-managed encryption keys (Q2); two alert
budgets, Cost Anomaly Detection, and one action-enabled budget scoped to block new
resource creation only (Q3 and its follow-up). Nothing was provisioned, because no
AWS credentials exist on the build machine.

The builder re-confirmed this same summary, unchanged, when the stage resumed in a
later session. No check's status was revised; every row still reads `Not run`.
