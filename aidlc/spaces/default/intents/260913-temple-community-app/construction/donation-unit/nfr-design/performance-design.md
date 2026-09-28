# Performance Design — donation-unit

## Design for NFR-PERF.1 (Initiate Donation, < 2s p95)

```
Path: AppSync mutation (initiateDonation) -> resolver -> DynamoDB write (Donation, status
  INITIATED) -> aggregator checkout-session API call -> DynamoDB write (status PENDING,
  aggregatorTransactionId) -> return DonationInitiation
Optimization: none beyond a direct, synchronous resolver — no caching applies (each call
  creates a new resource), no connection pooling decision needed (DynamoDB/AppSync manage
  their own connections). The aggregator checkout-session call is the dominant cost and is
  outside this design's control.
```

## Design for NFR-PERF.2 (Payment Status Reconciliation, < 1s p95)

```
Webhook path: Lambda Function URL (Q1) receives the notification, verifies signature,
  performs the atomic conditional DynamoDB write (NFR5.2) — a single-digit-millisecond
  DynamoDB operation once signature verification completes. No caching, no connection
  pooling beyond the Lambda's own warm DynamoDB SDK client.
Scheduled-reconciliation path: the polling Lambda (Q2) processes each stale PENDING
  Donation independently; per-Donation latency is dominated by the aggregator's own
  status-query API response time, not this design's own logic.
```

## Async processing

The scheduled polling Lambda (Q2) is itself the async-processing pattern for this Unit's one "background work" need (noticing a stale PENDING Donation) — no separate queue (SQS) is introduced, since EventBridge Scheduler's own invocation is sufficient at this app's volume (a handful of Donations at a time; no batching or fan-out is needed).
