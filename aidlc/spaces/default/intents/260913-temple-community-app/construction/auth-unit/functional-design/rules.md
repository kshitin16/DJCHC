# Business Rules — auth-unit

```yaml
rules:
  - id: BR1.1
    statement: >
      A user's identity is established by successfully completing Google
      federation sign-in through AWS Cognito; the resulting ID token's
      `sub` and `email` claims are the identity every other Unit reads.
    category: authorization
    applies_to: Sign-In workflow
    trigger: A user attempts to sign in
    logic: >
      IF Google federation sign-in succeeds THEN issue a Cognito ID token
      carrying `sub` and `email`; every consuming Unit treats `sub` as the
      stable identity reference.
    violation_behaviour: >
      IF sign-in fails or is cancelled THEN no token is issued and the user
      remains signed out; no identity is established.
    source: FR1.1

  - id: BR1.2
    statement: >
      A signed-in identity is an admin if and only if their current Cognito
      session's `cognito:groups` claim contains "Admin".
    category: authorization
    applies_to: Every admin-gated operation in FeedUnit, PdfLibraryUnit, and SuggestionUnit (Contract 2's full consumer list, including the `allSuggestions` admin-read query)
    trigger: A consuming Unit needs to authorize an admin-only operation
    logic: >
      IF the caller's ID token `cognito:groups` claim contains "Admin"
      THEN the operation is authorized; ELSE it is refused.
    violation_behaviour: >
      A non-admin identity attempting an admin-gated operation is refused
      by the consuming Unit's own authorization check (this Unit only
      defines the claim shape and the group; enforcement lives at each
      operation, per Contract 2 in contract-summary.md).
    source: FR1.2

  - id: BR1.3
    statement: >
      A change to a person's Admin group membership takes effect at that
      person's next Cognito token refresh — not immediately, and not only
      at a brand-new sign-in.
    category: policy
    applies_to: Admin group membership changes
    trigger: An admin's group membership is added or removed while they may have an active session
    logic: >
      Cognito's refresh-token grant reissues the ID/access token from the
      user pool's CURRENT group membership at refresh time, not from a
      cached snapshot taken at original sign-in — so a group-membership
      change is picked up at the next silent token refresh, which Amplify
      Auth performs automatically before the access/ID token's 1-hour
      lifetime expires (NFR3.1). The practical exposure window is therefore
      bounded by the access-token lifetime (≤ 1 hour), not by the 30-day
      refresh-token lifetime or by "next sign-in."
    violation_behaviour: N/A — this is a deliberately accepted policy (a ≤1-hour exposure window), not a violation condition.
    source: Functional Design Q3 (no prior FR covers this directly — see traceability.json reverse mapping). Corrected at NFR Requirements (auth-unit, R-01): the original wording conflated "next sign-in" with "next token refresh" — Cognito performs the latter automatically and far more often than the former.

  - id: BR1.4
    statement: >
      Sign-in is handled identically whether it is the user's first time or
      a repeat visit — no first-time-only behaviour exists.
    category: policy
    applies_to: Sign-In workflow
    trigger: Any sign-in attempt
    logic: IF sign-in succeeds THEN proceed identically regardless of prior sign-in history.
    violation_behaviour: N/A — this rule states an absence of special-case behaviour, not a violation condition.
    source: Functional Design Q2 (no prior FR covers this directly — see traceability.json reverse mapping)
```

## Summary

| Rule | Category | What it governs |
|---|---|---|
| BR1.1 | Authorization | How identity is established (Google federation via Cognito) |
| BR1.2 | Authorization | How admin status is determined (native Cognito group membership) |
| BR1.3 | Policy | Admin-revocation takes effect at next token refresh (≤1 hour), not mid-session |
| BR1.4 | Policy | No first-sign-in special case |
