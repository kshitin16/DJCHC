# Scalability Design — pdf-library-unit

## Design for NFR-SC.1 (~50-75 documents, low single-digit GB, 12mo ceiling)

```
Compute: AppSync resolvers, scale automatically.
Data (metadata): DynamoDB on-demand capacity mode.
Data (files): S3 — effectively unlimited storage scaling, no design decision needed beyond
  the lifecycle rule (Q3) and bucket configuration (security-design.md).
```

No partitioning, CDN (Q2), or horizontal-scaling decision applies — S3 + DynamoDB on-demand comfortably covers this Unit's entire projected lifetime volume without any capacity planning.
