# CI/CD Pipeline — reminder-unit

Uses the same project-wide GitHub Actions workflow (team.md Q7) as every other Unit; this document scopes it to this Unit's six Lambdas and adds the change-review trigger security-design.md establishes.

## Pipeline stages (shared workflow, this Unit's relevant parts)

| Stage | What runs | Gate | reminder-unit relevance |
|---|---|---|---|
| Lint/typecheck | ESLint + `tsc --noEmit` | Blocks merge | Applies to `amplify/data/resource.ts` and all six Lambda handlers (`myReminders` added at this stage's review, R-01). |
| Unit tests | Jest, against `ampx sandbox` | Blocks merge | Covers `myReminders`' backfill + two-schedule-creation logic, the EventBridge schedule-management logic (create/update/delete on snooze/cancel/Contract-8-cascade), the no-op re-sync branches (BR7.3/BR7.10, reliability-design.md's R-03/R-04 fixes), the `postId` GSI Query in the Contract 8 handler, and `deliver-push`'s FCM call + delivery-timing metric computation. |
| Integration test | `integration_test` (Flutter) — Sync/backfill reminders, register device, toggle reminders, snooze/cancel, and a Post-delete cascade-cancel, per team.md's affirmed test-type mix | Blocks merge | Exercises the guest-identity auth rules and the EventBridge-to-Lambda delivery path end-to-end against `ampx sandbox`. |
| Secret scanning | Pre-commit (`gitleaks`/`detect-secrets`) + GitHub's built-in scanning/push protection | Blocks commit / flags PR | Relevant here: the Firebase service-account credential is exactly the class of secret this control exists to catch before it's committed. |
| Deploy to staging | Amplify Hosting, `main` branch | None (automatic) | Provisions/updates both tables, all six Lambdas, and the EventBridge Scheduler group. |
| Deploy to production | Amplify Hosting, `production` branch, manual promotion | Manual checklist (team.md Q8) PLUS this Unit's own change-review trigger (security-design.md): any change to the guest-identity auth config, the Contract 8 Lambda's idempotency logic, or the EventBridge schedule-creation/update/delete logic gets a brief self-review before merging | The change-review trigger applies independently of (in addition to) the standard checklist. |

## Rollback

Amplify Hosting retains prior deployment versions per branch; a bad production promotion rolls back to the last-known-good commit through the same manual gate. All six Lambdas' code is versioned independently of DynamoDB/EventBridge state — a rollback reverts Lambda logic without affecting already-created schedules or Reminder records; a schedule created under a since-rolled-back code version continues to fire against whichever Lambda version is currently deployed when it triggers (no schedule-to-code-version binding exists).

## Secrets management in CI/CD

One Secrets Manager secret per environment (`reminder-fcm-service-account`), referenced by `deliver-push`'s IAM role at runtime, never as a GitHub Actions repository secret or a plaintext environment variable in `amplify/functions/deliver-push/resource.ts`. Per this project's Mandated secrets-handling rule (project.md).
