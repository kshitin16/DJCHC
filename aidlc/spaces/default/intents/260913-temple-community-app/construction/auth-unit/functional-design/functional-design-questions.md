# Functional Design — Questions (auth-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work.md` (AuthUnit definition)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work-story-map.md` (FR1.1, FR1.2, FR1.3 assigned to this Unit)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md` (AuthComponent, AdminAllowlistEntry entity)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contract 1: Identity Resolution, Contract 2: Admin Authorization via `cognito:groups`)

This is the first Unit built (the walking skeleton's foundation) — sign-in, admin authorization, and the admin allowlist mechanism.

## Q1. Domain Design modeled the admin allowlist as a separate database table (`AdminAllowlistEntry`), but Contract Design's actual contract checks a native Cognito group-membership claim (`cognito:groups`). These are two different implementation mechanisms for the same rule ("is this identity an admin"), and only one should actually get built. AWS Cognito has a built-in Groups feature — adding someone to the "Admin" group is a database-free, no-code-change action (via the AWS Console or CLI) and Amplify Gen2 has direct, well-documented support for authorizing by group membership. Should AuthUnit use native Cognito Groups (simpler, no custom table, matches what Contract Design already specified) instead of a separate database table?

- A. Yes — use native Cognito Groups. No separate `AdminAllowlistEntry` database table; admin status is entirely Cognito group membership, managed by adding/removing the person from the "Admin" group.
- B. No — keep a separate database table as Domain Design originally modeled, and have the app check that table instead of (or in addition to) a Cognito group.
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Yes — use native Cognito Groups. No separate AdminAllowlistEntry database table; admin status is entirely Cognito group membership

## Q2. Is there anything special about a person's very first sign-in (a welcome step, an implicit account-creation side effect), or should every sign-in — first time or the hundredth — be treated identically?

- A. Treated identically — sign-in is sign-in, no first-time special case
- B. Something special happens on first sign-in
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Treated identically — sign-in is sign-in, no first-time special case

## Q3. If someone is signed in but is later removed from the Admin group (or their allowlist status is revoked) while they still have an active session on their phone, should their next admin action be blocked immediately, or is it acceptable if it takes effect only the next time they sign in?

- A. Acceptable to take effect at next sign-in — no need for the running app to notice a mid-session revocation
- B. Must be blocked immediately, even mid-session — worth the added complexity of re-checking on each admin action rather than trusting a cached session claim
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Acceptable to take effect at next sign-in — no need for the running app to notice a mid-session revocation

## Consolidated Summary Confirmation

- AuthUnit uses native AWS Cognito Groups for admin authorization — no separate AdminAllowlistEntry database table.
- Every sign-in is treated identically; no first-time special case.
- A mid-session admin-group revocation takes effect at the person's next sign-in, not immediately.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
