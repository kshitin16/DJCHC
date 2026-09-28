# NFR Design — Questions (donation-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/donation-unit/nfr-requirements/*.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/donation-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 1, 5, 7)

This is the Unit with the most real architectural decisions to make in this stage: a webhook endpoint outside the AppSync/GraphQL API, a timeout-driven reconciliation trigger, and this project's one alerting integration.

## Q1. Webhook handling architecture: Contract 7 (the aggregator's payment-status webhook) is a plain REST/HTTP endpoint, not a GraphQL operation — how should it be exposed?

- A. A dedicated Lambda function behind a Lambda Function URL (or a minimal API Gateway HTTP API route), separate from the AppSync API that serves Contract 5. This keeps the webhook's signature-verification and idempotent-write logic isolated from the GraphQL resolver layer, and Lambda Function URLs avoid API Gateway's extra cost/complexity for a single-route, low-volume endpoint. (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Lambda Function URL.

## Q2. Reconciliation timeout trigger: BR5.4/NFR5.1 need something to notice "a Donation has sat PENDING for 5 minutes" and then check the aggregator's record. What triggers that check?

- A. A scheduled Lambda (EventBridge Scheduler rule, e.g. every 1 minute) that scans for Donations in PENDING status older than 5 minutes and, for each, queries the aggregator's transaction-status API and resolves status. Simple, matches this app's low volume (a handful of donations at a time), and reuses the same "polling Lambda" pattern already named as a candidate for reminder-unit's scheduled-compute mechanism (Contract 9's Open Questions) — one architectural pattern, two independent uses. (Recommended)
- B. Something different (e.g. DynamoDB TTL+Streams, EventBridge Scheduler per-Donation) — specify
- X. Other (please specify)

[Answer]: A. Scheduled polling Lambda.

## Q3. Alerting delivery mechanism (NFR-OBS.4's reconciliation-failure alert): what actually sends the notification to the builder?

- A. An SNS topic that the reconciliation Lambda publishes to on a reconciliation failure, with an email subscription the builder configures once (manually, or via a deployment-time parameter) pointing at their own inbox. This is the standard lightweight AWS pattern for a single-recipient alert and needs no additional service. (Recommended)
- B. Something different (e.g. CloudWatch Alarm on a custom metric, a different notification channel) — specify
- X. Other (please specify)

[Answer]: A. SNS topic + email subscription.

## Q4. Circuit breaker for calls to the payment aggregator's API (checkout creation, and the reconciliation Lambda's status-check query): is one needed?

- A. No circuit breaker — a simple per-call timeout + the existing error/retry UX (Initiate Donation) or the next scheduled cycle's retry (reconciliation) is sufficient at this app's call volume (a handful of donations at a time, never a burst that could overwhelm the aggregator or justify failing fast). A circuit breaker's value is protecting a system under sustained load from cascading failure — not applicable here. (Recommended)
- B. Add a circuit breaker — specify the threshold
- X. Other (please specify)

[Answer]: A. No circuit breaker needed.

## Consolidated Summary Confirmation

- The webhook (Contract 7) is served by a dedicated Lambda behind a Function URL, separate from the AppSync API.
- The 5-minute PENDING timeout check runs via a scheduled Lambda (EventBridge Scheduler, ~1-minute cadence) scanning for stale PENDING Donations.
- Reconciliation-failure alerts go through an SNS topic with an email subscription the builder configures.
- No circuit breaker around aggregator API calls — simple timeout + retry/next-cycle is sufficient at this app's scale.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
