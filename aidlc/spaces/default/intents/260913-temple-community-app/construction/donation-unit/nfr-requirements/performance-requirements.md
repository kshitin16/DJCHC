# Performance Requirements — donation-unit

## NFR-PERF.1 — Initiate Donation latency (Unit-local ID; no inception-level performance NFR names this Unit's request path — see traceability.json)

| Field | Value |
|---|---|
| Metric | Time from submitting amount/type/frequency to receiving a `DonationInitiation` (checkout URL) back |
| Target | < 2 seconds |
| Percentile | p95 |
| Load condition | Normal usage — a handful of concurrent donation initiations at most, given this app's 300-1000 person community |
| Measurement method | Server-side timer around the AppSync resolver invoking the aggregator's checkout-session API |

The dominant cost here is the aggregator's own checkout-session creation call, not anything internal to this Unit's own logic (a single validation + DynamoDB write before that call).

## NFR-PERF.2 — Payment Status Reconciliation latency

| Field | Value |
|---|---|
| Metric | Time from receiving a valid webhook notification to the corresponding `Donation.status` being updated |
| Target | < 1 second |
| Percentile | p95 |
| Load condition | Normal usage |
| Measurement method | Server-side timer around the webhook handler's DynamoDB conditional write (Q2) |

## Out of scope

No throughput target is set — this app's donation volume (a fraction of a 300-1000 person community, intermittent giving) never approaches a scale where this Unit's own performance is a bottleneck; the aggregator's own API is the limiting factor in every request path this Unit owns.
