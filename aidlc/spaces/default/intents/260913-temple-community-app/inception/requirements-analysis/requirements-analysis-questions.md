# Requirements Analysis — Questions (Calendar & Reminders addition)

## Sources

- [desc] The existing `requirements.md` (FR1-FR6, NFR1-NFR8) is the approved baseline; this pass adds to it rather than replacing it.
- New requirement, provided directly by the user mid-Construction: "a new feature — calendar view of upcoming events populated from admin-entered event data, day-before reminders with snooze, auto-clear on past-due, and user-cancel-anytime — wanted for the first release."

## Q1. The calendar is "populated from admin-entered event data" — the existing `Post` entity (FeedUnit) already carries `type` (Event / Visiting Dignitary), `title`, `dateTime`, `description`. Should the calendar show both post types, or Event posts only?

- A. Both post types (Event and Visiting Dignitary) — same posts the Feed already shows, just in calendar form
- B. Event posts only — Visiting Dignitary posts stay feed-only, not calendar-worthy
- C. Not yet defined
- X. Other (please specify)

[Answer]: B. Event posts only — Visiting Dignitary posts stay feed-only, not calendar-worthy

## Q2. "Day-before reminders" need a delivery mechanism. The project's existing scope document explicitly excluded push notifications from the first release ("Push notifications — explicitly not needed for the first release"). How should reminders actually notify the user?

- A. Local, on-device notifications only — scheduled entirely by the app itself from data it already has (the event's `dateTime`), no new backend infrastructure, and consistent with the existing no-push-notifications decision (a local notification is not a push notification)
- B. Server-triggered push notifications — requires new backend infrastructure (device token registration, a scheduled job, a push service), and reverses the earlier no-push-notifications decision
- C. Not yet defined
- X. Other (please specify)

[Answer]: B. Server-triggered push notifications — requires new backend infrastructure (device token registration, a scheduled job, a push service), and reverses the earlier no-push-notifications decision. This explicitly supersedes the prior "Push notifications — explicitly not needed for the first release" out-of-scope line.

## Q3. Is a reminder something the user opts into per event (tap "Remind me" on a specific post, can cancel that one reminder anytime, can snooze when it fires), or automatic for every event once some app-wide setting is on?

- A. Per-event opt-in — the user chooses which events to be reminded about; matches "user-cancel-anytime" naturally (cancel that one reminder)
- B. App-wide automatic — every event gets a reminder unless the user turns reminders off globally
- C. Not yet defined
- X. Other (please specify)

[Answer]: X. Other — Reminders are ON by default for every Event-type post with a specific date/time (which, per Q1, is exactly the set of posts the calendar shows — general/announcement-style admin posts with no real "happening at this time" meaning don't get reminders because they're excluded from the calendar entirely by Q1's scoping). The user can turn a reminder off per individual event (opt-out, not opt-in) AND has a separate app-wide toggle to turn off all reminders at once.

## Q4. The Feed itself is public (no sign-in required, FR2.6). Should browsing the calendar also be public, with setting/cancelling a reminder requiring sign-in — matching the existing public-view/signed-in-action split (FR1.3) — or should the whole calendar feature require sign-in?

- A. Calendar browsing is public; setting, snoozing, or cancelling a reminder requires sign-in (matches FR1.3's existing pattern)
- B. The whole calendar feature (browsing included) requires sign-in
- C. Not yet defined
- X. Other (please specify)

[Answer]: X. Other — Strong preference is that neither browsing the calendar NOR reminders require sign-in at all. If that turns out not to be technically feasible (e.g., a signed-in identity is genuinely needed to reliably register a device for server-triggered push and to let a user manage their own reminders), sign-in for reminders specifically is an acceptable fallback — but browsing the calendar itself should stay public regardless. This is flagged as an open technical question for Domain Design/Architecture to resolve (e.g., whether Cognito's unauthenticated/guest identity pool access can carry a device-token registration without full Google sign-in).

## Q5. "Snooze" needs a duration. What should snoozing a reminder do?

- A. A single fixed snooze duration (e.g., snooze until the morning of the event day)
- B. A short list of user-chosen snooze options (e.g., 1 hour, 3 hours, "tomorrow")
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. A single fixed snooze duration

## Q5a (follow-up). A single fixed duration needs an actual value to be testable. A reasonable default: snoozing re-triggers the reminder 3 hours later (or, if that would land after the event's own dateTime, it doesn't re-trigger at all — no point reminding about something already past). Confirm 3 hours, or specify a different fixed duration.

- A. Confirmed — 3 hours
- X. Other (please specify a different duration)

[Answer]: X. Other — Snoozing re-triggers the reminder at exactly 9:00 PM on the day before the event (a fixed clock time, not a relative offset from when snooze was tapped).

## Q5b (follow-up). Snooze now has a fixed target (9:00 PM the day before the event), but the ORIGINAL day-before reminder's own first-fire time was never specified — only "day-before." What time should the initial (non-snoozed) day-before reminder fire?

- A. 9:00 AM on the day before the event (a morning heads-up, well ahead of the 9:00 PM snooze fallback)
- B. Some other specific time
- X. Other (please specify)

[Answer]: A. 9:00 AM on the day before the event (a morning heads-up, well ahead of the 9:00 PM snooze fallback)

## Consolidated Summary Confirmation

- The calendar shows Event-type posts only (not Visiting Dignitary), matching FeedUnit's existing `Post.type` field.
- Reminders are delivered as server-triggered push notifications — this explicitly supersedes the earlier "no push notifications this release" decision.
- Reminders are ON by default for every calendar-eligible (Event-type) post; the user can turn a reminder off per individual event, and separately has an app-wide toggle to turn off all reminders at once.
- The initial day-before reminder fires at 9:00 AM (IST) the day before the event. Snoozing it re-triggers the reminder at a fixed 9:00 PM (IST) the same day (the day before the event) — a fixed clock time, not a relative offset — and does not re-trigger at all if that time has already passed.
- A reminder auto-clears once the event's own `dateTime` has passed, whether or not the user ever acted on it.
- The user can cancel a reminder they've set at any time, for any individual event.
- Strong preference: neither browsing the calendar nor using reminders should require sign-in. If a signed-in identity turns out to be technically necessary (e.g., to reliably register a device for push and let a user manage their own reminders), requiring sign-in for reminders specifically is an acceptable fallback — but calendar browsing itself must stay public regardless. This is flagged as an open technical question for Domain Design/Architecture to resolve.

Does this all look correct before I generate the requirements artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
