# Discovered Rules — Digamber Jain Temple Community App

> **Status: AFFIRMED.** These are this project's own hard constraints,
> confirmed by the human builder in the practices-discovery interview
> (`practices-discovery-questions.md`, Q12-Q14). Soft/suggested practices
> live in `team-practices.md`; this file is reserved for non-negotiable
> `ALWAYS`/`NEVER` rules only.

## Mandated

- ALWAYS restrict direct AWS Amplify access (imports of `package:amplify_*`
  and calls to generated AppSync/GraphQL operations) to the `services/`
  layer — screens and widgets must go through `services/`, never call
  Amplify directly (affirmed 2026-09-13, Q12). This is a firm rule, not a
  loose guideline: it keeps the blast radius of a future Amplify API
  change or storage-detail swap to one file per capability instead of
  every screen that touched Amplify.
- ALWAYS encrypt personal data collected by the app (names, emails,
  donation records, suggestion-box submissions) both at rest and in
  transit (affirmed 2026-09-13, Q14 — option C).
- ALWAYS check the payment aggregator's own record of what actually
  happened before treating a donation as succeeded or failed on the
  timeout path — never assume the outcome from the timeout alone (affirmed
  2026-09-13, Q14 — option D).
- ALWAYS give any change touching sign-in, permissions, or (later) payment
  handling a brief self-review before merging, even though the builder is
  working solo (affirmed 2026-09-13, Q14 — option E).
- ALWAYS run a pre-commit secret-scanning hook (`gitleaks` or
  `detect-secrets`) on staged diffs before every commit, and keep GitHub's
  built-in secret scanning, push protection, and Dependabot alerts enabled
  on the repository (affirmed 2026-09-13, Q13). Both layers were
  explicitly selected together, not as alternatives.

Note: `org.md` already carries its own `## Mandated` entries (the
conversation-language resolution/stability/preserved-tokens rules). Those
are framework-tier defaults that apply automatically at every layer of the
rule chain (org → team → project → phase) and are not restated here.

## Forbidden

- NEVER store or transmit raw payment details (card numbers, UPI PIN) —
  even temporarily. All payment handling goes through the aggregator's own
  secure, tokenized flow (affirmed 2026-09-13, Q14 — option A).

**Not elevated to a firm rule in this batch**: server-side-only enforcement
of the admin allowlist gate (Cognito group / AppSync authorization rule,
never a client-side-only check) was offered as a candidate rule in Q14
(option B) but was not among the options the human selected. It is not
recorded here as Mandated/Forbidden; `team-practices.md` § Deployment notes
it as a suggested good practice for future reference, clearly labeled as
such rather than as an affirmed rule.
