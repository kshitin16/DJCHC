# Environment Inventory

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: every unit's `infrastructure-design/infrastructure-specification.md`; `operation/deployment-pipeline/cd-config.md`; `operation/deployment-pipeline/deployment-strategy.md`.
- Verified directly against the source: `amplify/data/resource.ts`, `amplify/auth/resource.ts`, `amplify/storage/resource.ts`, `amplify/functions/*/resource.ts`.
- [Q1] PITR on every table + S3 versioning, noncurrent expiry 90 days. [Q2] AWS-managed keys. [Q3] Two alert budgets, Cost Anomaly Detection, and one action-enabled budget.
- Rules: project.md § Mandated (encryption at rest and in transit); org.md § Deployment.

## Status: nothing is provisioned

No AWS credentials exist on the build machine — no `~/.aws`, no `AWS_ACCESS_KEY_ID`
or `AWS_PROFILE`, and no AWS CLI installed. Nothing below has been created, and no
check in `validation-report.md` has been run.

This is an inventory of what must exist and how to confirm each piece, not a record
of what does exist. Every status reads `Not provisioned`.

## Environment

One permanent environment (deployment-pipeline Q1), region **`ap-south-1`**
(Mumbai), deployed by Amplify Hosting from the `main` branch. Plus ephemeral
`ampx sandbox` environments on the builder's machine.

Note that `AWS_REGION` in the shell is currently `us-east-1`, inherited from the
framework's own settings. It governs the framework's Bedrock calls, not this
application. Amplify's region is set when the Amplify app is created, and that is
where `ap-south-1` must be chosen — getting it wrong there means every resource
below lands on the wrong continent from its users.

## Identity (Cognito)

| Resource | Configuration | Status |
|---|---|---|
| User Pool | Email sign-in; self-sign-up disabled; Google as external provider | Not provisioned |
| User Pool Client | Public client, no secret; token lifetimes set by `amplify/auth/token-policy.ts` | Not provisioned |
| Group `Admin` | The allowlist gate; membership is the authorization boundary | Not provisioned |
| Identity Pool | Guest (unauthenticated) and authenticated roles | Not provisioned |
| Hosted UI domain | Needed for the Google OAuth redirect | Not provisioned |

Encryption: Cognito encrypts at rest by AWS default (Q2). Nothing to configure.

**The gate that matters here**: `Admin` group membership is what separates an
administrator from a worshipper. It is enforced server-side in the data schema's
authorization rules, not by the app hiding a screen. Adding the first member is a
manual console step after the pool exists, and until someone is in it, no
administrative action is possible by anyone.

## Data (DynamoDB — seven tables)

Amplify creates one table per model in `amplify/data/resource.ts`:

| Table | Holds | Personal data? | PITR (Q1) |
|---|---|---|---|
| `Donation` | Donation records and their payment state | Yes — amounts, donor identity | Required |
| `Post` | Feed posts and events | No | Required |
| `Reminder` | Per-user event reminders | Yes — links a user to an event | Required |
| `DeviceToken` | Push tokens per device | Yes — a device identifier | Required |
| `Document` | PDF library metadata | No | Required |
| `Suggestion` | Suggestion-box submissions | Yes — free text, possibly sensitive | Required |
| `SuggestionDailyCount` | Per-user daily rate-limit counters | Yes — indirectly | Required |

Five secondary indexes are declared across these models, including the
`ownerIndex` GSIs added during Code Generation. Each is created with its table.

**Point-in-time recovery on all seven** (Q1). Not a default — it must be enabled
explicitly, per table, and it is the only thing standing between a bad write and
permanent loss. On a dataset this size the cost is cents per month.

Encryption at rest: AWS-owned keys by default (Q2), satisfying the project's
encryption Mandate. In transit: TLS on every AppSync and SDK call, not optional.

**A note on the Suggestion table.** Free-text submissions from community members
are the least predictable personal data here — people write what they want,
including things they would not want attributed to them. It carries the same
protection as the donation records, which is the right call.

## Storage (S3)

| Resource | Configuration | Status |
|---|---|---|
| Bucket `sarovar-jinalaya-documents` | PDF library; access governed by the storage access rules | Not provisioned |
| ~~Versioning (Q1)~~ **Superseded — see below** | ~~Enabled — a replaced or deleted PDF stays recoverable~~ | **Deliberately off** |
| ~~Lifecycle rule (Q1)~~ **Superseded — see below** | ~~Expire noncurrent versions after 90 days~~ | **Not applicable without versioning** |
| Lifecycle rule (actual) | Abort incomplete multipart uploads after 7 days | **Provisioned** |

