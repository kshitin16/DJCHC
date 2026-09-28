# NFR Requirements — Questions (reminder-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/reminder-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/reminder-unit/functional-design/rules.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md` (NFR1-NFR8; FR7.1-FR7.8)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 3, 8, 9)

This is the newest and most functionally complex Unit in the project (guest-identity auth, server-triggered push, a DynamoDB Streams event consumer). The scheduled-compute mechanism that actually fires pushes/auto-clears reminders is deferred to Infrastructure Design (per Contract 9's Open Questions) — this stage sets the NFR *targets* that mechanism will need to satisfy, not the mechanism itself.

## Q1. Push delivery timing accuracy: how close to a Reminder's `initialFireAt`/`snoozeFireAt` should the actual push notification arrive?

- A. Within 2 minutes of the scheduled fire time (p95) — tight enough that a "9:00 AM day-before" reminder doesn't drift into meaninglessness, loose enough that a simple polling-based scheduled-compute mechanism (checked every 1-2 minutes) can satisfy it without needing a more complex per-second scheduler. This gives Infrastructure Design a concrete target to design the actual mechanism (EventBridge Scheduler, DynamoDB TTL+Streams, polling Lambda) against. (Recommended)
- B. A different accuracy target — specify
- X. Other (please specify)

[Answer]: A. Within 2 minutes, p95.

## Q2. Failed push delivery (APNs/FCM reports an invalid or expired token): what should happen to that device's `DeviceToken`/reminders?

- A. Log the failure; do NOT auto-disable `remindersEnabled` or delete the `DeviceToken`. A device's push token can go stale for reasons unrelated to user intent (app reinstall, OS-level token rotation); silently turning off a user's reminders without their action would be surprising. Leave stale-token cleanup as a Code Generation/Infrastructure Design detail (e.g. a periodic cleanup job), not a behavior this stage locks in now. (Recommended)
- B. Auto-disable remindersEnabled after N consecutive delivery failures — specify N
- X. Other (please specify)

[Answer]: A. Log only, no auto-disable.

## Q3. Guest-identity security: BR7.6 means every operation in this Unit is authorized purely by possessing a valid Cognito guest identity, with no additional check. Is this project's threat model comfortable with that, or does it need an explicit statement of why a guest identity is not guessable/spoofable?

- A. Comfortable as-is — a Cognito Identity Pool guest identity id is a long, securely-generated, non-sequential identifier tied to the device's own IAM credentials (not a short PIN or predictable value), and this Unit's data (which events a device has reminders for) is low-sensitivity — worth stating explicitly in this stage's security requirements as the basis for accepting guest-identity-only auth, rather than leaving it implicit. (Recommended)
- B. Add an additional protection layer — specify
- X. Other (please specify)

[Answer]: A. Comfortable as-is.

## Q4. Observability/alerting for push delivery failures: standard logging only (this project's default posture), or something closer to donation-unit's alerting, given this is the project's flagship first-release feature this whole redo pass was built around?

- A. Standard logging only, no special alerting — an individual failed push is a normal, expected occurrence (stale tokens, transient APNs/FCM issues) at this app's scale, not a financial-severity failure. The builder can review delivery-failure logs periodically rather than being paged. (Recommended)
- B. Add alerting if the delivery-failure rate crosses a threshold (e.g. >20% of a day's scheduled pushes failing).
- X. Other (please specify)

[Answer]: A. Standard logging only.

## Consolidated Summary Confirmation

- Push delivery timing target: within 2 minutes of the scheduled fire time (p95) — a concrete accuracy budget for Infrastructure Design's scheduled-compute mechanism choice.
- Failed push delivery (invalid/expired token) is logged only; no auto-disabling of reminders or auto-deletion of the DeviceToken at this stage.
- Guest-identity-only authorization (BR7.6) is accepted as-is, with an explicit stated rationale (non-guessable identity, low-sensitivity data) rather than left implicit.
- Standard logging only for push delivery failures, no special alerting — consistent with feed-unit's/pdf-library-unit's/suggestion-unit's posture, not donation-unit's.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
