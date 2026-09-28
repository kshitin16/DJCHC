# Scalability Requirements — reminder-unit

## NFR-SC.1 — Capacity growth (Unit-local ID; no inception-level scalability NFR exists to derive this from — see traceability.json)

```
Current baseline: 0 Reminders/DeviceTokens (pre-launch)
6-month target: up to ~250 registered devices (a quarter of the community, per the adoption
goal); each device holds roughly one Reminder per active Event post it has synced since — bounded
by however many non-aged-out Event posts exist at once (this Unit's own working assumption is
~200, consistent with but not independently verified against feed-unit's own sizing per this
review's per-unit scope — R-04), so a single device's Reminder count stays small (realistically
single digits to low tens, not hundreds)
12-month target: up to ~1000 registered devices, same per-device Reminder count characteristics
Growth model: Linear, bounded by community size (device registrations) and event cadence
(Reminder creation) — not viral
Scaling approach: None required beyond Amplify Data/AppSync's own managed elasticity; the Contract
8 Lambda's own concurrency scales automatically with DynamoDB Streams' event-source mapping
Cost constraint: Stays near the AWS free tier at this scale; push notification sends themselves
are free at both APNs and FCM regardless of volume
Degradation policy: N/A — no capacity limit this Unit's traffic could realistically approach
```

## Push delivery volume

At the 12-month ceiling (~1000 devices), the daily push volume is bounded by how many distinct Event posts have a fire time on any given day — realistically a handful per day at most for a single temple's admin-posted content, multiplied by however many of those ~1000 devices have a live Reminder for that specific post. This stays orders of magnitude below any APNs/FCM rate limit.
