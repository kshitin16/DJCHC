# Infrastructure Design — Questions (auth-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/auth-unit/nfr-design/*.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/auth-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md`

This Unit's own NFR Design already settled that AuthUnit is pure Cognito configuration within the single shared Amplify Gen2 backend, not a separate deployable (Q3, NFR Design) — so most of this stage's usual focus areas (compute model, scaling policy, caches, queues) don't apply here; there is no compute of its own to size or scale. What's genuinely open is region and environment/promotion strategy, both explicitly deferred to this stage by earlier decisions (Feasibility flagged the region as a suggestion, not a decision; `team.md`'s Deployment section explicitly defers region choice to here).

## Q1. AWS region: Feasibility suggested `ap-south-1` (Mumbai) for proximity to the user base, but left the final choice to Infrastructure Design. Does that still fit, or has anything changed?

- A. `ap-south-1` (Mumbai) — closest AWS region to this app's entire user base (a single temple community in India); lowest latency for Cognito's hosted UI redirect and every other AWS service this project uses, all of which are available in `ap-south-1`. No competing constraint (data residency, service availability) argues against it. (Recommended)
- B. A different region — specify which and why
- X. Other (please specify)

[Answer]: A. ap-south-1 (Mumbai).

## Q2. Environment/promotion strategy: `team.md`'s Deployment section already fixes the cadence (deploy on merge to staging, a manual checklist gate before production) and `org.md` fixes trunk-based development. What AWS-level mechanism actually implements "staging" and "production" for an Amplify Gen2 app?

- A. Amplify Hosting's git-branch-based environments — `main` branch auto-deploys to a staging Amplify Hosting environment on every merge (backend + frontend together, Amplify Gen2's standard model); a separate `production` branch, promoted only after the builder's manual checklist passes, deploys to the production Amplify Hosting environment. Each branch gets its own isolated backend (separate Cognito User Pool, separate DynamoDB tables, etc.) via Amplify Gen2's per-branch backend provisioning — no manual environment-cloning step. Local development uses `ampx sandbox` (an ephemeral, per-developer backend), never touching staging or production resources. This is Amplify Gen2's own designed-for-this workflow, not a custom mechanism this project has to build. (Recommended)
- B. Separate AWS accounts per environment (not per-branch) — specify why
- X. Other (please specify)

[Answer]: A. Amplify Hosting git-branch environments (main → staging, production → prod), ampx sandbox for local dev.

## Q3. Cognito-specific settings this Unit's own NFR Design didn't already pin down: hosted-UI custom domain, and email/support contact shown on the Cognito hosted sign-in page. Any preference, or use Cognito/Amplify defaults?

- A. Use Amplify Gen2/Cognito defaults for both — the default Amplify-generated hosted-UI domain (`<random-prefix>.auth.ap-south-1.amazoncognito.com`) is functionally identical to a custom domain for this app's use case (users never type it directly; it's only seen briefly during the OAuth redirect), and a custom domain adds a DNS/ACM-certificate dependency this solo project doesn't need yet. No custom "support email" is configured beyond Cognito's own default sender for any account-related system email (verification is not applicable here, since sign-in is entirely Google-federated with no Cognito-native password/email verification flow). (Recommended)
- B. Configure a custom hosted-UI domain — specify the domain
- X. Other (please specify)

[Answer]: A. Amplify/Cognito defaults for both.

## Consolidated Summary Confirmation

- Region: `ap-south-1` (Mumbai).
- Environments: Amplify Hosting git-branch model — `main` → staging (auto-deploy on merge), a `production` branch promoted only after the manual checklist (team.md Q8) passes → production; `ampx sandbox` for local development. Each branch gets its own isolated Amplify Gen2 backend (own Cognito User Pool, etc.).
- Cognito hosted-UI: Amplify/Cognito defaults (no custom domain, no custom sender configuration).
- No compute, cache, queue, or scaling design applies to this Unit — it is pure Cognito configuration, consistent with NFR Design's own conclusion.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
