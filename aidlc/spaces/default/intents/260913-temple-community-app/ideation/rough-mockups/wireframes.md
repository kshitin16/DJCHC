# Wireframes — Digamber Jain Temple Community App (First Release)

These are low-fidelity concept wireframes for the scoped first release: content feed, suggestion box, and the auth/admin foundation both depend on. [scope-document.md] Donations and the PDF library are a later release and are not wireframed here.

## Theme Reference

- **App name / wordmark**: Sarovar Jinalaya [Q3a]
- **Palette**: warm mustard/gold-ochre (the temple building's facade) as the primary color, with white as the secondary/trim color, matching the referenced photo. [Q3a]
- **Symbol**: the Jain Ahimsa hand — a white hand bearing the dharmachakra wheel and swastika — used as the app's icon/wordmark motif, matching the symbol displayed on the temple building. [Q3a]
- **Accent colors**: drawn from the Jain Pancharangi flag's five colors where a small accent (a badge, a status indicator, a divider) is useful — white (peace), red (truthfulness), yellow (non-stealing), green (chastity), blue (non-attachment). These are accents, not a rainbow treatment — the gold/white pairing above remains the dominant palette. [Q3a]
- This is a color and symbol reference for Refined Mockups to formalize into exact hex values and a logo asset; low-fidelity wireframes below use text annotations rather than actual color.

## Information Architecture

```
Sarovar Jinalaya (app)
 |
 +-- Feed (public, default landing screen)
 |
 +-- Sign In (Google, via Cognito federation)
 |
 +-- Suggestion Box
 |     +-- Submit a suggestion (signed-in)
 |     +-- My suggestions (signed-in, own submissions only)
 |
 +-- Account (signed-in identity, sign out)
 |
 +-- Admin (admin-group only)
       +-- Post list (create / edit / delete)

<!-- Text fallback: The app has one public area (the Feed, the default landing
screen) and three signed-in areas reachable once a user signs in with Google —
the Suggestion Box (which splits into submitting a new suggestion and viewing
the user's own past suggestions), the Account screen, and, for admin-group
members only, the Admin post list. -->
```

Flat, hub-and-spoke structure: every signed-in screen is reachable from the Feed in one step, consistent with the small screen count at this stage. [Q1]

## Screen 1 — Feed (public, default landing)

```
+----------------------------------------+
| Sarovar Jinalaya            [Sign In]  |
+----------------------------------------+
|                                        |
|  [Event] Diwali Celebration            |
|  Nov 12, 6:00 PM                       |
|  ---------------------------------     |
|                                        |
|  [Visiting Dignitary] Acharya Ji visit |
|  Nov 20                                |
|  ---------------------------------     |
|                                        |
|  [Event] Weekly Pratikraman             |
|  Every Sunday, 7:00 AM                 |
|  ---------------------------------     |
|                                        |
|              (more posts...)           |
|                                        |
+----------------------------------------+
|         [Feed]   [Suggest]  [Account]  |
+----------------------------------------+

<!-- Text fallback: A header shows the app name and a Sign In button (visible
only when signed out). The main area is a reverse-chronological list of post
cards, each tagged with a type (Event or Visiting Dignitary) and showing a
title and date. A bottom navigation bar shows Feed, Suggest, and Account. -->
```

- Accessibility: `h1` = "Sarovar Jinalaya" (header); main landmark wraps the post list; nav landmark wraps the bottom bar; keyboard entry point is the Sign In button (first focusable element after any skip-to-content link).
- Key states: **empty** (no posts yet — show a short explanatory message, no error styling); **loading** (skeleton post cards); **error** (feed failed to load — plain-language message with a retry action); this is the public screen most visitors see, so all states matter here more than on the signed-in-only screens below.

## Screen 2 — Sign In

```
+----------------------------------------+
| < Back                                 |
+----------------------------------------+
|                                        |
|         Sarovar Jinalaya               |
|                                        |
|     Sign in to continue                |
|                                        |
|      +----------------------------+    |
|      |  [G]  Sign in with Google  |    |
|      +----------------------------+    |
|                                        |
+----------------------------------------+

<!-- Text fallback: A back action returns to the Feed. The screen shows the
app name, a short explanation, and a single "Sign in with Google" button that
triggers the Cognito Google federation flow. -->
```

- Accessibility: `h1` = "Sign in to continue"; main landmark wraps the sign-in card; keyboard entry point is the "Sign in with Google" button, reachable by Tab from the back action.
- Key states: **loading** (during the OAuth round-trip); **error** (sign-in failed or was cancelled — plain-language message, retry action, no raw OAuth error text).

## Screen 3 — Submit a Suggestion (signed-in)

```
+----------------------------------------+
| < Back            Sarovar Jinalaya     |
+----------------------------------------+
|                                        |
|  Share a suggestion                    |
|  Only admins can see what you submit.  |
|                                        |
|  +------------------------------------+|
|  |                                    ||
|  |  (text input)                      ||
|  |                                    ||
|  +------------------------------------+|
|                                        |
|            [ Submit ]                  |
|                                        |
+----------------------------------------+
|         [Feed]   [Suggest]  [Account]  |
+----------------------------------------+

<!-- Text fallback: A back action and app name header. The main content is a
labeled text area for the suggestion and a Submit button, plus a one-line
reminder that suggestions are admin-only visible. -->
```

- Accessibility: `h1` = "Share a suggestion"; the privacy reminder ("Only admins can see...") is programmatically associated with the text input via `aria-describedby`, not just visually nearby; main landmark wraps the form; keyboard entry point is the text input.
- Key states: **success** (confirmation after submit, per the design agent's inline-confirmation pattern, not a redirect); **error** (submission failed — inline message, input preserved, not cleared); **empty** is not applicable (this is a form, not a list).

## Screen 4 — My Suggestions (signed-in, own submissions only)

```
+----------------------------------------+
| < Back            Sarovar Jinalaya     |
+----------------------------------------+
|                                        |
|  My Suggestions                        |
|                                        |
|  "Could we add parking guidance..."    |
|  Submitted Sep 2                       |
|  ------------------------------------  |
|                                        |
|  "More PDF categories for..."          |
|  Submitted Aug 20                      |
|  ------------------------------------  |
|                                        |
+----------------------------------------+
|         [Feed]   [Suggest]  [Account]  |
+----------------------------------------+

<!-- Text fallback: A list of the signed-in user's own past suggestions, each
showing the submitted text (truncated if long) and the submission date, most
recent first. -->
```

- Accessibility: `h1` = "My Suggestions"; main landmark wraps the list; each list item is a proper list element (`<li>`), not a styled `<div>`; keyboard entry point is the back action, then the list is reachable via Tab in submission order.
- Key states: **empty** (no suggestions submitted yet — short message pointing to the Submit screen); **loading** (skeleton rows); **partial/edge** (a very long suggestion truncates gracefully, never breaking layout).

## Screen 5 — Account

```
+----------------------------------------+
| < Back            Sarovar Jinalaya     |
+----------------------------------------+
|                                        |
|   Signed in as                         |
|   [name from Google account]           |
|   [email from Google account]          |
|                                        |
|            [ Sign Out ]                |
|                                        |
+----------------------------------------+
|         [Feed]   [Suggest]  [Account]  |
+----------------------------------------+

<!-- Text fallback: A minimal account screen showing the signed-in Google
identity (name and email) and a single Sign Out action. -->
```

- Accessibility: `h1` = "Account" (implied heading over "Signed in as"); main landmark wraps the identity display; keyboard entry point is the Sign Out button.
- Key states: this screen only exists in the signed-in state, so no separate empty/error states beyond an unlikely sign-out failure (inline error, retry).

## Screen 6 — Admin: Post List (admin-group only)

```
+----------------------------------------+
| < Back      Sarovar Jinalaya  [Admin]  |
+----------------------------------------+
|                          [ + New Post ]|
|                                        |
|  Diwali Celebration          [Edit][X] |
|  Nov 12, 6:00 PM                       |
|  ------------------------------------  |
|                                        |
|  Acharya Ji visit            [Edit][X] |
|  Nov 20                                |
|  ------------------------------------  |
|                                        |
+----------------------------------------+

<!-- Text fallback: An admin-only screen listing existing feed posts with
Edit and Delete (X) actions on each row, and a "New Post" action to create
one. Reached only by members of the admin Google-account allowlist group. -->
```

- Accessibility: `h1` = "Admin" (or a more specific "Manage Posts" label at Refined Mockups); main landmark wraps the list; Delete actions require a confirmation dialog per the interaction-design pattern for destructive actions (never a bare, one-tap delete); keyboard entry point is the "New Post" action.
- Key states: **empty** (no posts yet — points to New Post); **loading**; **error** (save/delete failed — inline, specific message); Delete additionally has a **confirming** state (the confirmation dialog itself).

## Assumptions & Open Questions

None.
