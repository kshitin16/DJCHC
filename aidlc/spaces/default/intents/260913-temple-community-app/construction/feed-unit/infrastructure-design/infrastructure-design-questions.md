# Infrastructure Design — Questions (feed-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/feed-unit/nfr-design/*.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/feed-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md`

Region and environment strategy are already fixed project-wide (auth-unit's Infrastructure Design) and carry forward unchanged. This Unit's own NFR Design already fully specified its one infrastructure-relevant decision — DynamoDB Streams with `StreamViewType: NEW_AND_OLD_IMAGES` on the `Post` table, enabling Contract 8 — and Streams' 24-hour retention window is a fixed AWS characteristic, not a configurable choice. FeedUnit has no compute, cache, or other infrastructure service of its own beyond the shared AppSync/DynamoDB backend every simple CRUD Unit in this project uses. There is genuinely no new infrastructure decision this stage needs to make for this Unit beyond restating and confirming what NFR Design already settled.

## Consolidated Summary Confirmation

- Region and environments: inherited unchanged from auth-unit's Infrastructure Design (`ap-south-1`, Amplify Hosting git-branch model).
- `Post` DynamoDB table: on-demand capacity, AWS-managed encryption, DynamoDB Streams enabled with `NEW_AND_OLD_IMAGES` (already fixed at NFR Design) — no new configuration decision here.
- No compute, cache, or other dedicated infrastructure service for this Unit — its AppSync resolvers run on the shared, project-wide API.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
