# Infrastructure Specification — suggestion-unit

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | `myPastSuggestions`: plain direct AppSync resolver (simple owner-scoped DynamoDB read). `submitSuggestion`: Lambda-backed resolver (re-corrected at this stage's review — a prior "custom AppSync JS pipeline resolver" design was found unachievable: Amplify Gen2's `a.handler.custom()` binds to exactly one data source per step, and a genuine multi-step pipeline across two tables would need an array of per-data-source handlers with `ctx.stash` data flow, which was never fully specified; a Lambda avoids that whole class of risk and mirrors the already-proven `allSuggestions` pattern). Its workflow (sign-in check — enforced separately by AppSync auth rule before invocation, 300-word validation, an atomic conditional increment on `SuggestionDailyCount`, then a write to `Suggestion`, then a custom CloudWatch metric emission) runs entirely inside one Lambda function with full AWS SDK access. `allSuggestions`: Lambda-backed resolver (Scan-loop-and-sort). | Matches NFR Design's already-fixed decisions on data model and rate-limiting logic. Both `submitSuggestion` and `allSuggestions` need code beyond a plain generated resolver — a single, consistent mechanism (Lambda) for both avoids the added complexity and risk of a JS-pipeline-resolver's data-source constraints; `myPastSuggestions` alone is simple enough for the generated default. |
| Region | `ap-south-1` (Mumbai) — inherited from auth-unit's Infrastructure Design | One region for the whole project. |
| Networking topology | No VPC — both Lambdas talk only to DynamoDB (and, for `submitSuggestion`, CloudWatch) via their public AWS service endpoints | No private resource to reach. |
| Storage strategy | DynamoDB on-demand (`Suggestion` table, permanent per BR3.4; `SuggestionDailyCount` table, TTL-bounded) | Matches NFR Design's already-fixed split. |
| Environments | Amplify Hosting git-branch model — inherited from auth-unit's Infrastructure Design | Each branch's two tables and both Lambdas are provisioned independently per environment. |
| IaC approach | Amplify Gen2 backend-as-code (`amplify/data/resource.ts` for both tables and `myPastSuggestions`' direct resolver; `amplify/functions/submit-suggestion/resource.ts` and `amplify/functions/all-suggestions/resource.ts` for the two Lambda-backed resolvers) | No separate hand-authored CDK stack. |
| Resource sizing | `submitSuggestion` Lambda: 128MB memory, 5s timeout (a single conditional-increment write, a single item write, and one CloudWatch `PutMetricData` call — no Scan, no loop). `allSuggestions` Lambda: 256MB memory, 30s timeout | `submitSuggestion` sized to its genuinely light, single-request workload. `allSuggestions` sized to the ~1500-suggestion, ~3MB-worst-case 12-month ceiling NFR Design already established — comfortably inside budget for a handful of internal Scan pages plus an in-memory sort. |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| `Suggestion` DynamoDB table | Database | On-demand capacity, AWS-managed encryption (NFR4.1) | Amplify Data-generated; permanent records, no TTL (BR3.4). |
| `SuggestionDailyCount` DynamoDB table | Database | On-demand capacity, AWS-managed encryption, TTL attribute `ttl` enabled | Implements NFR Design's rate-limiter cleanup design (`ttl = IST midnight + 48h`). |
| `submitSuggestion` Lambda | Compute — submission resolver (re-corrected at this stage's review) | 128MB/5s, IAM role scoped to `UpdateItem` (conditional) on `SuggestionDailyCount` only, `PutItem` on `Suggestion` only, plus `cloudwatch:PutMetricData` (no resource-level scoping possible for this action — CloudWatch metrics have no ARN to scope to) | Performs the 300-word validation, the atomic conditional increment (BR3.5's per-user daily cap), the `Suggestion` write, and emits the `suggestion-count` custom metric directly via the SDK — all in one invocation, no cross-service round trip beyond what the SDK itself makes. Gated by Contract 1's signed-in-identity auth rule at the AppSync layer in front of it, same trust model as `allSuggestions`. |
| `allSuggestions` Lambda | Compute — admin list resolver | 256MB/30s, IAM role scoped to read-only `Scan` on `Suggestion` only | Gated by Contract 2's `allow: groups` auth rule at the AppSync layer in front of it — the Lambda itself performs no separate authorization check, trusting AppSync's own resolver-level gate. |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Cognito User Pool (Contract 1 identity for `submittedByGoogleId`/`myPastSuggestions`'s owner-scoped auth; Contract 2 admin-group check for `allSuggestions`) | auth-unit | suggestion-unit | Read-only — suggestion-unit's declarative AppSync auth rules read the caller's JWT; no write access to the User Pool. |

No resource in this table is owned by suggestion-unit and shared outward — both tables and both Lambdas are exclusively this Unit's own.
