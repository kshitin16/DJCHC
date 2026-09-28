# Scalability Requirements — auth-unit

## NFR-SC.1 — Capacity growth (Unit-local ID; no inception-level scalability NFR exists to derive this from — see traceability.json)

```
Current baseline: 0 users (pre-launch)
6-month target: up to ~250 signed-in identities (a quarter of a 300-1000 person community, per requirements.md's adoption goal), intermittent usage
12-month target: up to ~1000 signed-in identities, still intermittent (a temple community app has no sustained high-concurrency traffic pattern)
Growth model: Linear, bounded by the community's own size — not viral/exponential
Scaling approach: None required beyond Cognito's own managed elasticity — a Cognito User Pool scales transparently far beyond this app's ceiling
Cost constraint: Stays within (or very near) the AWS free tier at this scale, per requirements.md's assumption
Degradation policy: N/A — there is no capacity limit this app's traffic could realistically approach
```

## Concurrency

No specific concurrent-sign-in target is set. Cognito's hosted UI and token-issuance endpoints handle orders of magnitude more concurrent traffic than a few hundred intermittent users could ever generate; this Unit adds no custom scaling mechanism (no queue, no custom autoscaling group) because none is needed.

## Data growth

AuthUnit persists no data of its own (see `entities.md`) — the user pool's identity records grow linearly with community membership, well within Cognito's own limits at this scale.
