# Scalability Requirements — pdf-library-unit

## NFR-SC.1 — Capacity growth (Unit-local ID; no inception-level scalability NFR exists to derive this from — see traceability.json)

```
Current baseline: 0 documents (pre-launch)
6-month actual-data projection: ~20-30 documents across the 3 fixed categories (daily poojan
texts, vidhaans, bhaktamar) — a religious-text library grows slowly and deliberately, not by
continuous high-frequency posting like the feed
12-month actual-data projection: ~50-75 documents; each up to 50MB (Q3's working ceiling), so
total S3 storage stays in the low single-digit GB range even at the high end
Growth model: Linear and slow — bounded by how much of the temple's existing physical/digital
document collection gets digitized and uploaded, not by community size
Scaling approach: None required beyond Amplify Data (DynamoDB) + S3's own effectively unlimited
storage elasticity
Cost constraint: Stays near the AWS free tier for DynamoDB; S3 storage cost at this volume
(a few GB) is negligible (well under $1/month at standard S3 pricing)
Degradation policy: N/A — no capacity limit this Unit's traffic or storage could realistically
approach
```

## Concurrency

No specific concurrent-upload/download target is set — a single admin manages uploads (BR6.3), and public download concurrency is bounded by this app's overall reader base (a few hundred people, intermittent), well within S3's own massive concurrent-request capacity.
