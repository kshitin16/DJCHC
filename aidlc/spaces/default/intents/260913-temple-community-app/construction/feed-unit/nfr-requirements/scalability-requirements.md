# Scalability Requirements — feed-unit

## NFR-SC.1 — Capacity growth (Unit-local ID; no inception-level scalability NFR exists to derive this from — see traceability.json)

```
Current baseline: 0 posts (pre-launch)
6-month actual-data projection: ~100 posts created total (cumulative, a handful per week); all
still non-aged-out or only recently aged-out at this early stage, so the active (non-aged-out)
count roughly tracks the total
12-month actual-data projection: ~500 posts created total (cumulative — soft-deleted posts are
retained forever per BR2.6, so this only grows); active (non-aged-out) count at any single moment
stays low (typically 5-20, since BR2.4 excludes anything more than 1 day past its dateTime) —
the ~500 figure is a TOTAL-rows count the admin view (BR2.7, unfiltered) will actually reach, not
a non-aged-out count
Readers: up to ~250 within 6 months, ~1000 within 12 months (a quarter to full community, per the
adoption goal)
Growth model: Linear, bounded by admin posting cadence and community size — not viral
Scaling approach: None required beyond Amplify Data/AppSync's own managed elasticity
Cost constraint: Stays near the AWS free tier at this scale
Degradation policy: N/A — no capacity limit this Unit's traffic could realistically approach
```

Note: Q1's "~200 non-aged-out posts" figure (used in `performance-requirements.md`'s NFR1.1/NFR1.2 load condition) is a conservative TEST/measurement ceiling for the public feed's latency budget — not an actual-data projection. The two are kept separate here after this stage's review (R-02) caught them being conflated into a single, internally-impossible row (200 non-aged-out posts cannot exist when only 100 total posts exist).

## Data growth

Soft-deleted posts (BR2.6) are retained indefinitely — no purge mechanism exists in this Unit's design. At this app's posting cadence, this stays a trivial storage cost for years; no archival/cold-storage tiering is warranted at this scale.
