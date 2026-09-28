# Infrastructure Design — Questions (suggestion-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/suggestion-unit/nfr-design/*.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/suggestion-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md`

Region and environment strategy are already fixed project-wide (auth-unit's Infrastructure Design) and carry forward unchanged. This Unit's own NFR Design already fully specified its infrastructure-relevant decisions — the `allSuggestions` Lambda-backed resolver (Scan-loop + sort, closing the 1MB-cap risk), the `SuggestionDailyCount` TTL rate-limiter table. No genuinely new decision remains open for a human to make; this stage's job is concrete Lambda sizing (an engineering sizing call, not a preference) and restating the already-fixed design as AWS resource configuration.

## Consolidated Summary Confirmation

- Region and environments: inherited unchanged from auth-unit's Infrastructure Design (`ap-south-1`, Amplify Hosting git-branch model).
- `allSuggestions` Lambda: sized at 256MB/30s (bounded by the ~1500-suggestion, ~3MB-worst-case 12-month ceiling NFR Design already established — comfortably inside a 30s timeout for a handful of internal Scan pages).
- `submitSuggestion` (re-corrected at this stage's review): also Lambda-backed, 128MB/5s — a prior "custom AppSync JS pipeline resolver" design was found unachievable (Amplify Gen2's `a.handler.custom()` binds to one data source per step; a genuine two-table pipeline would need an unspecified array of per-data-source handlers with stash-based data flow). Its IAM role: conditional `UpdateItem` on `SuggestionDailyCount`, `PutItem` on `Suggestion`, and `cloudwatch:PutMetricData` (used to emit the `suggestion-count` metric directly, replacing a previously-proposed CloudWatch Logs metric-filter workaround that's no longer needed now that a Lambda has full SDK access).
- `Suggestion` and `SuggestionDailyCount` DynamoDB tables: on-demand capacity, AWS-managed encryption; `SuggestionDailyCount` has the TTL attribute enabled per NFR Design's formula.
- No CDN, no queue, no other infrastructure service.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
