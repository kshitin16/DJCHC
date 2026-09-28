# Infrastructure Specification — feed-unit

> **Amended at Code Generation (R-01, Minor — accepted at the Infrastructure Design gate, fixed here per the builder's decision).** The Shared Infrastructure row's admin-group parenthetical now names every admin-gated operation, including the two admin-only reads.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | None of its own — AppSync resolvers on the shared, project-wide Amplify Data API | FeedUnit's own NFR Design already established it needs no dedicated Lambda; simple CRUD via direct AppSync/DynamoDB resolvers. |
| Region | `ap-south-1` (Mumbai) — inherited from auth-unit's Infrastructure Design | One region for the whole project. |
| Networking topology | N/A — no VPC, no compute of its own | Shared AppSync API is a public, IAM/Cognito-authenticated endpoint; no networking layer this Unit configures. |
| Storage strategy | DynamoDB on-demand (`Post` table), DynamoDB Streams enabled (`NEW_AND_OLD_IMAGES`) | Matches NFR Design's already-fixed decision; enables Contract 8 for reminder-unit's downstream consumption. |
| Environments | Amplify Hosting git-branch model — inherited from auth-unit's Infrastructure Design | Each branch's `Post` table (and its Streams) is provisioned independently per environment. |
| IaC approach | Amplify Gen2 backend-as-code (`amplify/data/resource.ts`'s `Post` model definition) | No separate hand-authored CDK/Lambda code for this Unit. |
| Resource sizing | N/A — no compute to size; DynamoDB on-demand needs no capacity planning | Matches NFR Design's scalability-design.md conclusion (on-demand comfortably covers this Unit's entire projected volume). |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| `Post` DynamoDB table | Database | On-demand capacity, AWS-managed encryption (NFR4.1), DynamoDB Streams enabled with `StreamViewType: NEW_AND_OLD_IMAGES` | Streams' 24-hour retention window is a fixed AWS characteristic (Kinesis-compatible DynamoDB Streams default), not a configurable setting — no design decision to make about it beyond enabling Streams itself. |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Cognito User Pool (Contract 1 identity for `createdByGoogleId` attribution; Contract 2 admin-group check on `createPost`/`updatePost`/`deletePost` and on the admin-only reads `listAllPostsForAdmin`/`getPost` — broadened at Code Generation to close Infrastructure Design finding R-01, per `nfr-design/security-design.md`) | auth-unit | feed-unit | Read-only — feed-unit's resolvers verify the caller's JWT; no write access to the User Pool. |
| `Post` DynamoDB Streams (Contract 8 — `PostDateTimeChanged`/`PostDeleted` events) | feed-unit | reminder-unit (its own Contract 8 event handler Lambda owns the event-source-mapping/trigger configuration that consumes this stream — that configuration lives in reminder-unit's own Infrastructure Design, not here) | feed-unit is responsible only for enabling the stream with the correct `StreamViewType`; the consuming Lambda's subscription configuration is entirely reminder-unit's own resource, per NFR Design's logical-components.md split. |
