# Contract Design — Questions (Calendar & Reminders addition)

## Sources

- [desc] The existing `contract-summary.md` (Contracts 1-7) is the approved baseline; this pass adds to it rather than replacing it.
- `unit-of-work-dependency.md`'s new U7 (ReminderUnit) edges: U7 depends on U2 (FeedUnit); U6 (FlutterAppUnit) depends on U7.
- Two gaps disclosed but not fixed at Domain Design and Units Generation: (1) no defined behavior when a Post is deleted while a Reminder still references it; (2) no entity field backing the app-wide "reminders off" toggle.

## Q1. U7 needs to "receive notice when a Post's dateTime changes" (to reschedule) — this is a new kind of boundary this project hasn't needed yet: an internal, backend-to-backend event notification between two non-Auth Units in the same Amplify Gen2 backend. What mechanism should carry it?

- A. DynamoDB Streams on the `Post` table, processed by a Lambda in U7 — an AWS-native, event-driven fit for "notify me when this record changes," and naturally covers both the dateTime-change (reschedule) and delete (see Q2) cases from the same stream
- B. U7 polls U2's GraphQL API on a schedule to detect changes
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. DynamoDB Streams on the `Post` table, processed by a Lambda in U7.

## Q2. Since this stage is where API/data shapes actually get pinned down, this is the natural point to close the two disclosed gaps rather than carrying them forward again. Proposed resolution — confirm or adjust:

- A. Confirmed — (1) a Post-deleted DynamoDB Streams event (same mechanism as Q1) triggers U7 to auto-cancel any Reminder referencing that postId, mirroring the already-agreed auto-reschedule-on-edit behavior; (2) add a `remindersEnabled: Boolean!` field to `DeviceToken` plus a `setRemindersEnabled(enabled: Boolean!): DeviceToken!` mutation in U7's contract, so the app-wide toggle has a real place to live
- B. Something different for one or both — specify
- X. Other (please specify)

[Answer]: A. Confirmed — both resolutions as proposed.

## Q3. FR7.1's calendar view needs Event-type posts with their dateTime. Contract 3's existing `listPosts` (FeedUnit → FlutterAppUnit) already returns `type` and `dateTime` on every `Post`. Does FlutterAppUnit just filter that existing query client-side for `type == EVENT`, or does this need a new dedicated calendar query?

- A. Filter client-side — no contract change needed; `listPosts` already carries everything FR7.1 needs
- B. Add a new dedicated query (e.g. `listCalendarEvents`) to Contract 3
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Filter client-side — no contract change needed; `listPosts` already carries everything FR7.1 needs.

## Consolidated Summary Confirmation

- U2→U7 internal boundary: DynamoDB Streams on the `Post` table, processed by a Lambda in U7, for both dateTime-change (reschedule) and delete (auto-cancel) notifications.
- U7's contract adds a `remindersEnabled: Boolean!` field on `DeviceToken` and a `setRemindersEnabled` mutation for the app-wide toggle.
- FR7.1's calendar view is served by FlutterAppUnit filtering Contract 3's existing `listPosts` client-side for `type == EVENT` — no change to Contract 3.
- U7 (ReminderUnit) gets its own new GraphQL contract (device registration, reminder list/snooze/cancel, app-wide toggle), consumed by U6 (FlutterAppUnit) under IAM/guest auth, not Cognito User Pool auth.

Does this all look correct before I generate the contract summary?

- Looks correct
- Request changes

[Answer]: Looks correct
