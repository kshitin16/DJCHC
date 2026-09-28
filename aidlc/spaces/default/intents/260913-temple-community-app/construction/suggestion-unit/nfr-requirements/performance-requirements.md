# Performance Requirements — suggestion-unit

## NFR-PERF.1 — Submit Suggestion latency (Unit-local ID; no inception-level performance NFR names this Unit's request path — see traceability.json)

| Field | Value |
|---|---|
| Metric | Time from submitting text to receiving confirmation (including BR3.5's atomic counter check) |
| Target | < 2 seconds |
| Percentile | p95 |
| Load condition | 4G/LTE-equivalent connection, consistent with feed-unit's/donation-unit's baseline; single-item atomic DynamoDB conditional write plus a Suggestion record write |
| Measurement method | Client-side timer around the AppSync mutation call |

## NFR-PERF.2 — View My Past Suggestions / View All Suggestions (admin) latency

| Field | Value |
|---|---|
| Metric | Time for either list query to return |
| Target | < 2 seconds |
| Percentile | p95 |
| Load condition | Up to ~1500 total suggestions at the 12-month horizon (Q3); `myPastSuggestions` is owner-scoped so any individual user's own list stays small (bounded by BR3.5's 5/day cap × their active days); `allSuggestions` returns the full ~1500-row set at that horizon |
| Measurement method | Client-side timer from query call to first render |

At ~1500 rows, a single DynamoDB scan-and-return for `allSuggestions` is expected to hold the 2s/p95 target without pagination at this app's scale; this should be re-verified if the volume assumption in scalability-requirements.md is ever revised upward.

## Out of scope

No throughput target is set — this app's submission rate (bounded hard by BR3.5's 5/day/user cap, and far lower in typical use) never approaches a scale where this Unit's own performance is a bottleneck.
