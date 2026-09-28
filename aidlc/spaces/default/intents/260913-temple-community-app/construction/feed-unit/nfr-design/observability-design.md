# Observability Design — feed-unit

## Metrics/logging architecture (NFR-OBS.1-2)

```
CloudWatch metrics: standard AppSync resolver built-ins (request count, latency, error
  rate) for listPosts/listAllPostsForAdmin/create/update/delete.

  Business metric (NFR-OBS.1's "post count over time"): NOT the same signal as call count
  (corrected at this stage's review, R-03) — call count doesn't net out deletes or isolate
  successful creates from failed attempts. This is derived instead as a custom CloudWatch
  metric emitted from the createPost/deletePost resolvers (increment on a successful
  create, decrement on a successful delete), giving a genuine running total distinct from
  request-volume metrics. This is the one custom metric this Unit's observability design
  introduces, specifically because the built-in request-count metrics do not satisfy
  NFR-OBS.1's business-metric requirement on their own.
Structured logging: resolver-level logging (who/when/what changed for mutations, per
  NFR-OBS.2's existing spec) via AppSync's own CloudWatch Logs integration, enabled at the
  API level (a standard Amplify Data/AppSync configuration flag, not custom code).
```

## Alerting (NFR-OBS.4)

None configured — consistent with this project's default posture (established at auth-unit and confirmed for donation-unit as the one deliberate exception).

## Tracing (NFR-OBS.3)

Not applicable — each request path is a single AppSync-to-DynamoDB hop.
