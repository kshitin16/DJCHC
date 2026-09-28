# Performance Design — suggestion-unit

## Design for NFR-PERF.1 (Submit Suggestion, <2s p95)

```
Path: AppSync mutation -> resolver -> atomic DynamoDB conditional UpdateItem
  (SuggestionDailyCount, BR3.5) -> DynamoDB write (Suggestion record) -> return. Two
  sequential single-item DynamoDB operations, both low-single-digit-millisecond — well
  within budget.
```

## Design for NFR-PERF.2 (View queries, <2s p95)

```
myPastSuggestions: owner-scoped DynamoDB query (via the declarative allow.owner rule) —
  bounded result set per user (BR3.5's cap keeps any one user's total small), no pagination
  needed.
allSuggestions: corrected at this stage's review (Q1, further corrected at R-01) — the
  Suggestion entity has only a single UUID primary key (id), no GSI defined anywhere in
  this project, so enumerating every row is necessarily a table **Scan** (matching what
  nfr-requirements/performance-requirements.md itself already said — "a single DynamoDB
  scan-and-return"), not a Query. This is implemented as a Lambda-backed AppSync resolver
  (a direct VTL/DynamoDB resolver can invoke its data source only once per call, which
  cannot loop; see logical-components.md's new Lambda entry, added at R-02) that:
    1. Issues repeated Scan calls following LastEvaluatedKey until the full table has been
       read (closing the disclosed 1MB-response-cap risk at the ~1500-suggestion,
       ~3MB-worst-case 12-month ceiling — multiple fast internal reads assembled before
       any response is returned).
    2. Sorts the fully-assembled result set by submittedAt descending in-memory inside the
       Lambda, before returning it — Scan gives no ordering guarantee on its own, so this
       explicit sort step is what actually produces the "newest first" ordering
       functional-spec.md's View All Suggestions workflow (step 2) and BR3.6 require.
  Contract 4's public shape is unchanged — allSuggestions still returns [Suggestion!]! with
  no pagination argument; both the scan-loop and the sort are entirely server-side.
```

## Design for the TTL cleanup mechanism (Q2)

DynamoDB TTL deletions are free and asynchronous — they impose no additional latency on any request path, including Submit Suggestion's own conditional-write check (TTL expiry happens independently of the item still being readable/writable up until AWS's own background sweep, which per BR3.5's ~48h TTL window occurs well after the item's relevant day has passed).
