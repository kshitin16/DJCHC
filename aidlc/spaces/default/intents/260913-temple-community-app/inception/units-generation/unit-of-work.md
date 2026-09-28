# Unit of Work — Digamber Jain Temple Community App

Seven Units, one per Domain Design component plus one for the Flutter app itself, per the approved decomposition plan. [units-generation-questions.md]

> **Amended** — U7 (ReminderUnit) added via a redo pass (backward jump from `nfr-requirements`) for the Calendar & Reminders capability requested mid-Construction. See `units-generation-questions.md` (Calendar & Reminders addition).

## Unit Table

| Unit ID | Name | Directory | Kind | Deployment Model | Complexity |
|---|---|---|---|---|---|
| U1 | AuthUnit | `u1-auth` | service | shared (one Amplify Gen2 backend deploy) | M |
| U2 | FeedUnit | `u2-feed` | service | shared (one Amplify Gen2 backend deploy) | M |
| U3 | SuggestionUnit | `u3-suggestion` | service | shared (one Amplify Gen2 backend deploy) | S |
| U4 | DonationUnit | `u4-donation` | service | shared (one Amplify Gen2 backend deploy) | L |
| U5 | PdfLibraryUnit | `u5-pdf-library` | service | shared (one Amplify Gen2 backend deploy) | S |
| U7 | ReminderUnit | `u7-reminder` | service | shared (one Amplify Gen2 backend deploy) | M |
| U6 | FlutterAppUnit | `u6-flutter-app` | ui | standalone (its own mobile app release) | L |

## Unit Definitions

### U1 — AuthUnit

**Boundary**: realizes Domain Design's `AuthComponent`. Owns Cognito-federated Google sign-in and the admin allowlist.

**Responsibilities**: resolve the signed-in identity; check admin-allowlist membership via a Cognito admin group; own the `AdminAllowlistEntry` data (managed backend-only, no in-app UI, per Domain Design ADR-001).

**Implementation notes**: Amplify Gen2's own `amplify/auth/resource.ts` convention applies directly (per `team-practices.md` § Code Style). No separate REST/GraphQL service — this Unit's "service" nature is the Cognito user pool plus admin-group configuration plus the `AdminAllowlistEntry` table, all defined declaratively in the Amplify backend.

### U2 — FeedUnit

**Boundary**: realizes Domain Design's `FeedComponent`. Owns the `Post` entity.

**Responsibilities**: store and serve feed posts (Event / Visiting Dignitary / later Donation Call-out, sharing one `Post` shape per Domain Design ADR-003); enforce that only admins (via U1) can create, edit, or delete a post; apply the 1-day post-event age-out rule to the default view; serve all posts publicly, without sign-in.

**Implementation notes**: `amplify/data/resource.ts` model for `Post`; write authorization gated on U1's admin group; read authorization public.

### U3 — SuggestionUnit

**Boundary**: realizes Domain Design's `SuggestionComponent`. Owns the `Suggestion` entity.

**Responsibilities**: accept free-text suggestions up to 300 words from signed-in users (via U1); enforce that a suggestion is visible only to its submitter (self) or to admins (all), never to other users.

**Implementation notes**: `amplify/data/resource.ts` model for `Suggestion`; per-owner and admin-group read authorization.

### U4 — DonationUnit (Later Release)

**Boundary**: realizes Domain Design's `DonationComponent`. Owns the `Donation` entity.

**Responsibilities**: initiate one-time and (later) recurring/Autopay UPI donations through the payment aggregator's tokenized flow; never store or transmit raw payment details; reconcile timeout outcomes against the aggregator's own record before resolving a donation's status.

**Implementation notes**: the highest-complexity Unit — a third-party aggregator integration, webhook/callback handling, and the reconciliation rule from `discovered-rules.md` § Mandated. Blocked on the temple's tax-exemption confirmation per `requirements.md` FR5.4 — this Unit's detailed design should not start until that organizational precondition clears.

### U5 — PdfLibraryUnit (Later Release)

**Boundary**: realizes Domain Design's `PdfLibraryComponent`. Owns the `Document` entity.

**Responsibilities**: store and serve the PDF library, browsable by a fixed initial category list; serve documents publicly; accept uploads from admins (via U1) only.

**Implementation notes**: `amplify/storage/resource.ts` for the S3-backed PDF files, plus an `amplify/data/resource.ts` model for `Document` metadata (title, category, storage reference).

### U7 — ReminderUnit

**Boundary**: realizes Domain Design's `ReminderComponent`. Owns the `Reminder` and `DeviceToken` entities.

**Responsibilities**: schedule a day-before push reminder automatically for every Event-type post (via U2); deliver the reminder as a push notification at 9:00 AM IST the day before the event, and re-fire it at a fixed 9:00 PM IST the same day if snoozed; auto-clear a reminder once its event's dateTime has passed; let the user cancel a reminder per event or turn all reminders off app-wide; reschedule a reminder automatically when U2 reports its Post's dateTime changed; register and own device push tokens against a Cognito guest (unauthenticated) identity — no Google sign-in required for any reminder action.

**Implementation notes**: `amplify/data/resource.ts` models for `Reminder` and `DeviceToken`, authorized via Amplify Data's guest (`allow.guest()`) mode rather than owner/group auth; the exact scheduled-compute mechanism (EventBridge Scheduler, DynamoDB TTL+Streams, or a polling Lambda) that fires reminders at their target times is deferred to Infrastructure Design.

### U6 — FlutterAppUnit

**Boundary**: the mobile app itself — the presentation and interaction layer over all six backend/logic Units. Not a Domain Design component (Domain Design explicitly scopes to backend business-logic components; the app's own screens are covered here).

**Responsibilities**: implement the six wireframed screens (Feed, Sign In, Submit Suggestion, My Suggestions, Account, Admin Post List) plus their eventual Donation and PDF Library counterparts, the new Admin Suggestions screen, and the Calendar & Reminders screens (calendar view, reminder snooze/cancel/app-wide-off controls); enforce the affirmed layer-first file organization and the firm rule that only `services/` may call Amplify directly (`team-practices.md` § Code Style); support English and Hindi (`requirements.md` FR4.1); handle push-notification permission prompts and delivery for U7's reminders.

**Implementation notes**: state management via plain `ValueNotifier`/`ChangeNotifier` (affirmed); `dart format` + `flutter_lints`; depends on every backend Unit's generated Amplify client API, including U7's guest-identity-authorized Reminder/DeviceToken API (a different auth mode from the Google-identity-authorized APIs of U1-U5).

## Assumptions & Open Questions

None.
