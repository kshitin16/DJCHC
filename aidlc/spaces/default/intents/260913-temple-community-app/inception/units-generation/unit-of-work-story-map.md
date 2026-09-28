# Unit of Work Story Map — Digamber Jain Temple Community App

No `stories.md` exists for this workflow (User Stories was a skipped stage), so this map uses `requirements.md`'s functional requirement (`FR{n}.{m}`) IDs in place of `USx.y` IDs, consistent with `traceability.json`'s fallback.

> **Amended** — FR7.1-FR7.8 (Calendar & Reminders) added via a redo pass, mapped to the new U7 (ReminderUnit) and, where the screen work lives, U6 (FlutterAppUnit).

## Requirement-to-Unit Map

| Requirement | Implementing Unit | Directory |
|---|---|---|
| FR1.1 — Google sign-in via Cognito federation | U1 (AuthUnit) | `u1-auth` |
| FR1.2 — Admin allowlist, database-editable | U1 (AuthUnit) | `u1-auth` |
| FR1.3 — Public vs. sign-in-gated access split | U1 (AuthUnit) | `u1-auth` |
| FR2.1 — Post fields (title, date/time, description) | U2 (FeedUnit) | `u2-feed` |
| FR2.2 — Post types (Event, Visiting Dignitary) | U2 (FeedUnit) | `u2-feed` |
| FR2.3 — Reverse-chronological order | U2 (FeedUnit) | `u2-feed` |
| FR2.4 — 1-day post-event age-out | U2 (FeedUnit) | `u2-feed` |
| FR2.5 — Admin create/edit/delete posts | U2 (FeedUnit) | `u2-feed` |
| FR2.6 — Public feed read access | U2 (FeedUnit) | `u2-feed` |
| FR3.1 — Submit a suggestion (300-word limit) | U3 (SuggestionUnit) | `u3-suggestion` |
| FR3.2 — Suggestion tied to identity, no anonymous option | U3 (SuggestionUnit) | `u3-suggestion` |
| FR3.3 — Admin-only suggestion visibility | U3 (SuggestionUnit) | `u3-suggestion` |
| FR3.4 — View own past suggestions | U3 (SuggestionUnit) | `u3-suggestion` |
| FR3.5 — No read/resolved tracking | U3 (SuggestionUnit) | `u3-suggestion` |
| FR4.1 — English + Hindi | U6 (FlutterAppUnit) | `u6-flutter-app` |
| FR5.1 — One-time UPI donations | U4 (DonationUnit) | `u4-donation` |
| FR5.2 — Recurring/Autopay donations | U4 (DonationUnit) | `u4-donation` |
| FR5.3 — Donation call-out post type | U2 (FeedUnit) | `u2-feed` |
| FR5.4 — Blocked on tax-exemption confirmation | — (organizational precondition, not a build item) | — |
| FR6.1 — PDF library browsable by category | U5 (PdfLibraryUnit) | `u5-pdf-library` |
| FR6.2 — Fixed initial category list | U5 (PdfLibraryUnit) | `u5-pdf-library` |
| FR7.1 — Calendar view of Event posts | U6 (FlutterAppUnit), reading Event-post data via U2 | `u6-flutter-app` |
| FR7.2 — Auto reminders on by default; per-event/app-wide off | U7 (ReminderUnit) | `u7-reminder` |
| FR7.3 — Reminders delivered as push notifications | U7 (ReminderUnit) | `u7-reminder` |
| FR7.4 — Initial reminder fires 9:00 AM IST day before | U7 (ReminderUnit) | `u7-reminder` |
| FR7.5 — Snooze re-fires at fixed 9:00 PM IST | U7 (ReminderUnit) | `u7-reminder` |
| FR7.6 — Auto-clear once event dateTime has passed | U7 (ReminderUnit) | `u7-reminder` |
| FR7.7 — Cancel a reminder for any event, anytime | U7 (ReminderUnit) | `u7-reminder` |
| FR7.8 — No sign-in required for reminders | U7 (ReminderUnit) | `u7-reminder` |

## Cross-Cutting Requirements

These requirements are implemented primarily by one Unit but touch another:

- **FR1.3** (access split) is owned by U1's authorization model, but every other Unit (U2-U6) enforces its own half of the rule (which of its operations are public vs. sign-in-gated) — see each Unit's own behaviour description in `unit-of-work.md`.
- **FR2.5** (admin post management) is owned by U2, but depends on U1's admin-membership check for every mutating operation.
- **FR5.3** (donation call-out post type) is owned by U2 (it's a `Post` type variant per Domain Design ADR-003), but only becomes meaningful once U4 (DonationUnit) exists to have something to call out.
- **FR7.1** (calendar view) is primarily a U6 screen, but the underlying Event-post data and any calendar-shaped query it needs come from U2 — the exact query ownership (a new U2 contract query vs. a U6-side filter over the existing `listPosts`) is left to Contract Design, consistent with this stage's own boundary (topology, not method-level API design).
- **FR7.2-FR7.8** (reminder scheduling, delivery, snooze, auto-clear, cancel) are owned by U7, but U7 depends on U2 for Event-post data and dateTime-change notices (see `unit-of-work-dependency.md`), and U6 depends on U7 for the reminder-management screens.

## Implementation Order Within Each Unit

This is a within-Unit sequencing note, not a cross-Unit build order (which is Delivery Planning's decision):

- **U1**: FR1.1 (sign-in) before FR1.2 (admin check) before FR1.3 (the access-split rule, which depends on both).
- **U2**: FR2.1 (post shape) before FR2.3/FR2.6 (read/ordering) before FR2.5 (admin mutation, needs U1) before FR2.4 (age-out) before FR5.3 (donation call-out type, once U4 exists).
- **U3**: FR3.1 (submit) before FR3.2 (identity attribution) before FR3.3/FR3.4 (visibility rules).
- **U4**: FR5.1 (one-time) before FR5.2 (recurring/Autopay), both gated on FR5.4 clearing first.
- **U5**: FR6.2 (fixed category list) before FR6.1 (browsing), since browsing needs categories to exist.
- **U7**: FR7.4 (initial fire time) and FR7.2 (auto-creation) before FR7.5 (snooze, which acts on an already-scheduled reminder) before FR7.6/FR7.7 (auto-clear/cancel, both act on an existing reminder); FR7.3 (push delivery mechanism) underlies all of these and has no ordering dependency of its own; FR7.8 (guest identity) is a foundational precondition for every other FR7.x, needed before any reminder can be owned by a device.
- **U6**: no strict internal order beyond what each screen requires from its backend Unit; the Calendar/Reminders screens (FR7.1 and the reminder controls) additionally need U7 to exist first.

## Coverage Verification

- Every FR from `requirements.md` (FR1.1 through FR7.8, 29 requirements) is assigned to exactly one Unit above, except FR5.4, which is explicitly not a build item (an organizational precondition).
- Every Unit (U1-U7) has at least one requirement assigned — no orphan Units.

## Assumptions & Open Questions

None.
