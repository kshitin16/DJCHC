# Entity Model — auth-unit

AuthUnit owns no data entities. Its role is Cognito configuration — a User Pool with Google federation and a native "Admin" group — not data ownership. [Q1]

```yaml
entities: []
```

## Summary

Domain Design originally modeled an `AdminAllowlistEntry` entity for this Unit (a database-backed admin allowlist). Functional Design resolved that in favor of native AWS Cognito Groups instead (Q1): admin status is entirely Cognito group membership, managed by adding or removing a person from the "Admin" group directly — no separate table, no custom entity, no code change required to update who is an admin. This supersedes the `AdminAllowlistEntry` entity from `components.md`, and matches what Contract Design's Contract 2 already specified (a `cognito:groups` claim, not a database lookup).

Every other Unit that needs identity or admin-authorization information reads it from the Cognito ID token's claims (Contract 1, Contract 2 in `contract-summary.md`) — AuthUnit is the provider of that token shape, not a data store any other Unit queries directly.
