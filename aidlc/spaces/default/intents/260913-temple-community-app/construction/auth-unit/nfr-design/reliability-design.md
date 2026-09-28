# Reliability Design — auth-unit

## Design for NFR2.1-2.4 (best-effort availability)

```
Resilience pattern: none beyond the client's existing error+retry (Q1, confirmed — no
  circuit breaker; Cognito/Google's own managed-service reliability is the effective
  availability ceiling, and this project does not attempt to engineer above it).
Health checks: not applicable — this Unit deploys no compute of its own to health-check;
  Cognito's own service health is outside this project's control or monitoring scope.
Failover: none designed — there is no secondary identity provider (BR1.1) and no secondary
  Cognito User Pool; a Cognito regional outage is an accepted, undesigned-around risk at
  this project's scale and budget.
Data replication/backup: Cognito manages its own User Pool durability; no project-level
  backup procedure applies (AuthUnit persists no data of its own).
```

## Graceful degradation

If sign-in is unavailable, the app remains partially usable: Feed, PDF Library, and Calendar (all public-read) continue to function without a signed-in session, per FR1.3/FR2.6's public-read design — sign-in failure degrades the app to its public-only surface rather than becoming fully unusable. This is a property of the overall app's screen-access design (flutter-app-unit), not a mechanism AuthUnit itself implements, but is worth naming here since it is the actual resilience characteristic Cognito unavailability produces.
