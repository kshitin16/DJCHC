# User Flow — Digamber Jain Temple Community App (First Release)

## Flow 1: First-Time Visitor Browses the Feed

```
Flow: Browse the feed as a first-time visitor
Persona: Any community member or visitor (no account required)
Trigger: Opens the app for the first time
Steps:
  1. App opens -> (no action needed) -> Feed loads directly, no sign-in prompt [Q2]
  2. Feed screen -> scrolls through posts -> sees event dates/times and visiting-dignitary posts, most recent first
  3. (optional) Feed screen -> taps Sign In -> proceeds to Flow 2
Success outcome: The visitor sees current temple happenings without creating an account or signing in.
Error paths:
  - Feed fails to load -> plain-language error message with a retry action -> retry reloads the feed
  - No posts exist yet -> empty-state message, no error styling -> visitor understands this is expected, not broken
```

## Flow 2: Sign In

```
Flow: Sign in with Google
Persona: Any community member wanting to submit a suggestion or (if an admin) post content
Trigger: Taps "Sign In" from the Feed, or is redirected here when reaching a signed-in-only screen directly
Steps:
  1. Feed screen -> taps Sign In -> Sign In screen appears
  2. Sign In screen -> taps "Sign in with Google" -> Cognito Google federation flow runs
  3. Google federation flow -> user authenticates with Google -> returns to the app, signed in
  4. App checks admin allowlist group membership -> non-admins see the standard Feed with Suggest/Account access; admin-group members additionally see the Admin entry point
Success outcome: The user is signed in and returned to the Feed, with the app now reflecting their signed-in state (and admin access, if applicable).
Error paths:
  - User cancels the Google flow -> returns to Sign In screen, no error message needed (this was a deliberate choice, not a failure)
  - Google federation fails (network, misconfiguration) -> plain-language error message on the Sign In screen, retry action
```

## Flow 3: Submit a Suggestion

```
Flow: Submit a suggestion
Persona: Signed-in community member
Trigger: Taps "Suggest" from the bottom navigation
Steps:
  1. Feed screen -> taps Suggest -> if not signed in, routed through Flow 2 first, then continues here
  2. Submit Suggestion screen -> types suggestion text -> taps Submit
  3. App saves the suggestion (visible only to admins, not to other users) -> inline success confirmation shown
Success outcome: The suggestion is recorded and the user sees confirmation without being redirected away from the screen.
Error paths:
  - Submission fails (network, validation) -> inline error message near the Submit button, entered text preserved -> user can retry without retyping
  - Empty submission -> Submit disabled until text is entered, per error-prevention pattern (no error message needed for an unmet precondition)
```

## Flow 4: View My Suggestions

```
Flow: View past submitted suggestions
Persona: Signed-in community member who has submitted at least one suggestion
Trigger: Navigates to My Suggestions (reachable from the Submit Suggestion screen or Account)
Steps:
  1. Signed-in user -> navigates to My Suggestions -> list loads, most recent first
  2. User reviews their own past submissions and submission dates
Success outcome: The user can confirm what they previously submitted, without seeing other users' suggestions.
Error paths:
  - No suggestions submitted yet -> empty-state message pointing to the Submit screen
  - List fails to load -> plain-language error message with a retry action
```

## Flow 5: Admin Posts, Edits, or Deletes a Feed Item

```
Flow: Manage feed posts (admin)
Persona: Admin-group member (Google account on the allowlist)
Trigger: Signs in and the app grants admin access based on allowlist group membership
Steps:
  1. Signed-in admin -> taps Admin entry point -> Admin Post List screen appears
  2a. To create: taps "New Post" -> fills in post details (type, title, date) -> saves -> post appears in the list and on the public Feed
  2b. To edit: taps Edit on an existing post -> changes details -> saves -> updated post reflects on the public Feed
  2c. To delete: taps Delete (X) on an existing post -> confirmation dialog appears -> confirms -> post is removed from the list and the public Feed
Success outcome: The admin's change (create, edit, or delete) is reflected on the public Feed that all visitors see.
Error paths:
  - Save fails (network, validation) -> inline error message, entered data preserved, no silent failure
  - Delete confirmation is dismissed or cancelled -> no change made, returns to the post list
  - A non-admin somehow reaches this screen directly (e.g. a stale link) -> access-denied message, routed back to the Feed — this is a defensive path since normal navigation never exposes the Admin entry point to non-admins
```

## Assumptions & Open Questions

None.
