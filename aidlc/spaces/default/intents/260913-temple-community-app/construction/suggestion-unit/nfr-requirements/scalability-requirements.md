# Scalability Requirements — suggestion-unit

## NFR-SC.1 — Capacity growth (Unit-local ID; no inception-level scalability NFR exists to derive this from — see traceability.json)

```
Current baseline: 0 suggestions (pre-launch)
6-month actual-data projection: a few hundred suggestions (a fraction of a growing, up-to-250-
reader community engaging occasionally, not daily)
12-month conservative ceiling: up to ~1500 suggestions (Q3) — this is community size × BR3.5's
5/day cap as an upper bound, NOT an expected average; realistic typical use is closer to one
suggestion per active user over months
Growth model: Linear, bounded by community size and engagement — not viral
Scaling approach: None required beyond Amplify Data/AppSync's own managed elasticity
Cost constraint: Stays near the AWS free tier at this scale
Degradation policy: N/A — no capacity limit this Unit's traffic could realistically approach
```

## Data growth

BR3.4 means suggestions are never deleted — the total count only grows over the app's lifetime. At this app's scale (a single temple community, not a multi-tenant SaaS), even years of accumulation stays a trivial DynamoDB storage cost; no archival/purge mechanism is warranted.
