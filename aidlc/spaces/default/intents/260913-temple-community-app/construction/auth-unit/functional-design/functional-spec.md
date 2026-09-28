# Functional Specification — auth-unit

## Workflow: Sign In

```
Flow: Sign in with Google
Persona: Any user (member, visitor, or admin) of the app
Trigger: The user taps "Sign in with Google" from the Sign In screen
Steps:
  1. App invokes the Amplify Auth client, which redirects to Cognito's hosted Google federation flow (BR1.1)
  2. User authenticates with their Google account
  3. Cognito issues an ID token carrying `sub` (identity) and `email` claims, plus `cognito:groups` if the identity is in the Admin group (BR1.1, BR1.2)
  4. App stores the session; every subsequent request to another Unit carries this token
  5. No first-sign-in-only branch exists — this sequence is identical for a first-time or repeat sign-in (BR1.4)
Success outcome: The user is signed in, with their admin status (if any) determined by the token's cognito:groups claim
Error paths:
  - User cancels the Google flow: return to Sign In screen, no error message needed
  - Google federation fails (network, misconfiguration): plain-language error message on Sign In screen, retry available
```

## Workflow: Admin-Status Check (consumed by other Units)

```
Flow: Determine whether the current session is an admin
Persona: Any other Unit needing to authorize an admin-only operation
Trigger: A consuming Unit (FeedUnit, PdfLibraryUnit, or SuggestionUnit — Contract 2's full consumer list) receives a request for an admin-gated operation
Steps:
  1. Consuming Unit reads the caller's current ID token
  2. Checks whether cognito:groups contains "Admin" (BR1.2)
  3. If yes, the operation proceeds; if no, it is refused by the consuming Unit
Success outcome: The consuming Unit correctly authorizes or refuses the operation
Error paths:
  - A person removed from the Admin group mid-session still passes this check until their next Cognito token refresh (BR1.3) — bounded by the access token's 1-hour lifetime, since Amplify Auth refreshes silently and automatically well before a new full sign-in would ever be needed; an accepted, deliberate ≤1-hour exposure window, not a defect
  - The caller's token is expired or otherwise invalid (distinct from group revocation): the consuming Unit refuses the operation and the app prompts the user to sign in again — not treated as "not an admin," since the identity itself couldn't be verified
```

## State Machine

Not applicable — AuthUnit owns no data entity with a lifecycle to model (see `entities.md`). A signed-in session is not a persisted entity this Unit owns; it is a Cognito-managed token with no local state transitions to specify here.

## Entity-Relationship Diagram

Not applicable — AuthUnit owns no entities (see `entities.md`). No diagram is rendered, per Domain Design ADR-001 folding admin-allowlist management into this Unit as pure Cognito configuration rather than owned data.

<!-- Text fallback: AuthUnit has no entity-relationship diagram because it owns
no data entities — its two rules (BR1.1, BR1.2) both concern Cognito's own
managed identity and group state, not any entity this Unit persists. -->

## Rules Summary (derived from rules.md)

| Rule | Statement (short form) |
|---|---|
| BR1.1 | Identity comes from Google federation via Cognito |
| BR1.2 | Admin status = `cognito:groups` contains "Admin" |
| BR1.3 | Admin-revocation takes effect at next token refresh (≤1 hour) |
| BR1.4 | No first-sign-in special case |
