# Scalability Design — suggestion-unit

## Design for NFR-SC.1 (~1500 suggestions, 12mo ceiling)

```
Compute: AppSync resolvers, scale automatically.
Data: DynamoDB on-demand capacity mode for both the Suggestion table and the
  SuggestionDailyCount table.
allSuggestions is a dedicated Lambda-backed resolver (corrected at R-01/R-02, not a direct
  AppSync/DynamoDB resolver — see logical-components.md), since its internal Scan-and-sort
  loop (performance-design.md) requires custom compute that a direct resolver cannot
  provide. This Unit's own scalability ceiling for the admin list is therefore bounded by
  that Lambda's execution timeout, not DynamoDB's 1MB response cap — a materially higher
  ceiling than the unpaginated design NFR Requirements originally assumed.
SuggestionDailyCount TTL (Q2): keeps this table's counters bounded to roughly 2 days' worth
  of read-visible (queryable) items at any time — TTL-expired items are excluded from any
  Scan/Query the instant they pass their `ttl` epoch, regardless of when AWS's background
  sweep physically deletes them (corrected at this stage's review, R-04: the actual billed
  storage footprint can run up to ~4 days, since the `ttl` value itself is already up to 48h
  past an item's IST midnight, and AWS's own sweep can take up to a further 48h beyond that
  — see security-design.md's Rate limiting design). This bound applies to query/read
  behavior, not physical storage size; either way, growth stays bounded rather than
  unbounded, which is this design's actual point relative to the Suggestion table's own
  permanent (BR3.4) growth.
```

No partitioning or sharding decision applies beyond the above — a single DynamoDB table per entity, on-demand capacity, comfortably covers this Unit's entire projected lifetime volume.
