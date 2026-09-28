# Reliability Requirements — suggestion-unit

## NFR2.1 — Availability (inherits inception NFR2)

```
SLI: successful submit/myPastSuggestions/allSuggestions calls / total attempts
SLO: best-effort, matching Amplify/AWS managed-service availability — no independent SLA (NFR2),
consistent with the rest of this project's posture.
```

## NFR2.2 — Fault tolerance

| Failure | Behavior |
|---|---|
| Submit fails at the atomic-counter step (infrastructure error, not the cap itself) | Plain-language error with retry (existing error path); no partial Suggestion or counter increment is left — the conditional UpdateItem is all-or-nothing |
| myPastSuggestions/allSuggestions query fails | Plain-language error with retry (existing error path) |
| AppSync's declarative auth layer itself is degraded | Out of this Unit's control — a managed-service dependency, covered by NFR2.1's best-effort posture |

## NFR2.3 — Data durability

Suggestion and SuggestionDailyCount records use DynamoDB's standard managed replication and NFR4's encryption-at-rest. No Unit-specific backup procedure beyond Amplify Data's DynamoDB backing.

## NFR2.4 — Disaster recovery

No RTO/RPO target beyond the project-wide posture (deferred to Infrastructure Design's region choice). Since BR3.4 makes suggestions permanent by design, accidental data loss (a region failure, an operator error) would be a genuine, unrecoverable loss of community feedback — DynamoDB point-in-time recovery (PITR) is worth enabling once Infrastructure Design provisions the table, noted here as a recommendation for that stage, not decided now (consistent with donation-unit's own PITR note).
