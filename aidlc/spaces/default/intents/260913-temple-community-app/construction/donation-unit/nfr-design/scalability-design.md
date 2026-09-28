# Scalability Design — donation-unit

## Design for NFR-SC.1 (~1500 donations/12mo ceiling)

```
Compute: AppSync resolver + two Lambdas (webhook receiver, scheduled reconciliation poller)
  — all three scale automatically with AWS's own managed concurrency; no provisioned
  capacity or manual scaling configuration is needed at this volume.
Data: DynamoDB on-demand capacity mode (matches this project's low, unpredictable traffic
  pattern — see cost-optimization guidance: on-demand is preferred over provisioned for
  new tables with unpredictable, low-volume access, which describes every table in this
  project).
Scheduled poller frequency (Q2, ~1-minute EventBridge Scheduler cadence): scans a small
  number of PENDING Donations per run (never more than a handful at this app's scale) — no
  pagination or batching design is needed for the scan itself.
```

No horizontal/vertical scaling decision, load balancer, or partitioning strategy applies beyond what's already inherent to the chosen serverless/managed services.
