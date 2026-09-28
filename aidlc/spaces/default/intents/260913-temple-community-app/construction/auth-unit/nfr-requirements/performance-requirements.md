# Performance Requirements — auth-unit

## NFR1.1 — Sign-in round trip

| Field | Value |
|---|---|
| Metric | Time from tapping "Sign in with Google" to the app receiving a valid Cognito ID token |
| Target | < 3 seconds |
| Percentile | p95 |
| Load condition | Normal usage — this app never has more than a few concurrent sign-ins at once (300-1000 person community) |
| Measurement method | Client-side timer around the Amplify Auth sign-in call, on a typical mobile connection |

This target is dominated by Google's own OAuth redirect and consent flow, not by anything AuthUnit/Cognito controls directly — Cognito's own token-issuance step is sub-second. No caching or connection-pooling optimization applies here; there is nothing in this Unit's own control path slow enough to warrant one.

## NFR1.2 — Admin-status check latency

| Field | Value |
|---|---|
| Metric | Time for a consuming Unit (FeedUnit, PdfLibraryUnit, SuggestionUnit) to evaluate `cognito:groups` contains "Admin" (BR1.2) |
| Target | Negligible — < 5ms |
| Percentile | N/A — a design property, not a runtime SLO |
| Load condition | Any request rate this app sees |
| Measurement method | Not runtime-instrumented and not intended to be; this is an in-memory JWT claim check with no network call or database lookup, verified by code/design review rather than measured in production |

## Out of scope

No throughput or resource-utilization target is set for this Unit — AuthUnit issues no requests of its own beyond what Cognito's hosted UI already handles, and this app's traffic volume (a few hundred people, intermittent usage) never approaches a scale where AuthUnit's own performance is a bottleneck.