Encryption at rest: SSE-S3 by default (Q2). Public access: blocked by default and
must stay blocked — these documents are served to signed-in and guest users through
the application's own access rules, never by making the bucket public.

### Q1's versioning answer contradicted BR6.4, and BR6.4 won

**Amended 2026-10-01, after the first real deployment.**

This document originally recorded S3 versioning as Required, on the strength of
the Q1 answer at this stage — "a replaced or deleted PDF stays recoverable".
That is in direct conflict with **BR6.4**, approved at Functional Design and
implemented in `amplify/storage/resource.ts` as `versioned: false`:

> Deleting a document is a hard delete — both the Document record and its S3
> file are removed; **nothing is retained**.

Versioning does not delete an object; it hides it as a noncurrent version. A
"deleted" PDF would have remained readable to anyone with console access for 90
days. The two decisions cannot both hold, and the conflict was not surfaced when
Q1 was asked — this stage's own fault, not the builder's.

**Resolved in favour of BR6.4**: versioning stays off. The builder's reasoning
is that a document removed from a temple's religious library should actually be
gone — a text uploaded in error, a wrong or disputed version of a scripture, or
something a community member objected to. "Deleted but quietly retained" is a
different promise to make to a community than the one BR6.4 makes.

**The cost of that choice, stated plainly**: an admin who deletes the wrong
document has no recovery path. The file is gone and must be re-uploaded from an
original. There is no undo, and nothing in the system will warn them.

Note this does NOT weaken the DynamoDB side. Point-in-time recovery is enabled
on all seven tables, including `Document`, so the library's *metadata* is
recoverable. Only the S3 object itself is not — which is exactly the asymmetry
BR6.4 describes, since BR6.4 removes the file first and the record second.

## Compute (Lambda — eleven functions)

| Function | Role |
|---|---|
| `feed-api` | Feed reads, including the paginated admin listing |
| `donation-api` | Donation initiation and queries |
| `donation-webhook` | Receives the aggregator's callback |
| `donation-reconciler` | Settles outcomes against the aggregator's own record |
| `reminder-api` | Reminder registration and queries |
| `reminder-stream-handler` | Reacts to reminder table changes |
| `deliver-push` | Sends push notifications via FCM |
| `document-api` | PDF library listing and access |
| `submit-suggestion` | Suggestion submission with the per-user daily cap |
| `all-suggestions` | Administrative suggestion listing |
| `auto-clear` | Scheduled cleanup |

Plus three shared non-deployed modules (`donation-shared`, `reminder-shared`,
`suggestion-shared`) compiled into their callers.

Each gets an execution role scoped during Infrastructure Design, including the
narrowing of the over-broad `appsync:GraphQL` grant found in Code Generation.

## Scheduling (EventBridge Scheduler)

A schedule group for reminder delivery and the auto-clear job. Free tier covers
14 million invocations a month; this app will use a tiny fraction.

## Secrets — and a correction

Five secrets, all referenced through Amplify's `secret()` helper:

| Secret | Used by |
|---|---|
| `GOOGLE_CLIENT_ID` | `amplify/auth/resource.ts` |
| `GOOGLE_CLIENT_SECRET` | `amplify/auth/resource.ts` |
| `DONATION_AGGREGATOR_API_KEY` | `donation-reconciler` |
| `DONATION_AGGREGATOR_WEBHOOK_SECRET` | `donation-webhook` |
| `REMINDER_FCM_SERVICE_ACCOUNT` | `deliver-push` |

**The Infrastructure Design documents describe these as living in AWS Secrets
Manager. That is not what the code does, and the difference is money.** No unit
imports the Secrets Manager SDK; every one of the five goes through Amplify's
`secret()`. AWS's Amplify Gen2 documentation states that these are stored as
encrypted SSM Parameter Store key-value pairs under the `/amplify` prefix.

Standard SSM parameters are free. Secrets Manager charges $0.40 per secret per
month with no free tier — five secrets would be about $24 a year. The
implementation is already the cheaper and equally secure option; only the design
documents are wrong. They are listed for correction in `validation-report.md`.

Set each with `npx ampx sandbox secret set <NAME>` locally, and in the Amplify
Console for the deployed environment.

## Cost guardrails (Q3)

The builder funds this personally as philanthropy and is not asking the temple
committee to contribute. Cost control is therefore a primary requirement here, not
hygiene — so this section is specified more fully than the question proposed.

### Three alert layers

