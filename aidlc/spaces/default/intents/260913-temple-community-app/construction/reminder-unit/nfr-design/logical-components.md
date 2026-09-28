# Logical Components — reminder-unit

## Component inventory

| Component | Nature | Failure domain |
|---|---|---|
| `Reminder`/`DeviceToken` DynamoDB tables | Data store, shared Amplify Data backend, guest-identity (`allow.guest()`) auth. `Reminder` carries a new GSI on `postId` (added at this stage's review, R-02) for the Contract 8 handler's lookup — see performance-design.md | Shared AWS region/account failure domain |
| AppSync resolvers (myReminders, registerDeviceToken, setRemindersEnabled) | Part of the shared AppSync API, no custom compute beyond direct DynamoDB writes | Shared, same as tables above |
| `snoozeReminder`/`cancelReminder` resolvers | Lambda-backed (not direct AppSync/DynamoDB), since each now also calls the EventBridge Scheduler API (Q1/Q2) in the same operation — a capability a direct VTL resolver doesn't have | This Unit's own compute, isolated from the shared-backend resolvers above |
| Contract 8 event handler Lambda | Standalone Lambda, DynamoDB-Streams-triggered (unchanged from Functional Design) — updates/deletes EventBridge schedules on BR7.9 (PostDeleted) reactions only; BR7.8 (PostDateTimeChanged) was simplified to a no-op at this stage's later review, so the handler no longer reacts to that event type at all | Isolated invocation per stream record |
| `deliver-push` Lambda | Standalone Lambda, EventBridge-Scheduler-triggered (Q1, new this stage) | Isolated per-invocation, one Reminder per fire event |
| `auto-clear` Lambda | Standalone Lambda, EventBridge-Scheduler-triggered (Q1, new this stage) — may be the same Lambda as deliver-push, branching on schedule name, or a separate function; either way a distinct logical responsibility | Isolated per-invocation, one Reminder per clear event |
| EventBridge Scheduler group (dedicated to this Unit) | AWS-managed scheduling primitive, holds up to ~2000 active schedules at this app's 12-month ceiling | Isolated to this Unit — no other Unit creates or reads schedules in this group |

## Blast radius

This is now the Unit with the most distinct compute components in the project (five Lambdas total, once snoozeReminder/cancelReminder's Lambda-backing is counted alongside the pre-existing Contract 8 handler and the two new schedule-triggered Lambdas). Each is independently isolated: a bug in deliver-push affects only push delivery for the specific Reminder it was invoked for, not auto-clear, not the Contract 8 handler, and not any other Unit's data. The EventBridge Scheduler group is likewise isolated to this Unit.

## Shared resources

None shared with another Unit's own components — both tables, all Lambdas, and the EventBridge Scheduler group are exclusively this Unit's. The one cross-Unit read is `listPosts` (Contract 3, feed-unit) and the Contract 8 Streams subscription (feed-unit's table, consumed here) — both already-established boundaries, not new coupling introduced at this stage.
