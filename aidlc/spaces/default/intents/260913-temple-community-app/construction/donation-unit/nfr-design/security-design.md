# Security Design — donation-unit

## Authentication/authorization architecture (NFR3.1, NFR-AUTHZ pattern via Contract 1)

```
initiateDonation/cancelDonation/myDonations: Cognito User Pool JWT auth (Contract 1),
  same pattern as every other signed-in-only operation in this project — no new auth
  mechanism designed here.
Webhook (Contract 7): NOT Cognito-authenticated — verified instead by the aggregator's own
  HMAC/signature scheme (per Contract 7's `aggregatorSignature` security scheme), checked
  first-thing in the Lambda Function URL handler (Q1) before any DynamoDB write. A request
  with an invalid signature is rejected (401) and never reaches the idempotent-write logic.
```

## Webhook endpoint security (Q1)

```
Lambda Function URL auth mode: NONE (AWS_IAM would block the aggregator, which cannot sign
  SigV4 requests) — the endpoint is intentionally public at the network level, with the
  aggregator's own payload signature as the actual authentication mechanism (matching how
  every UPI aggregator webhook integration works; this is not a gap, it is the standard
  pattern for third-party webhook receivers).
Payload validation: signature check first, then schema/shape validation of the JSON body,
  before any DynamoDB write is attempted.
```

## Idempotent write design (NFR5.2)

```
DynamoDB conditional UpdateItem, keyed on the Donation's id (resolved via order_id per
Contract 7 — order_id correlates to Donation.id). The item carries one internal,
persistence-layer-only attribute beyond the conceptual Donation entity (functional-design's
entities.md, and Contract 5's public GraphQL type, are both unaffected — this attribute is
never exposed to any API consumer): `processedPaymentId`, set by this same write, which is
what the condition actually checks on the NEXT call for the same Donation:

  UpdateItem(
    Key: { id: <resolved via order_id> },
    UpdateExpression: "SET status = :s, processedPaymentId = :p",
    ConditionExpression: "attribute_not_exists(processedPaymentId) OR processedPaymentId <> :p",
    ExpressionAttributeValues: { ":s": <SUCCEEDED|FAILED>, ":p": <payment_id> }
  )

Corrected at this stage's review (R-01): the UpdateExpression must actually WRITE
processedPaymentId on every successful call — the first call has no such attribute yet
(attribute_not_exists is true, so it always succeeds and sets processedPaymentId := payment_id),
and a genuine duplicate delivery of the SAME payment_id then finds processedPaymentId already
equal to :p (both OR-clause branches false), so DynamoDB itself throws
ConditionalCheckFailedException — which the Lambda catches and returns success (200) with no
further state change, satisfying BR5.5's idempotency requirement as a single atomic operation.
A prior draft of this pseudocode never wrote the attribute at all, which would have made the
condition permanently vacuous (always true) and defeated idempotency entirely — this is now
fixed, not just relabeled.

Corrected again at this stage's review (R-04): an earlier draft of this fix also wrote
`aggregatorTransactionId = :p`, overwriting that field with the webhook's `payment_id`
(Contract 7: "the aggregator's own transaction identifier", distinct from `order_id`) on
every SUCCEEDED/FAILED transition. But `aggregatorTransactionId` is populated exactly once,
at the INITIATED→PENDING transition, from the aggregator's checkout reference
(functional-spec.md step 5; entities.md marks it `unique: true` and "populated once") — its
documented lifecycle never includes a settlement-time rewrite, and `order_id` (not
`payment_id`) is what actually correlates to this field's original value. The
UpdateExpression now writes only `status` and the internal `processedPaymentId` tracking
attribute at settlement time, leaving the checkout-time `aggregatorTransactionId` untouched —
consistent with functional-spec.md's state machine, whose PENDING→SUCCEEDED/FAILED Actions
are "Record success"/"Record failure" only, with no re-population of this field.
```

## Encryption

At rest: AWS-managed DynamoDB encryption (per NFR4.1). In transit: TLS 1.2+ enforced by both the AppSync endpoint and the Lambda Function URL (Function URLs are HTTPS-only by default — no HTTP endpoint is ever exposed).

## Process controls (NFR3.5)

```
Access-boundary rule: only services/donation_service.dart may call package:amplify_* for
  this Unit's client-side operations — a code-organization convention, not an infrastructure
  design decision.
Change-review trigger: any change to donation_service.dart, the webhook Lambda, the
  reconciliation Lambda, or the aggregator integration gets a brief self-review before
  merging — a process control, not something this design stage architects further.
```

## Secrets management

The aggregator's webhook-signature verification key/secret is stored in AWS Secrets Manager (or SSM Parameter Store, SecureString) and read by the Lambda at invocation time — never hardcoded, never in an environment variable in plaintext, per this project's Mandated secrets-handling rule (project.md).
