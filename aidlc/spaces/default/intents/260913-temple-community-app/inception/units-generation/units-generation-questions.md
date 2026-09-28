# Units Generation — Questions (Calendar & Reminders addition)

## Sources

- [desc] The existing `unit-of-work.md`/`unit-of-work-dependency.md`/`unit-of-work-story-map.md` (6 Units: Auth, Feed, Suggestion, Donation, PdfLibrary, FlutterApp) is the approved baseline; this pass adds to it rather than replacing it.
- `components.md`'s new `ReminderComponent` (Domain Design redo pass).

## Q1. Every existing component maps 1:1 to its own Unit (AuthComponent → AuthUnit, FeedComponent → FeedUnit, SuggestionComponent → SuggestionUnit, and so on). Should `ReminderComponent` follow the same pattern as its own new Unit, or fold into `FeedUnit` since it depends on FeedComponent?

- A. New `ReminderUnit` — matches the established 1:1 component-to-unit pattern; depends on `FeedUnit` in the dependency DAG (mirroring the component dependency); `FlutterAppUnit` gains a new dependency on it for the calendar/reminders screens
- B. Fold into `FeedUnit` — one Unit covers both feed posts and reminders
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. New `ReminderUnit` — matches the established 1:1 component-to-unit pattern; depends on `FeedUnit` in the dependency DAG (mirroring the component dependency); `FlutterAppUnit` gains a new dependency on it for the calendar/reminders screens

## Consolidated Summary Confirmation

- `ReminderComponent` becomes its own new `ReminderUnit`, matching the established 1:1 component-to-unit pattern.
- `ReminderUnit` depends on `FeedUnit` (mirroring the component-level dependency).
- `FlutterAppUnit` gains a new dependency on `ReminderUnit` for the calendar/reminders screens already specified in its Functional Design.

Does this plan look right before I generate the unit artifacts?

- Approve Plan
- Revise Plan

[Answer]: Looks correct
