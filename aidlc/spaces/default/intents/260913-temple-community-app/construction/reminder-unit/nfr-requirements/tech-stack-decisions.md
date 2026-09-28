# Tech Stack Decisions — reminder-unit

| Choice | Selection | Rationale |
|---|---|---|
| Authorization | Amplify Data `allow.guest()` (Cognito Identity Pool guest/unauthenticated identity, IAM auth mode) | Fixed from Domain Design ADR-005; the only Unit in this project not using Cognito User Pool tokens |
| Event ingestion | DynamoDB Streams on FeedUnit's Post table + a Lambda function owned by this Unit (Contract 8) | Fixed from Contract Design; the project's first internal, non-GraphQL event contract |
| Scheduled-compute mechanism (push firing + auto-clear sweep) | Deferred to Infrastructure Design — candidates named in contract-summary.md's Open Questions: EventBridge Scheduler, DynamoDB TTL+Streams, polling Lambda | This stage sets the target (NFR-PERF.3: within 2 minutes, p95) that whichever mechanism is chosen must satisfy; not decided here |
| Push provider integration | APNs (iOS) + FCM (Android), via whatever AWS-native or direct-SDK integration Infrastructure Design selects | Standard mobile push providers; specific integration approach (e.g. SNS Mobile Push vs. direct SDK) deferred to Infrastructure Design |
| Client SDK | `amplify_api` (GraphQL, IAM auth) via `services/reminder_service.dart` | Matches team.md's firm layer-boundary rule; this file also owns resolving/persisting the device's guest identity and OS push-permission/token registration |

No new technology is locked in beyond what Domain Design/Contract Design already fixed — the scheduled-compute mechanism remains genuinely open, and this stage's job is to set the NFR target it must hit, not to choose it.
