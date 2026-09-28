# Security Design — reminder-unit

## Authorization architecture (NFR-AUTHZ.1, unchanged from NFR Requirements)

No new design decision — guest-identity (`allow.guest()`) authorization on every Contract 9 operation is a schema-level configuration, not an infrastructure resource this stage designs further.

## Push-token registration abuse (NFR-AUTHZ.2, unchanged from NFR Requirements)

No new design decision — the accepted-risk posture (bounded impact, low likelihood of obtaining a real victim token) carries forward unchanged; this stage introduces no additional verification mechanism.

## EventBridge Scheduler IAM design (Q1, Q2)

```
The "deliver-push" and "auto-clear" Lambdas each get a narrowly-scoped IAM execution role:
  - Read/write access to the Reminder table (scoped to GetItem/UpdateItem, not full table
    access) — least-privilege, per this project's Well-Architected posture.
The Contract 8 event handler Lambda's IAM role additionally needs Query access on the new
  postId GSI (performance-design.md, R-02) — scoped to that specific index, not a
  table-wide Scan permission.
  - "deliver-push" additionally needs read access to the DeviceToken table (to resolve the
    push token for the Reminder's ownerIdentityId) and permission to call the push
    provider (APNs/FCM) integration Infrastructure Design selects.
A separate IAM role (scheduler execution role) grants EventBridge Scheduler permission to
  invoke these two Lambdas — least-privilege, scoped to exactly these two functions, not a
  wildcard Lambda-invoke grant.
The mutation resolvers (snoozeReminder, cancelReminder, the Contract 8 event handler) each
  need CreateSchedule/UpdateSchedule/DeleteSchedule permission on the EventBridge Scheduler
  API, scoped to this Unit's own schedule-group (a dedicated EventBridge Scheduler group
  for this Unit's reminder schedules, not the account's default group) — this keeps the
  IAM policy narrow and makes the reminder-schedule inventory independently listable at
  Infrastructure Design/operations time.
```

## Process controls (NFR6.1)

```
Access-boundary rule: only services/reminder_service.dart may call package:amplify_* for
  this Unit's client-side operations.
Change-review trigger: any change to reminder_service.dart, the guest-identity
  authorization configuration, the Contract 8 Lambda's idempotency logic, or the
  EventBridge schedule-creation/update/delete logic (new, added at this stage) gets a
  brief self-review before merging.
```

## Encryption

At rest: AWS-managed DynamoDB encryption (NFR4.1). In transit: TLS 1.2+ on the AppSync endpoint and on every EventBridge/Lambda API call (all AWS-internal, TLS by default). No custom configuration needed.
