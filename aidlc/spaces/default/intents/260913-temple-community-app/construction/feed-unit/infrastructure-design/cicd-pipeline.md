# CI/CD Pipeline — feed-unit

Uses the same project-wide GitHub Actions workflow (team.md Q7) as every other Unit; no dedicated pipeline for this Unit.

## Pipeline stages (shared workflow, this Unit's relevant parts)

| Stage | What runs | Gate | feed-unit relevance |
|---|---|---|---|
| Lint/typecheck | ESLint + `tsc --noEmit` | Blocks merge | Applies to `amplify/data/resource.ts`'s `Post` model definition. |
| Unit tests | Jest, against `ampx sandbox` | Blocks merge | Schema/contract checks confirming the `Post` model and its DynamoDB Streams configuration match Contract 3/8's expected shape. |
| Integration test | `integration_test` (Flutter) — Feed browsing and Admin Post CRUD, per team.md's affirmed test-type mix | Blocks merge | Exercises the public read path and the admin-gated mutation path end-to-end. |
| Deploy to staging | Amplify Hosting, `main` branch | None (automatic) | Provisions/updates the staging `Post` table (including Streams) from `amplify/data/resource.ts`. |
| Deploy to production | Amplify Hosting, `production` branch, manual promotion | Manual checklist (team.md Q8) | No payment- or auth-specific extra gate applies to this Unit beyond the standard checklist. |

## Rollback

Amplify Hosting retains prior deployment versions per branch; a bad production promotion rolls back through the same manual gate. `Post` table schema changes are declarative (Amplify Gen2 reconciles the deployed table to match `amplify/data/resource.ts`) — reverting the source file and redeploying reverts the schema; existing `Post` data is unaffected by a configuration rollback (no destructive migration is part of this Unit's design).

## Secrets management in CI/CD

No secret exists for this Unit — no third-party integration, no API key, no webhook signing secret. The `Post` table's own access is entirely IAM/Cognito-authenticated, requiring no additional credential.
