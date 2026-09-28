# NFR Requirements — Questions (auth-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/auth-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/auth-unit/functional-design/rules.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md` (NFR1-NFR8)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 1, 2)

Inception-level NFR1 (feed performance), NFR2 (best-effort availability), NFR4 (encryption), NFR6 (services/-layer boundary + self-review) all bear on this Unit but leave several AuthUnit-specific targets unquantified.

## Q1. Cognito session lifetime. Amplify/Cognito's own defaults are: ID/access token 1 hour, refresh token 30 days. Given this is a low-traffic community app (300-1000 people) with no stated security incident history, is the Amplify default acceptable, or does this project want tighter/looser values?

- A. Use Amplify/Cognito defaults as-is (1 hour access/ID token, 30-day refresh token) — no custom configuration needed. (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Use Amplify/Cognito defaults as-is.

## Q2. MFA. Sign-in is entirely via Google federation (BR1.1) — Cognito never collects or checks a password itself. Does this project want to require an additional Cognito-level MFA step on top of Google's own account security, specifically for Admin-group members (who can create/edit/delete content and read all suggestions)?

- A. No additional MFA — Google's own account security (which may already include the user's own 2FA) is sufficient for both regular users and admins; this is a solo-run, best-effort community app, not a high-value target. (Recommended)
- B. Require Cognito-level MFA for Admin-group members only, not regular users.
- X. Other (please specify)

[Answer]: A. No additional MFA.

## Q3. Audit logging for admin-group membership changes. BR1.3 already establishes that a revocation takes effect at next sign-in. Should adding/removing a person from the Admin group itself be captured in an audit trail (who changed it, when), beyond whatever Cognito/CloudTrail captures by default?

- A. Rely on AWS's own default CloudTrail record of Cognito admin API calls (IAM console/CLI actions) — no additional application-level audit log for group membership changes. (Recommended)
- B. Add an application-level audit record (e.g. a log entry) whenever a person's Admin group membership changes, beyond CloudTrail's default.
- X. Other (please specify)

[Answer]: A. Rely on default CloudTrail record.

## Consolidated Summary Confirmation

- Cognito session lifetime uses Amplify's own defaults (1h access/ID token, 30-day refresh token) — no custom NFR-driven override.
- No additional Cognito-level MFA beyond Google federation's own account security, for either regular users or admins.
- Admin-group membership changes are audited via AWS's default CloudTrail record of the underlying Cognito API calls; no separate application-level audit log is added for this Unit.
- Performance/availability/observability targets for this Unit will otherwise follow the guide defaults appropriate to a low-traffic (300-1000 person), best-effort community app: sign-in completes within a few seconds end-to-end (dominated by Google's own redirect, not this Unit), best-effort availability matching Amplify's managed-service SLA, and standard CloudWatch-based logging of sign-in success/failure events (no PII beyond what Cognito itself already logs).

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
