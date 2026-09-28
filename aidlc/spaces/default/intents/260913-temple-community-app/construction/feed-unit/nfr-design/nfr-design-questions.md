# NFR Design — Questions (feed-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/feed-unit/nfr-requirements/*.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/feed-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 2, 3, 8)

This Unit has two genuine design decisions: whether `listPosts` needs any caching layer, and which Unit's infrastructure owns the DynamoDB Streams event-source-mapping configuration that feeds Contract 8 to ReminderUnit.

## Q1. Caching for `listPosts`: given NFR1.1's <2s target already holds without one, does this Unit need any caching layer (AppSync response cache, CDN, etc.) in front of the DynamoDB query?

- A. No caching layer — a direct DynamoDB query already meets the latency target at this app's data volume (~200 active posts). Adding a cache would introduce staleness-management complexity (an admin's edit needing to invalidate a cached response) that this app's low write/read volume doesn't justify. (Recommended)
- B. Add a caching layer — specify
- X. Other (please specify)

[Answer]: A. No caching layer.

## Q2. DynamoDB Streams ownership: FeedUnit's `Post` table needs Streams enabled to feed Contract 8's events to ReminderUnit's Lambda. Which Unit's infrastructure configures the actual event-source mapping (the Lambda trigger itself)?

- A. FeedUnit's table definition enables DynamoDB Streams (a one-property CDK/Amplify Data setting on the table it already owns); ReminderUnit's own infrastructure (where its Lambda is defined) owns the event-source-mapping configuration that subscribes that Lambda to FeedUnit's stream. This keeps each Unit responsible for the infrastructure it actually deploys — FeedUnit exposes the stream, ReminderUnit consumes it — rather than one Unit's stack reaching into another's. (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. FeedUnit enables Streams, ReminderUnit owns the trigger.

## Consolidated Summary Confirmation

- No caching layer for `listPosts` — direct DynamoDB query meets the latency target at this scale.
- FeedUnit's table enables DynamoDB Streams; ReminderUnit's own infrastructure owns the event-source-mapping/Lambda-trigger configuration that consumes it.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
