# NFR Design — Questions (suggestion-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/suggestion-unit/nfr-requirements/*.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/suggestion-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 1, 2, 4)

NFR Requirements' review disclosed a real risk (not fixed at that stage): `allSuggestions`' <2s/p95 claim assumes a single unpaginated DynamoDB read holds at the ~1500-suggestion 12-month ceiling, but doesn't account for DynamoDB's 1MB per-request response cap against the actual byte volume (up to ~3MB worst-case at 300 words/suggestion). This is the natural stage to close that.

## Q1. Closing the disclosed 1MB-response-cap risk for `allSuggestions`: how should this Unit's design actually handle it?

- A. Design `allSuggestions`' resolver to handle DynamoDB's internal pagination transparently — a single query response exceeding 1MB returns a `LastEvaluatedKey`, and the resolver loops internally (multiple DynamoDB reads within one resolver invocation) until the full result set is assembled, then returns the complete list to the client in one GraphQL response. This closes the risk without changing Contract 4's public API shape (still returns `[Suggestion!]!` with no pagination arguments) — the complexity is contained entirely server-side. (Recommended)
- B. Add real GraphQL-level pagination to Contract 4 (`nextToken` argument) — a breaking schema change
- X. Other (please specify)

[Answer]: A. Resolver loops internally through DynamoDB's own pagination.

## Q2. SuggestionDailyCount cleanup: this atomic per-user-per-day counter (BR3.5) is a new record created daily per active user — should old counter items be cleaned up automatically?

- A. Yes — a DynamoDB TTL attribute set to expire each SuggestionDailyCount item ~48 hours after its IST date (safely past the day it's relevant for), so old counters are deleted automatically at no write cost (TTL deletions are free). Standard cost-hygiene practice for a bookkeeping record with a naturally short useful life. (Recommended)
- B. Skip this — specify why
- X. Other (please specify)

[Answer]: A. DynamoDB TTL, ~48h.

## Consolidated Summary Confirmation

- `allSuggestions`' resolver internally loops through DynamoDB's own pagination (LastEvaluatedKey) to assemble the complete result server-side, closing the 1MB-response-cap risk without changing Contract 4's public API shape.
- SuggestionDailyCount items get a DynamoDB TTL attribute (~48h past their IST date) for automatic, free cleanup.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