| Layer | Setting | Cost | Catches |
|---|---|---|---|
| Tripwire budget | Monthly cost budget at a low fixed figure (suggested $20) | Free | Anything abnormal, early |
| Target budget | Monthly budget at a chosen figure, alerting at 80% and 100% | Free | Gradual drift toward the ceiling |
| Cost Anomaly Detection | AWS-wide monitor, email alerts | Free | A sudden spike, within about a day |

AWS Budgets monitoring and notifications are free of charge. Cost Anomaly Detection
is free. The third layer matters most for a runaway: a monthly threshold is only
crossed after the money is spent, while anomaly detection flags an unusual pattern
while it is still happening.

### The hard cap (Q3b)

One **action-enabled budget** — free for the first two. At a threshold the builder
sets, AWS applies a deny policy automatically rather than only sending an email.

Scope it to deny the *creation* of new resources, not to break the running
application. The app continues to serve reads and writes; what stops is new spend.
An action that cuts off AppSync or DynamoDB would take the temple's app offline to
save a few rupees, which is the wrong trade.

Set the action threshold above the tripwire alert, so a warning always arrives
before anything is restricted.

### What this architecture actually costs

Everything here is serverless with no idle charge — nothing runs when nobody opens
the app. For a single temple community, the free tiers cover most of it:

| Service | Free tier | Realistic position |
|---|---|---|
| Cognito | 10,000 monthly active users | Comfortably inside |
| Lambda | 1M requests + 400,000 GB-seconds monthly, permanent | Comfortably inside |
| DynamoDB | 25 GB storage | Comfortably inside |
| EventBridge Scheduler | 14M invocations monthly | Comfortably inside |
| SSM Parameter Store (standard) | Free | All five secrets |
| AppSync | 250,000 queries, first 12 months | The first paid line after year one |
| S3 | 5 GB, first 12 months | Depends on the PDF library's size |
| Amplify Hosting | Build minutes, first 12 months | Small |
| CloudWatch Logs | 5 GB ingestion monthly | Depends on log verbosity |

The honest summary: **near zero while the free tiers hold, and single-digit dollars
a month afterwards** — unless something goes wrong. The guardrails above exist for
that case, not for the expected one.

### Where a runaway would actually come from

Not an attack. The realistic causes, in order:

1. **A Lambda retry loop** — a handler failing and being retried can burn invocations and log ingestion fast. The donation reconciler and the push sender are the candidates, since both call external services that can hang.
2. **CloudWatch Logs** — verbose logging at scale is a common surprise bill. Set a retention period (30 days is ample here); logs kept forever cost forever.
3. **A scan over a grown table** — the admin feed listing now paginates, which was fixed during Code Generation, but any future scan-based query is a slow-growing cost.
4. **An EventBridge schedule firing more often than intended** — cheap per invocation, but it triggers Lambdas that are not.

Setting CloudWatch log retention is a one-line change that is not on by default and
is worth doing at provisioning time rather than after the first surprising bill.

## Provisioning order

Each step depends on the one before it:

1. **Install the AWS CLI and configure credentials** — nothing else can begin.
2. **Create the Google Cloud OAuth client** — client ID and secret.
3. **Create the Firebase project** — register `in.sarovarjinalaya.app` for both platforms; download the service account JSON for FCM.
4. **`npx ampx sandbox`** — provisions a full throwaway environment and is where the eight integration checks run. Run **IT-1 first**.
5. **Create the Amplify app** in `ap-south-1`; connect `main`; set the five secrets; let the first deploy run.
6. **Register the Cognito hosted-UI redirect URI** in the Google Cloud Console — the domain only exists after step 5, so sign-in fails until this is done.
7. **Add the first `Admin` group member** — until this exists, nobody can administer anything.
8. **Enable PITR on all seven tables; enable bucket versioning and the 90-day noncurrent lifecycle rule** (Q1).
9. **Set CloudWatch log retention** on every log group.
10. **Create the two alert budgets, Cost Anomaly Detection, and the action-enabled budget** (Q3).

Steps 1–3 need no workflow involvement and block everything after them. Step 4 is
where this project gets its first real verification.

## Confirmation

The decisions in this document were confirmed by the builder at this stage's
summary checkpoint: point-in-time recovery on all seven tables and S3 versioning
with a 90-day noncurrent expiry (Q1); AWS-managed encryption keys (Q2); two alert
budgets, Cost Anomaly Detection, and one action-enabled budget scoped to block new
resource creation only (Q3 and its follow-up). Nothing was provisioned, because no
AWS credentials exist on the build machine.

The builder re-confirmed this same summary, unchanged, when the stage resumed in a
later session. No decision in this document was revised.
