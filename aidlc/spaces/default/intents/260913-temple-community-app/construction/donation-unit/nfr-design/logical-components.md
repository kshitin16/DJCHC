# Logical Components — donation-unit

## Component inventory

| Component | Nature | Failure domain |
|---|---|---|
| `Donation` DynamoDB table | Data store, part of the shared Amplify Data backend | Shared AWS region/account failure domain with every other Unit's tables — no isolation attempted, consistent with this project's single-backend design |
| AppSync resolvers (initiateDonation, cancelDonation, myDonations) | Part of the shared AppSync API | Same as above |
| Webhook Lambda (Contract 7 receiver) | Standalone Lambda behind a Function URL (Q1) — the first non-AppSync compute in this project | Isolated invocation per webhook call at the compute level; a crash or infrastructure fault in this Lambda does not affect AppSync's own availability. Corrected at this stage's review (R-02): this does NOT mean a logic bug in the Lambda is isolated from AppSync-served operations — see Blast radius below |
| Scheduled-reconciliation Lambda | Standalone Lambda, EventBridge-Scheduler-triggered (Q2) | Isolated per-invocation; independent of the webhook Lambda — the two can fail independently without affecting each other |
| SNS alert topic | Shared-nothing pub/sub resource, this Unit's own | Isolated to this Unit; no other Unit publishes to or subscribes from it |

## Blast radius

This is the first Unit in the project with dedicated compute (two Lambdas) separate from the shared AppSync/DynamoDB backend — a bug in the webhook Lambda or the reconciliation Lambda affects only this Unit's donation-processing correctness, not any other Unit's data or operations. That said, all three components (AppSync resolvers, webhook Lambda, reconciliation Lambda) read and write the SAME `Donation` table (see Shared resources below) — the isolation described above is a compute/deployment-fault isolation (one component's crash doesn't crash another), not a data isolation. A logic bug in the webhook Lambda that writes incorrect data to a `Donation` item IS visible to `myDonations` (an AppSync resolver) the next time that Donation is read — R-01's now-fixed idempotency bug was exactly this class of risk. This is a meaningfully smaller compute-fault blast radius than auth-unit's shared-configuration model, but not a fully isolated data blast radius.

## Shared resources

The `Donation` table is read/written by both Lambdas and the AppSync resolvers — the one resource genuinely shared within this Unit (not across Units). No resource here is shared with another Unit's own components.
