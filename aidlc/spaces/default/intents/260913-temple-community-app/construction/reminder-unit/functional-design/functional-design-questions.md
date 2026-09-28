# Functional Design — Questions (reminder-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work.md` (ReminderUnit / U7 definition)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work-story-map.md` (FR7.2-FR7.8 assigned to this Unit)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md` (FR7.1-FR7.8)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md` (ReminderComponent, `Reminder`/`DeviceToken` entities)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contract 8: Post Change Notification; Contract 9: Reminder Data)

## Q1. FR7.2 says a reminder is created automatically ("on by default") for every Event-type post. But `Reminder` requires `ownerIdentityId` (a specific device's guest identity) — there's no specific device at the moment a Post is created, so "on by default for every post" can't mean "one Reminder row created server-side the instant the Post is created." Contract 8 also never defined a `PostCreated` event (only `PostDateTimeChanged` and `PostDeleted`). How should a device's reminder for a given Event post actually come into existence?

- A. Lazily, per device: the app calls `myReminders` (or an equivalent sync point) on launch/Feed load; the server creates any missing Reminders for Event posts that device doesn't have one for yet (respecting that device's `remindersEnabled` flag), rather than the server eagerly pushing a Reminder into existence for every device the moment a Post is created. Contract 8 does not need a `PostCreated` event under this design — "on by default" means "on by default whenever a device first becomes aware of the event," not "created at Post-creation time." This also naturally covers a device that registers after a post already exists (it backfills on its first sync).
- B. Eagerly, server-side: add a `PostCreated` event to Contract 8; ReminderUnit creates a Reminder for every currently-registered `DeviceToken` when a new Event post is created. A device that registers later would still need some lazy backfill mechanism for posts that existed before it registered, so this only partially replaces (A).
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Lazily, per device — the app calls `myReminders` (or an equivalent sync point) on launch/Feed load; the server creates any missing Reminders for Event posts that device doesn't have one for yet, respecting that device's `remindersEnabled` flag. No `PostCreated` event needed on Contract 8.

## Q2. This stage is where the remaining disclosed Contract 8/9 gaps from the Contract Design review get closed, rather than carried forward again: (1) no idempotency/ordering guarantee for Contract 8's events; (2) `PostDeleted`'s cascade doesn't say what happens if the Reminder is already `FIRED`/`CLEARED`/`CANCELLED`; (3) `cancelReminder` has no stated behavior against an already-terminal Reminder; (4) the AsyncAPI framing doesn't note it's a notational stretch over DynamoDB Streams; (5) Contract 8 has no Open Questions row. Proposed resolution — confirm or adjust:

- A. Confirmed — (1) the Lambda handler treats redelivery of the same stream record as a no-op, keyed on `postId` + the record's own `updatedAt`/sequence number; (2)+(3) both `PostDeleted`'s cascade and `cancelReminder` are idempotent no-ops against an already-`FIRED`, `CLEARED`, or `CANCELLED` Reminder — only a `SCHEDULED`/`SNOOZED` Reminder actually transitions; (4) a one-line note is added to Contract 8 clarifying the AsyncAPI shape approximates a DynamoDB Streams + Lambda event-source mapping, not a literal broker; (5) a Contract 8 row is added to the Open Questions table naming the idempotency/ordering point as still-open at the infrastructure-implementation level (the behavioral contract is now pinned; the exact Lambda retry/dedup mechanics are Infrastructure Design's job)
- B. Something different for one or more of these — specify
- X. Other (please specify)

[Answer]: A. Confirmed — all five points as proposed.

## Consolidated Summary Confirmation

- A device's Reminder for an Event post is created lazily, on that device's first sync (e.g. `myReminders`) after the post exists — not eagerly at Post-creation time. No `PostCreated` event added to Contract 8.
- Contract 8's Lambda handler is idempotent (keyed on postId + updatedAt); `PostDeleted`'s cascade and `cancelReminder` are both no-ops against an already-terminal (`FIRED`/`CLEARED`/`CANCELLED`) Reminder.
- Contract 8 gets a note clarifying its AsyncAPI shape is a notational approximation of DynamoDB Streams, plus an Open Questions row for the Lambda-level idempotency mechanics.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
