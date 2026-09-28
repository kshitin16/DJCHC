# NFR Design — Questions (auth-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/auth-unit/nfr-requirements/*.md` (performance/security/scalability/reliability/observability targets, tech-stack-decisions)
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/auth-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 1, 2)

This Unit owns no data of its own (see entities.md) — it is entirely Cognito configuration plus a thin client wrapper. Its NFR design is correspondingly light: there is no cache to architect, no partition key to choose, no queue to decouple.

## Q1. Resilience pattern for Cognito/Google federation failures: NFR2.2 already states there is no fallback identity provider. Does this Unit need a client-side circuit breaker (stop retrying after N failures within a window) around the sign-in flow, or is the existing simple error+retry (per functional-spec.md's Sign-In workflow) sufficient?

- A. Simple error+retry is sufficient — no circuit breaker. A circuit breaker exists to protect a downstream dependency from retry storms or to fail fast under sustained load; at this app's scale (intermittent, low-volume sign-ins), a user tapping "retry" a few times after a transient failure poses no such risk, and Cognito/Google are both managed services with their own protections already. (Recommended)
- B. Add a client-side circuit breaker — specify the threshold
- X. Other (please specify)

[Answer]: A. Error+retry is sufficient.

## Q2. Cognito App Client configuration: should the mobile app use a public app client (no client secret), matching the standard pattern for a distributed mobile binary that cannot securely store a secret?

- A. Public app client, no client secret — the standard, secure-by-default pattern for any mobile/SPA client using Authorization Code + PKCE via Cognito's hosted UI. A client secret embedded in a distributed app binary is not actually secret (it can be extracted), so Cognito's own guidance is to omit it for public clients. (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Public app client, no secret.

## Q3. Logical component boundary: is AuthUnit its own deployable/isolated component, or is it purely a configuration surface (amplify/auth/resource.ts) within the single shared Amplify Gen2 backend this project already uses for every Unit?

- A. Purely configuration within the single shared Amplify Gen2 backend — there is no separate deployable, no separate failure domain, and no separate blast radius from the other Units' own Amplify resources; Cognito itself (a fully managed AWS service) is the actual isolation boundary, not anything this project deploys. This matches how every other Unit in this project shares the one Amplify Gen2 backend (per contract-summary.md's own framing). (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Purely configuration.

## Consolidated Summary Confirmation

- No circuit breaker is added around Cognito/Google federation sign-in — simple error+retry (already specified) is sufficient at this app's scale.
- The mobile app uses a public Cognito App Client (no client secret), the standard secure-by-default pattern for a distributed mobile binary.
- AuthUnit has no separate logical component/deployable of its own — it is pure Cognito configuration within the single shared Amplify Gen2 backend; Cognito itself is the isolation boundary.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
