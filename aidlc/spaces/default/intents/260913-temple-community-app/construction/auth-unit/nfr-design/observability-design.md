# Observability Design — auth-unit

## Design for NFR-OBS.1-2 (sign-in metrics/logging)

```
Metrics collection: Amplify's client-side Auth Hub events (signedIn, signedOut,
  tokenRefresh_failure, etc.) forwarded to whatever client-side analytics/metrics sink the
  app already uses — no new metrics infrastructure is introduced for this Unit specifically.
Structured logging: sign-in success/failure logged client-side at INFO/WARN per NFR-OBS.2's
  existing spec (subject id only, never raw token contents).
Distributed tracing: not applicable (NFR-OBS.3) — single client-to-Cognito-to-Google hop,
  no internal service-to-service call to trace.
Alerting: none configured (NFR-OBS.4) — consistent with this project's default posture.
Correlation IDs: not needed — this Unit's own request paths involve no cross-service call
  this project instruments internally (Cognito/Google are external, opaque dependencies).
```

## Dashboard

No dedicated dashboard is designed for this Unit at this project's scale — sign-in success/failure counts (NFR-OBS.1) are visible via whatever general CloudWatch/analytics view the app already surfaces, not a bespoke AuthUnit dashboard.
