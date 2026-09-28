# Scalability Design — reminder-unit

## Design for NFR-SC.1 (~1000 devices, 12mo ceiling)

```
Compute: AppSync resolvers plus three Lambdas (Contract 8 event handler, deliver-push,
  auto-clear) — all scale automatically with AWS's managed concurrency.
Data: DynamoDB on-demand capacity for both Reminder and DeviceToken tables.
EventBridge Scheduler capacity: AWS's default account limits comfortably exceed this
  app's projected schedule count (at most ~2000 active schedules — two per Reminder, at
  the ~1000-device x handful-of-events-each ceiling — far below EventBridge Scheduler's
  own default per-account schedule limits). No request for a limit increase is needed at
  this scale.
```

No partitioning, sharding, or horizontal-scaling decision applies beyond the above — this Unit's entire projected lifetime volume is comfortably covered by serverless defaults with no capacity planning.
