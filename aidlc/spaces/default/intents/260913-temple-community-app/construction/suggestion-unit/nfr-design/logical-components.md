# Logical Components — suggestion-unit

## Component inventory

| Component | Nature | Failure domain |
|---|---|---|
| `Suggestion` DynamoDB table | Data store, shared Amplify Data backend, permanent (BR3.4) | Shared AWS region/account failure domain, same as every other Unit's tables |
| `SuggestionDailyCount` DynamoDB table | Data store, TTL-bounded (Q2) | Same shared failure domain; independently regenerable data (a lost counter just means a user's daily cap resets, no permanent-data-loss consequence) |
| `myPastSuggestions` resolver | Part of the shared AppSync API, with a declarative owner-scoped auth rule; direct VTL/DynamoDB resolver, no custom compute | Shared, same as the tables above |
| `submitSuggestion` resolver | Amended at Infrastructure Design (review fix): a dedicated Lambda function, NOT a direct AppSync/DynamoDB resolver — its 300-word validation, atomic conditional-write rate limiter (BR3.5), and `Suggestion` write span two DynamoDB tables and a custom-metric emission, which a generated direct resolver cannot perform (an earlier custom-JS-pipeline-resolver alternative was also found unachievable, since Amplify Gen2's per-step single-data-source binding can't span two tables either). Still gated by Contract 1's signed-in-identity auth rule at the AppSync layer in front of it. | Now dedicated compute — its own isolated failure domain, own IAM role (conditional-write on `SuggestionDailyCount`, write on `Suggestion`, `cloudwatch:PutMetricData`), own timeout/cold-start characteristics, sized at Infrastructure Design (128MB/5s) |
| `allSuggestions` resolver | A dedicated Lambda function (added at this stage's review, R-02) — NOT a direct AppSync/DynamoDB resolver, since looping over `LastEvaluatedKey` across multiple internal Scan calls within one GraphQL response requires custom compute. Still gated by Contract 2's `allow: groups` auth rule at the AppSync layer in front of it. | This Unit's first dedicated compute — isolated failure domain, own IAM role (read-only on the Suggestion table), own timeout/cold-start characteristics to size at Infrastructure Design/Code Generation time |

## Blast radius

The two tables and the `myPastSuggestions` resolver are part of the shared Amplify Data/AppSync backend — no dedicated compute, no isolated deployable. `submitSuggestion` (amended at Infrastructure Design) and `allSuggestions` are this Unit's two pieces of dedicated compute (comparable to donation-unit's own two Lambdas) — a bug or timeout in either affects only that one operation's path (the write path for `submitSuggestion`, the admin-read path for `allSuggestions`), not the other Lambda, not `myPastSuggestions`, and not any other Unit's data.

## Shared resources

None shared with another Unit's own components — both tables are exclusively this Unit's.
