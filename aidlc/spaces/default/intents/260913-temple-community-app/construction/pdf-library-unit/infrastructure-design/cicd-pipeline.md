# CI/CD Pipeline — pdf-library-unit

Uses the same project-wide GitHub Actions workflow (team.md Q7) as every other Unit; no dedicated pipeline.

## Pipeline stages (shared workflow, this Unit's relevant parts)

| Stage | What runs | Gate | pdf-library-unit relevance |
|---|---|---|---|
| Lint/typecheck | ESLint + `tsc --noEmit` | Blocks merge | Applies to `amplify/storage/resource.ts`, `amplify/data/resource.ts`'s `Document` model, and the Document Lambda's handler code (corrected at this stage's review, R-01/R-02 — this Unit does have one Lambda function, contrary to an earlier draft's "no Lambda needed" claim). |
| Unit tests | Jest, against `ampx sandbox` | Blocks merge | Schema/contract checks confirming the S3 bucket policy (BLOCK_ALL, no Versioning) and `Document` model match Contract 6's expected shape, plus unit tests for the Document Lambda's four operations (URL generation, PDF-type verification in `confirmDocumentUpload`, and `deleteDocument`'s S3 removal — BR6.4), including its `Document` table reads/writes (GetItem/PutItem/DeleteItem), and `confirmDocumentUpload`'s title/category re-supply (Contract 6 amendment). |
| Integration test | `integration_test` (Flutter) — Browse/Download and Admin Upload/Delete flows, per team.md's affirmed test-type mix | Blocks merge | Exercises the public read path and the admin-gated two-step upload flow end-to-end against `ampx sandbox`. |
| Secret scanning | Pre-commit (`gitleaks`/`detect-secrets`) + GitHub's built-in scanning | Blocks commit / flags PR | No secret exists for this Unit today, but the hook runs project-wide regardless. |
| Deploy to staging | Amplify Hosting, `main` branch | None (automatic) | Provisions/updates the staging S3 bucket and `Document` table. |
| Deploy to production | Amplify Hosting, `production` branch, manual promotion | Manual checklist (team.md Q8) | Bucket policy and IAM role changes fall under the checklist's "AWS permissions/auth changes double-checked" item. |

## Rollback

Amplify Hosting retains prior deployment versions per branch; a bad production promotion rolls back through the same manual gate. Bucket configuration (encryption, lifecycle rule, BlockPublicAccess) is declarative and reverts with the source file. Already-uploaded S3 objects and `Document` records are unaffected by a configuration rollback — BR6.4's hard-delete design means there is no soft-deleted data a rollback could need to restore.

## Secrets management in CI/CD

No secret exists for this Unit — pre-signed URL generation, deletion, and `Document` table access all use the Document Lambda's own IAM role (AWS SigV4 signing, via the AWS SDK's credential provider chain), not a stored credential. No third-party integration.
