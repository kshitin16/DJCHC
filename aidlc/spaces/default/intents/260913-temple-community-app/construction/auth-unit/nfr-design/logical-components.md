# Logical Components — auth-unit

## Component inventory (Q3, confirmed)

AuthUnit is **not** a separate deployable or logical component with its own failure domain — it is a configuration surface within the single shared Amplify Gen2 backend every Unit in this project deploys to:

| Element | Nature | Failure domain |
|---|---|---|
| Cognito User Pool | AWS-managed service, configured via `amplify/auth/resource.ts` | Cognito's own regional service boundary — shared with, not isolated from, every other Unit's auth dependency |
| "Admin" Cognito Group | Configuration within the User Pool | Same as above |
| Google OIDC federation | External identity provider, configured on the User Pool | Google's own availability — external to AWS entirely |
| `services/auth_service.dart` | Client-side code, part of the single Flutter app binary | No isolation from the rest of the client app — a bug here affects the whole app's auth state, not a separately-deployed component |

## Blast radius

A misconfiguration in `amplify/auth/resource.ts` affects every Unit simultaneously (since Contracts 1 and 2 are consumed by five other Units) — there is no partial-blast-radius design possible or attempted here, consistent with this being foundational, shared configuration rather than an isolated service. This is an accepted characteristic of a single-backend, solo-maintained project, not a gap to close.

## Shared resources

The Cognito User Pool itself is the one genuinely shared resource this Unit "owns" on behalf of the whole project — every other Unit's auth-dependent behavior (Contracts 1, 2) reads from it, but none of them provision or configure it independently.
