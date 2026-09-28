# Performance Design — feed-unit

## Design for NFR1.1 (public listPosts, <2s p95)

```
Path: AppSync query -> resolver -> DynamoDB query (non-deleted, age-out filter applied
  server-side) -> return
Caching (Q1, confirmed): none — a direct DynamoDB query already meets the target at this
  app's ~200-active-post volume. No AppSync response cache, no CDN, no application-level
  cache. This avoids the staleness-management cost (cache invalidation on every admin edit)
  that a cache would introduce for no latency benefit at this scale.
```

## Design for NFR1.2 (admin management view, <2s p95 at ~500-row 12mo ceiling)

```
Path: same shape as NFR1.1 but via listAllPostsForAdmin (no age-out filter, per BR2.7) —
  a single DynamoDB query/scan, no pagination designed at this stage. Corrected at this
  stage's review (R-04): the <2s/p95 target is NOT validated against pagination at the
  ~500-row 12-month ceiling this design targets — nfr-requirements/performance-requirements.md
  states this explicitly as an unresolved, forward-looking flag, not a settled "well past
  current scale" conclusion. This design stage does not close that gap either; it remains
  an open follow-up item for whoever implements this Unit to watch, and pagination should
  be added if actual row counts approach the ~500 ceiling and latency degrades.
```

## Design for NFR1.3 (Create/Edit/Delete Post, <2s p95)

```
Path: AppSync mutation -> resolver -> single-item DynamoDB write -> return. No async
  processing, no queue — a single admin performing a single mutation at a time has no
  throughput concern to design around.
```

No resource pooling, lazy loading, or pagination pattern is introduced — this Unit's read/write volume never approaches a scale where any of them would change the measured latency.
