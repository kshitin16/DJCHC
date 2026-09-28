# Domain Design — Questions (Calendar & Reminders addition)

## Sources

- [desc] The existing `components.md` (AuthComponent, FeedComponent, SuggestionComponent, DonationComponent, PdfLibraryComponent) is the approved baseline; this pass adds to it rather than replacing it.
- `requirements.md` FR7.1-FR7.8 (Calendar & Reminders, added via the redo pass).

## Q1. Should Calendar & Reminders be a new, separate component, or folded into FeedComponent (which already owns the `Post` data reminders are built from)?

- A. New `ReminderComponent` — owns reminder scheduling, snooze/cancel state, and the device-token/push-delivery mechanism; depends on FeedComponent to read Event-post data (type, dateTime). Matches this project's own precedent (SuggestionComponent was split from FeedComponent for the same reason: a materially different concern — access rule there, external push-delivery integration and scheduling state here — not a variation of Feed). Reversible: yes, FeedComponent's own boundary doesn't change either way.
- B. Fold into FeedComponent — one component owns both posts and their reminders, since reminders are entirely derived from Post data with no independent lifecycle of their own.
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. New `ReminderComponent` — owns reminder scheduling, snooze/cancel state, and the device-token/push-delivery mechanism; depends on FeedComponent to read Event-post data (type, dateTime).

## Q2. FR7.8 left an open technical question: can reminders work without requiring Google sign-in? Having looked at it from the AWS platform angle: AWS Amplify Auth supports guest/unauthenticated access via a Cognito Identity Pool (`allowGuestAccess`), and Amplify Data supports authorizing operations for that guest identity (`allow.guest()`) — so a device can register a push token and manage its own reminders using a persisted-on-device guest identity, with no Google sign-in at all. The trade-off: a guest identity is tied to one device (not portable across reinstalls or multiple devices), but nothing in FR7 requires cross-device reminder sync. Does this resolve the open question the way you'd want?

- A. Yes — use Cognito guest/unauthenticated identity for reminders; no sign-in required at all, matching the strong preference in FR7.8
- B. No — still prefer requiring sign-in for reminders specifically, even though it's technically avoidable
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Yes — use Cognito guest/unauthenticated identity for reminders; no sign-in required at all, matching the strong preference in FR7.8. This resolves Requirements Analysis's open technical question.

## Q3. The product-lead review flagged a real gap: what happens when an admin edits an Event post's date/time after a reminder has already been scheduled against the old time?

- A. Automatically reschedule the reminder against the new date/time whenever the post is edited (keeps the 9:00 AM/9:00 PM day-before timing correct without the user having to do anything)
- B. Cancel the existing reminder on edit and require the user to re-set it manually
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Automatically reschedule the reminder against the new date/time whenever the post is edited.

## Consolidated Summary Confirmation

- Calendar & Reminders becomes a new `ReminderComponent`, depending on `FeedComponent` to read Event-post data (type, dateTime).
- Reminders use a Cognito guest/unauthenticated identity (no Google sign-in required at all), resolving Requirements Analysis's open technical question in favor of the strong no-sign-in preference.
- When an admin edits an Event post's date/time, any already-scheduled reminder for it is automatically rescheduled — no manual user action needed.

Does this all look correct before I generate the component catalogue?

- Looks correct
- Request changes

[Answer]: Looks correct
