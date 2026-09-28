# Reliability Design — suggestion-unit

## Design for NFR2.1-2.4 (best-effort availability)

```
Resilience pattern: none beyond existing error+retry — consistent with this project's
  default posture.
Health checks / failover: not applicable — no compute of its own beyond AppSync resolvers.
Data durability: DynamoDB's standard managed replication + NFR4.1 encryption for both
  tables. PITR recommendation (already noted in NFR Requirements, given BR3.4's permanent-
  suggestion stakes) is restated here as an Infrastructure Design action item — applies to
  the Suggestion table only; the SuggestionDailyCount table's TTL-bounded, regenerable
  bookkeeping data does not need PITR.
```

## allSuggestions pagination-loop failure handling

If the resolver's internal DynamoDB pagination loop fails partway through (a transient DynamoDB error on one of several sequential reads), the whole request fails and returns an error to the client — no partial result is returned, consistent with the existing "query fails" error path already specified in functional-spec.md. A retry re-issues the full loop from the start (no resume-from-partial-progress design, since a single admin viewing a suggestion list has no meaningful cost from a full retry at this data volume).
