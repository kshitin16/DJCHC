# Infrastructure Specification — donation-unit

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Serverless — 2 Lambda functions (webhook receiver behind a Function URL; scheduled reconciliation poller) plus AppSync resolvers | Matches NFR Design's chosen architecture (Q1/Q2); this Unit is the first with dedicated compute (nfr-design/logical-components.md). |
| Region | `ap-south-1` (Mumbai) — inherited from auth-unit's Infrastructure Design | One region for the whole project; no per-unit override needed. |
| Networking topology | No VPC — both Lambdas run outside a VPC (no private resource to reach; DynamoDB and Secrets Manager are reached via their public AWS service endpoints, IAM-authenticated) | Avoids VPC cold-start/NAT Gateway cost and complexity for a Lambda that only talks to AWS-managed services and the aggregator's public HTTPS API. |
| Storage strategy | DynamoDB on-demand (`Donation` table), Point-in-Time Recovery (PITR) enabled | PITR fulfills NFR Design's reliability-design.md recommendation, now committed here given the financial-record stakes. |
| Environments | Amplify Hosting git-branch model — inherited from auth-unit's Infrastructure Design (`main` → staging, `production` branch → prod, `ampx sandbox` for local dev) | Same mechanism project-wide; each branch's `Donation` table and both Lambdas are provisioned independently per environment. |
| IaC approach | Amplify Gen2 backend-as-code — the webhook Lambda and reconciliation Lambda are defined under `amplify/functions/donation-webhook/resource.ts` and `amplify/functions/donation-reconciler/resource.ts` | Consistent with this project's fixed backend framework; no separate hand-authored CDK stack. |
| Resource sizing | Both Lambdas: 256MB memory (default-adjacent; no heavy compute), 10s timeout (webhook — must return fast to the aggregator's own retry-sensitive caller), 60s timeout (reconciler — bounded by the aggregator's own status-query API) | Sized to this Unit's actual workload (single-item DynamoDB writes, one outbound HTTPS call) — not over-provisioned. |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| `Donation` DynamoDB table | Database | On-demand capacity, PITR enabled, AWS-managed encryption (NFR4.1). New GSI `statusIndex`: partition key `status`, sort key `createdAt` (corrected at this stage's review, R-01) | Amplify Data-generated; no manual table provisioning beyond declaring the GSI in the Amplify Data schema. The GSI's write cost (one additional index write per Donation create/status-change) is negligible at this project's ~1500-donation/12mo scale. |
| Webhook Lambda (Function URL) | Compute — payment webhook receiver | Function URL auth mode `NONE` (NFR Design Q1), 256MB/10s, IAM role scoped to `GetItem`/`UpdateItem` on `Donation` (by `id`, resolved from the webhook payload's `order_id` — corrected at this stage's review, R-02; NOT a lookup by `payment_id`) | The aggregator calls this URL directly; no API Gateway in front of it. Contract 7's `order_id` correlates 1:1 to `Donation.id`, so this is a direct `GetItem`, not a `Query` — no index needed for this Lambda's own lookup. |
| Reconciliation Lambda | Compute — scheduled poller | EventBridge Scheduler trigger, `rate(1 minute)` recurring schedule, 256MB/60s, IAM role scoped to `Query` on `Donation`'s new `statusIndex` GSI (`status = PENDING`) plus `UpdateItem` on `Donation` by `id`, plus outbound HTTPS to the aggregator's status API | Implements NFR Design Q2's ~1-minute cadence as a concrete schedule expression. Corrected at this stage's review (R-01): the poller has no incoming payload — its whole job is discovering which Donations are currently PENDING, which is only possible via a Query against an index, never a bare `Query` on the base table (whose only key is `id`). The `createdAt` sort key on `statusIndex` lets the Lambda range-query for PENDING Donations older than the expected confirmation window, rather than reconciling every PENDING Donation on every 1-minute tick regardless of age. |
| SNS topic (`donation-reconciliation-alerts`) | Pub/sub — reconciliation-failure alerting | One email subscription, confirmed once via SNS's own confirmation-email flow (Q2) | Recipient is the builder's own primary email — configured as an Infrastructure Provisioning action, never hardcoded into any committed file. |
| Secrets Manager | Secret storage | Two secrets per environment: `donation-aggregator-api-key`, `donation-aggregator-webhook-signing-secret` — TEST-mode values for staging/local, LIVE-mode for production only (Q1) | Referenced by both Lambdas via IAM role, never as a plaintext environment variable or GitHub Actions repo secret. |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Cognito User Pool (Contract 1 identity, Contract 2 admin check — not applicable here) | auth-unit | donation-unit (`initiateDonation`/`cancelDonation`/`myDonations` require Contract 1 signed-in identity; no admin-gated operation in this Unit) | Read-only — donation-unit's AppSync resolvers verify the caller's JWT `sub` claim; no write access to the User Pool. |

No resource in this table is owned by donation-unit and shared outward — the `Donation` table, both Lambdas, the SNS topic, and the Secrets Manager secrets are all exclusively this Unit's own.
