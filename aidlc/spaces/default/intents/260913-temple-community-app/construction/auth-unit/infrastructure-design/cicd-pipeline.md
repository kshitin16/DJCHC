# CI/CD Pipeline — auth-unit

This Unit's own CI/CD footprint is minimal — its only source artifact is `amplify/auth/resource.ts` (Cognito configuration-as-code), consumed by the single project-wide GitHub Actions workflow team.md (Q7) already affirmed. This document scopes that shared pipeline to what applies to this Unit; it does not introduce a separate pipeline.

## Pipeline stages (shared workflow, this Unit's relevant parts)

| Stage | What runs | Gate | auth-unit relevance |
|---|---|---|---|
| Lint/typecheck | ESLint + `tsc --noEmit` on the Amplify Gen2/TypeScript backend | Blocks merge on failure | Applies to `amplify/auth/resource.ts` like every other backend config file. |
| Unit tests | Jest, against Amplify Gen2's local sandbox (`ampx sandbox`) | Blocks merge on failure | AuthUnit has no Lambda handler of its own to unit-test; its "test" surface is schema/contract checks confirming the User Pool config (App Client type, Group definition) matches Contract 1/2's expected shape. |
| Integration test | `integration_test` (Flutter) — Cognito/Google-federation sign-in flow, per `team.md`'s affirmed test-type mix | Blocks merge on failure | This is the one flow where AuthUnit is the primary subject — the sign-in integration test exercises this Unit's entire behavior end-to-end. |
| Secret scanning | Pre-commit (`gitleaks`/`detect-secrets`) + GitHub's built-in scanning/push protection | Blocks commit / flags PR | Relevant because Cognito App Client configuration could accidentally introduce a secret if a future change adds a confidential client — the pre-commit hook catches this before it lands, though today's PUBLIC-client design has no secret to leak. |
| Deploy to staging | Amplify Hosting, `main` branch, automatic on merge | None (automatic) | Provisions/updates the staging User Pool from `amplify/auth/resource.ts`. |
| Deploy to production | Amplify Hosting, `production` branch, manual promotion | Manual checklist (team.md Q8): no secrets committed, no open Dependabot alerts, any AWS permissions/auth change double-checked — this last item explicitly covers AuthUnit's own Cognito config changes | Every change to this Unit's Cognito configuration is exactly the kind of "AWS permissions/auth change" the checklist calls out for extra scrutiny before promotion. |

## Rollback

Amplify Hosting retains prior deployment versions per branch; a bad `production` promotion is rolled back by re-promoting the last-known-good commit through the same manual gate. Cognito User Pool configuration changes (e.g. a Group definition edit) are declarative (Amplify Gen2 reconciles the deployed User Pool to match `amplify/auth/resource.ts` on each deploy) — reverting the source file and redeploying reverts the configuration; existing user sessions/tokens are unaffected by a configuration rollback (Cognito does not retroactively invalidate already-issued tokens).

## Secrets management in CI/CD

Corrected at this stage's review (R-01): a secret DOES exist for this Unit — Cognito's own App Client having no secret (PUBLIC client, NFR Design Q2) is a separate fact from Google federation's own credential. The Google OAuth Client ID + Client Secret (infrastructure-specification.md's "Per-environment Google OAuth registration" section) is stored in AWS Secrets Manager, one secret per environment (dev/staging/production — matching the per-branch OAuth Client split), and referenced by `amplify/auth/resource.ts`'s `externalProviders.google` config via Amplify's `secret()` helper at deploy time, which resolves it from Secrets Manager using the deploying pipeline's IAM role. It is never a GitHub Actions repository secret checked into workflow YAML in plaintext, and never appears in `amplify/auth/resource.ts` itself (only a reference to the secret's name) — consistent with this project's Mandated secrets-handling rule (project.md). The one-time Google Cloud Console redirect-URI registration per environment (infrastructure-specification.md) is a manual step outside this pipeline's automation, performed by the builder when each environment's Cognito domain first becomes known.
