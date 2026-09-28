# Tech Stack Decisions — auth-unit

| Choice | Selection | Rationale |
|---|---|---|
| Identity provider | AWS Cognito User Pool, Google as sole federated IdP | Fixed project constraint (requirements.md); no password-based sign-in needed or wanted |
| Client SDK | `amplify_auth` (Flutter Amplify Gen2 plugin) | Matches the project's fixed Flutter + Amplify Gen2 stack; only `services/auth_service.dart` may import it (team.md's firm layer-boundary rule) |
| Admin authorization | Native Cognito Groups (`cognito:groups` claim) | Resolved at this Unit's own Functional Design (Q1), superseding Domain Design's original database-backed `AdminAllowlistEntry` framing — a native Cognito mechanism needs no extra table, extra query, or extra consistency concern |
| MFA | None (Q2, this stage) | Google federation is the only sign-in path; no additional Cognito MFA factor is configured |
| Advanced Security Features | Not enabled | Targets password-based compromised-credential detection, an attack surface this Unit does not have |

No new technology is introduced beyond what Domain Design/Contract Design already fixed for this Unit — this stage's job was to set concrete NFR targets against that already-chosen stack, not to pick new tools.
