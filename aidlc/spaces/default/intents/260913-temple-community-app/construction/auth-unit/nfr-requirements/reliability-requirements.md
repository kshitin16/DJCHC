# Reliability Requirements — auth-unit

## NFR2.1 — Availability

```
SLI: successful sign-in completions / total sign-in attempts, measured client-side
SLO: best-effort, matching AWS Cognito's and Google's own published availability — no independent SLA is set (NFR2)
SLA: none — this is a community app with no contractual uptime commitment
```

Per NFR2's own framing, this project deliberately does not set an internal SLO stricter than what its two managed dependencies (Cognito, Google identity) already provide — there is no engineering lever this Unit could pull to exceed either provider's own availability, and no business reason (no revenue SLA, no paying customers) to invest in one.

## NFR2.2 — Fault tolerance

| Failure | Behavior |
|---|---|
| Cognito hosted UI unavailable | Sign-in fails; user sees the existing plain-language error message with retry (functional-spec.md's Sign-In workflow error path) — no fallback identity provider |
| Google federation unavailable | Same as above — Google is the only identity provider; there is no secondary sign-in path by design (BR1.1) |
| Network failure mid-flow | User returns to the Sign In screen; no partial session is created (Cognito issues a token atomically or not at all) |

## NFR2.3 — Data durability

AuthUnit persists no data of its own — durability of identity records (the Cognito user pool itself) is entirely AWS's responsibility, covered by Cognito's own managed-service guarantees. No backup/recovery procedure is defined at this Unit's level.

## NFR2.4 — Disaster recovery

No RTO/RPO target is set for this Unit specifically — a full Cognito user-pool region outage is an Infrastructure Design/operational concern (region choice remains deferred per requirements.md's Open Questions), not something AuthUnit's own functional design or NFRs can mitigate.
