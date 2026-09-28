<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
- 2026-09-14T17:35:00Z — resolved the AWS region question (deferred by Feasibility) to ap-south-1, and the environment/promotion mechanism to Amplify Hosting's git-branch model, implementing team.md/org.md's already-affirmed deploy-on-merge-to-staging + manual-production-gate cadence without introducing a new mechanism.

## Deviations
- 2026-09-14T17:42:00Z — after review flagged R-01/R-02: added the Google OAuth Client ID/Secret (Cognito's external-IdP credential, distinct from the Cognito App Client's own no-secret PUBLIC config) as a named infrastructure dependency and CI/CD secret, and documented the per-environment Google Cloud Console redirect-URI registration step that the per-branch Amplify Hosting model requires.

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
