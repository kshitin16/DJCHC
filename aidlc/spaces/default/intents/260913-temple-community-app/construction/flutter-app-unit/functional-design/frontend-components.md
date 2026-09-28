# Frontend Components — flutter-app-unit

Technology-agnostic component/state design, following the affirmed conventions in `team.md`: layer-first folders (`lib/models/`, `lib/screens/`, `lib/widgets/`, `lib/services/`, `lib/utils/`), plain `ValueNotifier`/`ChangeNotifier` (no Provider/Riverpod/Bloc), and the firm rule that only `services/` may call Amplify/GraphQL directly.

## App-Level State

- **`AuthState` (ChangeNotifier, root-level)**: holds `isSignedIn`, `googleSub`, `email`, `isAdmin` (derived from Contract 2's `cognito:groups`), and the active `languageCode` (Q2). Constructed once at app root and passed down by constructor injection to every screen that needs it (no global singleton, no Provider package). Updated by `services/auth_service.dart` on sign-in, sign-out, and token refresh.
- **`LocalizationController` (ChangeNotifier, root-level)**: holds the active language's string table; `AuthState.languageCode` changes trigger a rebuild via this controller. Initialized from the device locale (Q2 step 1) unless a stored manual override exists (Q2 step 2, persisted locally — not a Contract 1/5 field).
- **`DeviceIdentityState` (ChangeNotifier, root-level)**: holds the device's Cognito guest identity id and `notificationPermissionGranted`. Resolved silently at app start (or lazily on first Calendar visit), independent of `AuthState` — a signed-out AND signed-in user share the same device guest identity, since reminders never depend on Google sign-in. Updated by `services/reminder_service.dart` on registration.

## Screen Components

Each screen owns one local `ValueNotifier<ScreenState<T>>` where `ScreenState` is a small sealed-style union (`Loading | Loaded(T) | Empty | Error(message)`), populated by calling its `services/` wrapper. No screen calls Amplify directly.

| Screen | Local state notifier | Services layer call | Key widgets |
|---|---|---|---|
| Feed | `ValueNotifier<ScreenState<List<Post>>>` | `services/feed_service.dart#listPosts()` | `PostCard` (type badge, title, date), `FeedList` |
| Sign In | `ValueNotifier<ScreenState<void>>` | `services/auth_service.dart#signInWithGoogle()` | `GoogleSignInButton` |
| Submit a Suggestion | `ValueNotifier<ScreenState<void>>` + local word-count display | `services/suggestion_service.dart#submit(text)` | `SuggestionForm` (text area with live word count, `Submit` button) |
| My Suggestions | `ValueNotifier<ScreenState<List<Suggestion>>>` | `services/suggestion_service.dart#myPast()` | `SuggestionListItem` (truncated text, date) |
| Account | reads `AuthState` directly (no separate fetch) | `services/auth_service.dart#signOut()` | `IdentityCard`, `LanguageToggle`, `SignOutButton` |
| Admin: Post List | `ValueNotifier<ScreenState<List<Post>>>` | `services/feed_service.dart#listAllForAdmin()`, `#getPost(id)`, `#create()`, `#update()`, `#delete()` | `AdminPostListItem` (Edit/Delete), `PostForm`, `ConfirmDeleteDialog` |
| Admin: Suggestions List | `ValueNotifier<ScreenState<List<Suggestion>>>` | `services/suggestion_service.dart#allSuggestions()` | `SuggestionListItem` (reused, read-only — no action row) |
| Donate | `ValueNotifier<ScreenState<void>>` | `services/donation_service.dart#initiate(amount, type, frequency)` | `DonationAmountForm`, `FrequencyPicker` (shown only when RECURRING selected) |
| My Donations | `ValueNotifier<ScreenState<List<Donation>>>` | `services/donation_service.dart#myDonations()`, `#cancel(id)` | `DonationListItem` (status badge, Cancel action gated on `status == SUCCEEDED && type == RECURRING`), `ConfirmCancelDialog` |
| PDF Library | `ValueNotifier<ScreenState<List<Document>>>` | `services/pdf_service.dart#list(category)`, `#downloadUrl(id)` | `CategoryFilterChips`, `DocumentListItem` (Download action) |
| Admin: PDF Library Management | `ValueNotifier<ScreenState<List<Document>>>` | `services/pdf_service.dart#list()`, `#createUploadUrl()`, `#confirmUpload()`, `#delete()` | `AdminDocumentListItem` (Delete action), `UploadDocumentForm`, `ConfirmDeleteDialog` |
| Calendar | `ValueNotifier<ScreenState<List<Post>>>` (Event posts) + `ValueNotifier<List<Reminder>>` (this device's reminders, keyed by postId) | `services/feed_service.dart#listPosts()` (reused, filtered), `services/reminder_service.dart#myReminders()`, `#snooze(id)`, `#cancel(id)`, `#setRemindersEnabled(enabled)` | `CalendarView` (date grid, event markers), `EventDayList`, `ReminderStatusBadge`, `SnoozeButton`, `CancelReminderButton` (with `ConfirmDestructiveActionDialog`, reused), `RemindersToggle` |

## Shared Widgets

- **`ErrorState`**: plain-language message + retry button, used identically across every screen's error state (uniform per wireframes.md's established pattern across all 11 screens).
- **`EmptyState`**: short explanatory message, no error styling; per-screen copy (e.g. Feed's "no posts yet" vs. My Suggestions' "no suggestions yet, tap Submit to add one").
- **`LoadingSkeleton`**: skeleton list-item placeholders, used for every list-backed screen (Feed, My Suggestions, Admin lists, My Donations, PDF Library).
- **`ConfirmDestructiveActionDialog`**: reused by every destructive action (post delete, donation cancel, document delete) per wireframes.md's rule that a destructive action never fires from a bare one-tap control.
- **`BottomNavBar`**: 4 items for the first release (`Feed | Calendar | Suggest | Account`); extends to 6 (`Feed | Calendar | Suggest | Donate | Library | Account`) once Donate/Library ship — exceeds the usual 5-tab guidance at that point, and restructuring (e.g. an overflow "More" entry) is deferred to when that later release actually ships, not resolved now.
- **`CalendarView`**: a date-grid widget marking dates with an Event post; tapping a date shows that day's event(s). Reused nowhere else — Calendar is the only screen with a calendar-grid layout.
- **`ReminderStatusBadge`**: small status indicator (Scheduled / Snoozed / Fired / Cleared / Cancelled) shown next to an event's reminder controls on Calendar.

## Form Validation

- **Submit a Suggestion**: client-side word-count warning as the 300-word limit (suggestion-unit BR3.1) approaches, purely advisory — the server is the authority and can still reject; the client never blocks Submit on its own count.
- **Donate**: amount must be a positive number (client-side guard matching donation-unit's technical floor); `frequency` is required only when `donationType == RECURRING`, enforced by conditionally showing/hiding `FrequencyPicker`.
- **Admin: Post List / PDF Library Management forms**: required-field checks (title, category, dateTime for posts) mirror each backend Unit's `rules.md`, but — as with the suggestion word count — are advisory; the authoritative rejection is server-side.

## API Integration Points (services/ layer)

Per the firm layer-boundary rule (`team.md` § Code Style, Q12), every Amplify/GraphQL call is isolated to one file per capability:

- `services/auth_service.dart` — Contract 1 (identity), Contract 2 (admin group check), Amplify Auth sign-in/sign-out
- `services/feed_service.dart` — Contract 3
- `services/suggestion_service.dart` — Contract 4
- `services/donation_service.dart` — Contract 5
- `services/pdf_service.dart` — Contract 6
- `services/reminder_service.dart` — Contract 9, plus resolving/persisting the device's Cognito guest identity (Amplify Auth's unauthenticated identity path) and OS push-permission/token registration

No screen or widget imports `package:amplify_*` or calls a generated GraphQL operation directly — every call goes through one of the six files above, so a future change to any single contract's shape touches exactly one file.
