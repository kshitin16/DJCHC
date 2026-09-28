# Reliability Design — feed-unit

## Design for NFR2.1-2.4 (best-effort availability)

```
Resilience pattern: none beyond existing client error+retry — no circuit breaker, no
  fallback data source. Consistent with this app's default posture (established at
  auth-unit's NFR Design).
Health checks: not applicable — no long-running compute this Unit owns.
Failover: none — a single DynamoDB table, single AppSync API; no secondary region or
  replica designed at this scale.
Data replication/backup: DynamoDB's standard managed replication plus NFR4.1's
  encryption-at-rest; no project-level backup procedure beyond these managed defaults.
```

## Contract 8 delivery reliability

DynamoDB Streams' own at-least-once delivery guarantee (24-hour retention, per NFR Requirements' Q2 flag to Infrastructure Design) is the reliability mechanism for Contract 8's events reaching ReminderUnit — no additional retry/dead-letter design is introduced by FeedUnit itself; the event-source-mapping's own retry behavior (owned by ReminderUnit's infrastructure, per Q2) is downstream of this Unit's responsibility.
