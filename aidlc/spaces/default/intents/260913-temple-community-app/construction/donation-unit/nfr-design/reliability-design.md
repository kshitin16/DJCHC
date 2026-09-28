# Reliability Design — donation-unit

## Design for NFR2.1-2.4 (best-effort availability)

```
Resilience pattern: no circuit breaker (Q4, confirmed) — per-call timeout on the aggregator
  API (both the checkout-session creation call and the reconciliation Lambda's status-query
  call), with existing error+retry UX on the client side (Initiate Donation) and the
  scheduled poller's own next-cycle retry (reconciliation) as the resilience mechanism.
Retry policy: the scheduled poller (Q2) is itself a retry mechanism — a Donation that fails
  to resolve on one cycle (aggregator API timeout, transient error) is picked up again on
  the next ~1-minute cycle automatically, with no separate retry-with-backoff logic needed
  inside a single invocation.
Health checks: not applicable — no long-running compute to health-check; both Lambdas are
  invoked per-event/per-schedule, not a service with a health endpoint.
Failover: none — no secondary aggregator, matching this project's single-aggregator design
  (FR5.1/FR5.2); an aggregator outage degrades to "donations cannot be initiated," which is
  an accepted risk at this project's scale, not designed around.
```

## Data durability and backup

DynamoDB's standard managed replication plus NFR4's encryption-at-rest. As noted in NFR Requirements, DynamoDB point-in-time recovery (PITR) is recommended for this table given the financial-record stakes — this design stage restates that recommendation as an Infrastructure Design action item (PITR is a table-configuration setting, not something this stage decides the mechanism for).

## Alerting reliability (NFR-OBS.4, Q3)

The SNS topic + email subscription is itself the reliability mechanism for surfacing a reconciliation failure — no additional retry/escalation logic is designed (SNS's own delivery retry to the email endpoint is sufficient at this app's single-recipient, low-volume alerting need).
