# Infrastructure Specification — auth-unit

AuthUnit is pure Cognito configuration within the single shared Amplify Gen2 backend (NFR Design, Q3) — there is no compute, cache, queue, search service, CDN, or load balancer of its own to design. This document is correspondingly light.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | None (managed service only — Cognito User Pool + Identity Pool) | AuthUnit deploys no Lambda, container, or VM of its own; Cognito is fully AWS-managed. |
| Region | `ap-south-1` (Mumbai) | Closest AWS region to this app's entire user base (Q1); every AWS service this project uses is available there; no data-residency or service-availability constraint argues against it. |
| Networking topology | N/A — no VPC, no ingress/egress of its own | Cognito's hosted UI is a public AWS-managed endpoint; the mobile app talks to it directly via the Amplify Auth SDK, no networking layer this project configures. |
| Storage strategy | N/A — Cognito manages its own User Pool storage | No project-owned database or object storage for this Unit. |
| Environments | Amplify Hosting git-branch model (Q2): `main` → staging (auto-deploy on every merge), `production` branch → production (promoted only after the manual checklist, `team.md` Q8, passes); `ampx sandbox` for local development | Matches `org.md`/`team.md`'s already-affirmed deploy-on-merge-to-staging + manual-production-gate cadence, implemented via Amplify Gen2's own per-branch backend provisioning — no custom environment-cloning mechanism needed. |
| IaC approach | Amplify Gen2 backend-as-code (`amplify/auth/resource.ts`), which Amplify Gen2 compiles to CDK/CloudFormation under the hood | This project's already-fixed backend framework (Contract Design); no separate hand-authored CDK stack is introduced for this Unit. |
| Resource sizing | N/A — Cognito has no instance/capacity sizing to configure | A fully managed, serverless-by-nature AWS service; NFR Design's scalability-design.md already confirmed Cognito's default service limits are far beyond this project's ~1000-identity ceiling. |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| Cognito User Pool | Identity provider | Single pool, single PUBLIC App Client (no client secret — NFR Design Q2), Google OIDC federation, Authorization Code + PKCE flow, 1h access/ID token / 30-day refresh token lifetimes, "Admin" Cognito Group | One pool shared by every Unit in this project (see Shared Infrastructure below) — this is the one AWS resource AuthUnit is responsible for provisioning on behalf of the whole app. |
| Cognito Hosted UI | Sign-in redirect endpoint | Default Amplify-generated domain (`<prefix>.auth.ap-south-1.amazoncognito.com`), default sender for any Cognito-native system email (Q3) | No custom domain, no ACM certificate, no Route 53 record — deliberately deferred (Q3); revisit only if a future need for a branded sign-in URL arises. |
| Cognito Identity Pool | Not used by this Unit | — | The GUEST/unauthenticated Identity Pool used by reminder-unit is that Unit's own resource, not AuthUnit's — AuthUnit's identity model is exclusively the Google-federated User Pool. |
| Google OAuth Client (external IdP registration) | Not an AWS resource — a Google Cloud Console OAuth 2.0 Client ID, registered as Cognito's external identity provider (corrected at this stage's review, R-01) | One Google OAuth Client per environment (see below); Client ID + Client Secret stored in AWS Secrets Manager, referenced by `amplify/auth/resource.ts`'s `externalProviders.google` config, never committed to source | Google federation (BR1.1) is not possible without this — Cognito's PUBLIC App Client having no secret of its own (Q2, NFR Design) does NOT mean no secret exists for this Unit; it means the mobile app's Cognito-facing client has none. The separate Google-facing secret is the one this Unit's `cicd-pipeline.md` previously omitted entirely. |

### Per-environment Google OAuth registration (R-02)

Because environments are separate Amplify Hosting branches (Deployment above), each gets its own Cognito hosted-UI domain (`<random-prefix>.auth.ap-south-1.amazoncognito.com`, per-branch — Q3's "defaults" answer means Amplify-generated, not that the prefix is shared) and therefore its own OAuth redirect URI (`https://<that-branch's-domain>/oauth2/idpresponse`). Google Cloud Console requires every valid redirect URI to be explicitly whitelisted on the Google OAuth Client. This is a **one-time-per-environment manual setup step**, not something Amplify Gen2 automates:

| Environment | Google OAuth Client | Redirect URI to register in Google Cloud Console |
|---|---|---|
| Local (`ampx sandbox`) | A dedicated "dev" Google OAuth Client (or the same Client with all three URIs registered — either works; a dedicated dev Client keeps local testing from touching production's OAuth consent screen quota) | The sandbox's own ephemeral Cognito domain, re-registered each time a fresh sandbox is created (a known friction point for local development — acceptable at this project's scale, not designed around further) |
| Staging (`main` branch) | Staging Google OAuth Client (or the same "dev" Client) | The staging branch's Cognito hosted-UI domain |
| Production (`production` branch) | Production Google OAuth Client — kept separate from dev/staging so a compromised dev credential can't be used to impersonate the production app in Google's consent screen | The production branch's Cognito hosted-UI domain |

This registration step is a manual, one-time action per environment (performed once when that environment's Amplify backend is first deployed and its Cognito domain becomes known) — flagged here so it is not discovered as a first-run sign-in failure. It is out of scope for CI/CD automation at this project's scale (see `cicd-pipeline.md`).

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Cognito User Pool (incl. "Admin" Group and `cognito:groups` claim) | auth-unit | feed-unit, pdf-library-unit, suggestion-unit, donation-unit (every Unit whose operations require Contract 1 identity or Contract 2 admin-group verification) | Read-only for consumers — every consuming Unit's own AppSync/Amplify Data authorization rule reads `cognito:groups`/`sub` from the caller's verified JWT; no consumer writes to the User Pool or its Group membership. Group membership itself is managed out-of-band by the app owner directly against the deployed User Pool (AWS Console or CLI — domain-design's own Operational note), not through any Unit's API. |
