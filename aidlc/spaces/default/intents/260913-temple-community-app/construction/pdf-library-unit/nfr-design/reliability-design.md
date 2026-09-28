# Reliability Design — pdf-library-unit

## Design for NFR2.1-2.4 (best-effort availability)

```
Resilience pattern: none beyond existing client error+retry — consistent with this
  project's default posture.
Health checks / failover: not applicable — no compute of its own to health-check; S3 and
  DynamoDB are both fully managed, no secondary region designed.
```

## Data durability

```
S3 provides 11-nines object durability by default — no additional design needed.
DynamoDB (Document metadata): standard managed replication + NFR4.1 encryption.
S3 Versioning: OFF, committed for this Bolt (security-design.md, corrected at R-03) —
  BR6.4's hard delete is intentional (no undo feature this release), and Versioning would
  silently undermine that documented "hard delete, nothing retained" semantics. Revisiting
  this trade-off (e.g. to add an accidental-delete safety net) is a forward-looking
  Infrastructure Design decision that would require its own amendment to BR6.4, not an
  ambiguous current-state setting.
```

## Delete-ordering reliability (BR6.4)

The recoverable failure state BR6.4 already defines (S3 removed, record-removal retried) needs no additional design here — it's a functional-design-level retry contract, not an infrastructure resilience pattern this stage adds to.
