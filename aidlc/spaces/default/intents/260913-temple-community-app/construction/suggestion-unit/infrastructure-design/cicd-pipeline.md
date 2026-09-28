# CI/CD Pipeline — suggestion-unit

Uses the same project-wide GitHub Actions workflow (team.md Q7) as every other Unit; no dedicated pipeline.

## Pipeline stages (shared workflow, this Unit's relevant parts)

| Stage | What runs | Gate | suggestion-unit relevance |
|---|---|---|---|
| Lint/typecheck | ESLint + `tsc --noEmit` | Blocks merge | Applies to `amplify/data/resource.ts` and both Lambdas' handler code (`submit-suggestion` re-corrected at this stage's review to a Lambda handler; `all-suggestions`). |
| Unit tests | Jest, against `ampx sandbox` | Blocks merge | Covers the `allSuggestions` Lambda's Scan-loop-and-sort logic and the `submitSuggestion` Lambda's 300-word validation, atomic conditional-write rate-limiter logic (BR3.5), and CloudWatch metric emission (re-corrected at this stage's review, R-01: `submitSuggestion` is Lambda-backed, not a JS pipeline resolver, after the pipeline-resolver design was found unachievable across two DynamoDB tables). |
| Integration test | `integration_test` (Flutter) — Submit Suggestion (including the 5/day cap) and My/All Suggestions views, per team.md's affirmed test-type mix | Blocks merge | Exercises the owner-scoped and admin-scoped auth rules end-to-end. |
| Deploy to staging | Amplify Hosting, `main` branch | None (automatic) | Provisions/updates both tables and both Lambdas. |
| Deploy to production | Amplify Hosting, `production` branch, manual promotion | Manual checklist (team.md Q8) | No payment- or auth-specific extra gate applies beyond the standard checklist. |

## Rollback

Amplify Hosting retains prior deployment versions per branch; a bad production promotion rolls back through the same manual gate. Both Lambdas' code is versioned independently of DynamoDB state — a rollback reverts either Lambda's logic without affecting already-stored `Suggestion`/`SuggestionDailyCount` records (BR3.4's permanence means there is no destructive migration to worry about either way).

## Secrets management in CI/CD

No secret exists for this Unit — no third-party integration, no API key.
