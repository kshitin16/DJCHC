# Observability Design — suggestion-unit

## Metrics/logging architecture (NFR-OBS.1-2)

```
CloudWatch metrics: standard AppSync resolver built-ins (call count/latency) for submit/
  myPastSuggestions/allSuggestions.
Business metric: suggestion count over time — a custom CloudWatch metric emitted from the
  submitSuggestion resolver (increment only; BR3.4 means no delete path exists to
  decrement), the same running-total pattern established for feed-unit's post count and
  pdf-library-unit's document count.
Structured logging: per NFR-OBS.2's existing spec (submitter+timestamp on submit, 5/day
  cap hits, 300-word-limit refusals) via AppSync's CloudWatch Logs integration.
```

## Unauthorized-access visibility (NFR-OBS.4, unchanged from NFR Requirements)

No new design decision — AppSync's own CloudWatch access logs (an API-level setting) remain the sole visibility mechanism for declarative-auth refusals, as already established.

## Alerting (NFR-OBS.5)

None configured — consistent with this project's default posture.

## Tracing (NFR-OBS.3)

Not applicable — each request path is a single AppSync-to-DynamoDB hop (or, for allSuggestions, a small bounded number of sequential hops within one resolver invocation).
