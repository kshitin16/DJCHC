# Reliability Requirements — feed-unit

## NFR2.1 — Availability (inherits inception NFR2)

```
SLI: successful listPosts/listAllPostsForAdmin/mutation calls / total attempts
SLO: best-effort, matching Amplify/AWS managed-service availability — no independent SLA (NFR2),
consistent with the rest of this project's posture.
```

## NFR2.2 — Fault tolerance

| Failure | Behavior |
|---|---|
| listPosts query fails (network, backend error) | Plain-language error with retry (functional-spec.md's existing error path); no cached/stale content is silently shown as current |
| A mutation (create/edit/delete) fails mid-request | No partial post is created/updated/deleted — functional-spec.md's existing error paths already state this for each workflow |
| Contract 8's Streams event source is briefly unavailable to ReminderUnit | Out of this Unit's control/scope — FeedUnit's own write to the Post table succeeds or fails independently of whether the downstream stream consumer (ReminderUnit) is currently processing; flagged for Infrastructure Design per Q2 |

## NFR2.3 — Data durability

Post records (including soft-deleted ones, BR2.6) are stored in DynamoDB with AWS's standard managed replication and NFR4's encryption-at-rest. No Unit-specific backup procedure beyond Amplify Data's DynamoDB backing.

## NFR2.4 — Disaster recovery

No RTO/RPO target beyond the project-wide posture (deferred to Infrastructure Design's region choice, per requirements.md's Open Questions).
