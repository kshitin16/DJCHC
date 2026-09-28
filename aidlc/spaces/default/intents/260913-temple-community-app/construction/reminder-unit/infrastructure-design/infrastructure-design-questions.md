# Infrastructure Design — Questions (reminder-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/reminder-unit/nfr-design/*.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/reminder-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md`

Region and environment strategy are already fixed project-wide (auth-unit's Infrastructure Design) and carry forward unchanged. This Unit's own NFR Design already fully specified its EventBridge Scheduler architecture, Lambda topology (5 Lambdas: `snoozeReminder`/`cancelReminder` resolvers, the Contract 8 event handler, `deliver-push`, `auto-clear`), IAM scoping intent, and the new `postId` GSI on `Reminder`. One genuinely open decision remains, explicitly flagged by security-design.md as deferred to this stage: which push notification provider `deliver-push` integrates with.

## Q1. Push notification provider: security-design.md defers "permission to call the push provider (APNs/FCM) integration Infrastructure Design selects" to this stage. flutter-app-unit's own tech-stack-decisions.md already uses Firebase (Crashlytics) client-side. What provider should `deliver-push` integrate with?

- A. Firebase Cloud Messaging (FCM) — a single unified API that delivers to both iOS and Android (`DevicePlatform.IOS`/`ANDROID`, Contract 9), relaying to APNs automatically on iOS rather than requiring a separate direct-APNs integration. Reuses the same Firebase project already established for Crashlytics (flutter-app-unit, Q3) — no new third-party account to create. The `deliver-push` Lambda calls FCM's HTTP v1 API using a Firebase service-account credential, not a stored device-specific APNs certificate. (Recommended)
- B. Direct APNs (iOS) + a separate provider for Android — specify why a unified FCM approach doesn't fit
- X. Other (please specify)

[Answer]: A. Firebase Cloud Messaging (FCM), reusing the existing Firebase project.

## Consolidated Summary Confirmation

- Region and environments: inherited unchanged from auth-unit's Infrastructure Design (`ap-south-1`, Amplify Hosting git-branch model).
- Push provider: Firebase Cloud Messaging (FCM), one unified integration for both platforms, reusing the existing Firebase project (flutter-app-unit's Crashlytics). The `deliver-push` Lambda authenticates to FCM via a Firebase service-account credential stored in Secrets Manager.
- Compute: 6 Lambdas — `myReminders` (added at this stage's review: its sync path creates two EventBridge schedules per new Reminder, which a direct resolver can't do), `snoozeReminder`/`cancelReminder` (mutation resolvers, now also with a `GetItem` read for status-dependent branching), Contract 8 event handler (DynamoDB-Streams-triggered), `deliver-push` and `auto-clear` (EventBridge-Scheduler-triggered) — matching NFR Design's topology plus this stage's corrections, sized at this stage.
- `Reminder`/`DeviceToken` DynamoDB tables: on-demand capacity, AWS-managed encryption, guest-identity auth (schema-level, not an infra resource); `Reminder` carries the new `postId` GSI (NFR Design R-02).
- A dedicated EventBridge Scheduler group for this Unit's schedules (not the account default group), per security-design.md's least-privilege IAM scoping intent.
- IAM roles restated as concrete policies per security-design.md's already-fixed scoping (least-privilege per Lambda, no wildcard grants).

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
