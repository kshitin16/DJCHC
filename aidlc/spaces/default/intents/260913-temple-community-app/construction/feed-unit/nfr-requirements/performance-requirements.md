# Performance Requirements — feed-unit

## NFR1.1 — List Posts (public feed) latency (inherits inception NFR1 — this Unit is NFR1's primary owner)

| Field | Value |
|---|---|
| Metric | Time from the reader opening the feed to seeing rendered content |
| Target | < 2 seconds |
| Percentile | p95 |
| Load condition | 4G/LTE-equivalent connection (~5-10 Mbps, 50-150ms latency); feed holding up to ~200 non-aged-out posts (Q1) |
| Measurement method | Client-side timer from `listPosts()` call to first render, on a typical mobile connection profile |

The budget covers the full round trip: the `listPosts` query, BR2.4's server-side age-out filter, and client render — not just the network call in isolation.

## NFR1.2 — Admin management view (listAllPostsForAdmin / getPost) latency

| Field | Value |
|---|---|
| Metric | Time for the admin post-management list or a single post lookup to return |
| Target | < 2 seconds |
| Percentile | p95 |
| Load condition | Distinct from NFR1.1's load condition, corrected at this stage's review (R-03): `listAllPostsForAdmin` returns every non-deleted post with no age-out filter (BR2.7), so it grows toward this Unit's own 12-month cumulative projection of ~500 rows (scalability-requirements.md NFR-SC.1) — not the ~200-post ceiling used for the public feed's NFR1.1 |
| Measurement method | Same as NFR1.1, but measured against a ~500-row dataset at the 12-month horizon rather than ~200 |

The `< 2s @ p95` target is expected to hold at 500 rows for a single-query DynamoDB scan-and-return at this data size, but is not validated against pagination — `getPost(id)` (a single-item lookup) is unaffected by row count regardless. If actual admin-view usage or row count ever grows meaningfully past this project's current scale, `listAllPostsForAdmin` would need pagination added to `rules.md`/`functional-spec.md` (a Functional Design change, not decided at this stage) — flagged here as a forward-looking note, not a currently-missing requirement at this app's projected scale.

## NFR1.3 — Create/Edit/Delete Post latency

| Field | Value |
|---|---|
| Metric | Time from an admin submitting a mutation to receiving confirmation |
| Target | < 2 seconds |
| Percentile | p95 |
| Load condition | Single admin, single mutation at a time — this app has no concurrent-admin-editing scenario at its scale |
| Measurement method | Client-side timer around the AppSync mutation call |

## Out of scope

No throughput target is set — a temple community's admin content-posting rate (a handful of posts per week at most) and reader volume (a few hundred people, intermittent) never approach a scale where this Unit's own performance is a bottleneck.
