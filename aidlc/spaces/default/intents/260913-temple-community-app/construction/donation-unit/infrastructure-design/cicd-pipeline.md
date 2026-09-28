# CI/CD Pipeline — donation-unit

Uses the same project-wide GitHub Actions workflow (team.md Q7) as every other Unit; this document scopes it to donation-unit's own two Lambdas and adds the payment-specific controls this Unit's Mandated rules require.

## Pipeline stages (shared workflow, this Unit's relevant parts)

| Stage | What runs | Gate | donation-unit relevance |
|---|---|---|---|
| Lint/typecheck | ESLint + `tsc --noEmit` | Blocks merge | Applies to both Lambda handlers and `amplify/functions/donation-*/resource.ts`. |
| Unit tests | Jest, against `ampx sandbox` | Blocks merge | Covers the webhook's idempotent-write logic (BR5.5) and the reconciliation Lambda's aggregator-record-check logic (BR5.4) — the two rules this Unit's own Mandated/Forbidden rules exist to protect. |
| Integration test | `integration_test` (donation flow, per team.md's affirmed test-type mix — "and later the donation flow") | Blocks merge | Exercises Initiate Donation → webhook reconciliation end-to-end against `ampx sandbox` with TEST-mode aggregator credentials. |
| Secret scanning | Pre-commit (`gitleaks`/`detect-secrets`) + GitHub's built-in scanning/push protection | Blocks commit / flags PR | Specifically relevant here: the aggregator API key and webhook signing secret are exactly the class of credential this control exists to catch before it's committed. |
| Deploy to staging | Amplify Hosting, `main` branch | None (automatic) | Deploys with TEST-mode aggregator secrets (Q1) — staging can never move real money. |
| Deploy to production | Amplify Hosting, `production` branch, manual promotion | Manual checklist (team.md Q8) PLUS this project's Mandated self-review rule for any change touching payment handling (project.md, Q14 option E) | Both gates apply to every change in this Unit — the checklist's "AWS permissions/auth changes double-checked" item covers this Unit's IAM roles/secrets, and the payment-specific self-review rule applies independently of (in addition to) that checklist. |

## Rollback

Amplify Hosting retains prior deployment versions per branch; a bad production promotion rolls back to the last-known-good commit through the same manual gate. Because Lambda code changes are the primary risk surface here (not declarative config), a rollback restores the previous Lambda code version — in-flight PENDING Donations are unaffected by a rollback (DynamoDB state persists independently of Lambda code version), and the reconciliation Lambda's own idempotent-write logic (BR5.5) makes it safe for a rolled-back-then-rolled-forward-again Lambda to reprocess a webhook it already handled once, mid-deployment.

## Secrets management in CI/CD

Two Secrets Manager secrets per environment (`donation-aggregator-api-key`, `donation-aggregator-webhook-signing-secret`) — TEST-mode for staging/local, LIVE-mode for production only (Q1). Referenced by both Lambdas via IAM role at runtime, never as a GitHub Actions repository secret or a plaintext environment variable in `amplify/functions/donation-*/resource.ts`. Per this project's Mandated secrets-handling rule (project.md) and the Forbidden rule against storing/transmitting raw payment details — neither secret is ever logged, and the webhook signing secret's only use is signature verification (BR5.1's "no raw payment details ever pass through this Unit" is satisfied by the tokenized aggregator flow itself, not by this secret).
