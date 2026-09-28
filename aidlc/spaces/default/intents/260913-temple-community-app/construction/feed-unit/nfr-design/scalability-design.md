# Scalability Design — feed-unit

## Design for NFR-SC.1 (~500 total posts, ~200 active, 12mo ceiling)

```
Compute: AppSync resolvers, scale automatically with AWS's managed concurrency.
Data: DynamoDB on-demand capacity mode — matches this Unit's low, admin-driven write
  pattern (a handful of posts per week) and intermittent, low-volume read pattern; no
  provisioned-capacity planning needed.
Streams: default DynamoDB Streams throughput (Q2) is far beyond what this Unit's write
  rate could ever approach.
```

No partitioning, sharding, or horizontal-scaling decision applies — a single DynamoDB table with on-demand capacity comfortably covers this Unit's entire projected lifetime volume.
