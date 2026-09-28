# Reliability Requirements — donation-unit

## NFR2.1 — Availability (inherits inception NFR2)

```
SLI: successful Initiate/Reconcile/Cancel operations / total attempts
SLO: best-effort, matching Amplify/AWS managed-service availability — no independent SLA (NFR2),
consistent with the rest of this project's posture. This Unit's real availability ceiling is
whichever of AWS or the payment aggregator has the lower uptime; neither is under this project's
control.
```

## NFR2.2 — Fault tolerance

| Failure | Behavior |
|---|---|
| Aggregator checkout-session API unavailable | Initiate Donation fails at step 4 (functional-spec.md); Donation stays at INITIATED, never reaches PENDING; plain-language error with retry, per the existing error path |
| Webhook delivery lost entirely (aggregator never calls back) | BR5.4's 5-minute timeout check (NFR5.1) is the fallback — the Donation is never left PENDING indefinitely on a missing webhook alone |
| Webhook delivered but this app's endpoint is briefly down | The aggregator's own retry behavior (typical of UPI aggregators) redelivers; BR5.5's idempotent handling means a late-arriving redelivery after the timeout-driven reconciliation already resolved status is a safe no-op |
| Cancel-recurring's stop-charges call to the aggregator fails | functional-spec.md's existing error path already covers this: status is not set to CANCELLED until the aggregator confirms, avoiding a false CANCELLED state while charges continue |

## NFR2.3 — Data durability

Donation records are stored in DynamoDB with AWS's standard managed replication (NFR4's encryption-at-rest requirement is layered on top). No Unit-specific backup procedure beyond what Amplify Data's DynamoDB backing provides by default — this Unit's financial-record durability need does not exceed what the managed service already guarantees at this project's scale and budget.

## NFR2.4 — Disaster recovery

No RTO/RPO target beyond the project-wide posture (deferred to Infrastructure Design's region choice). Given this Unit's records are financially meaningful, DynamoDB point-in-time recovery (PITR) is worth enabling once Infrastructure Design provisions the table — noted here as a recommendation for that stage, not decided at this stage.
