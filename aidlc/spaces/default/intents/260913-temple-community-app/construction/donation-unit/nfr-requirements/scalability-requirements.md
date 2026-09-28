# Scalability Requirements — donation-unit

## NFR-SC.1 — Capacity growth (Unit-local ID; no inception-level scalability NFR exists to derive this from — see traceability.json)

```
Current baseline: 0 donations (pre-launch; FR5 is a later release, blocked on FR5.4's
tax-exemption/aggregator-KYC precondition)
6-month target: a modest fraction of a 300-1000 person community giving intermittently — tens,
not thousands, of donations per month
12-month target: same order of magnitude, possibly including some RECURRING mandates
Growth model: Linear, bounded by community size and typical giving frequency (festivals, specific
appeals) — not viral
Scaling approach: None required beyond Amplify Data/AppSync's own managed elasticity; DynamoDB
scales far beyond this Unit's ceiling on-demand
Cost constraint: Stays near the AWS free tier at this scale
Degradation policy: N/A — no capacity limit this Unit's traffic could realistically approach
```

## Concurrency

No specific concurrent-initiation target is set — the aggregator's own checkout-session API is the actual bottleneck in the Initiate Donation path (NFR-PERF.1), and it handles far more concurrency than this app's traffic could generate.
