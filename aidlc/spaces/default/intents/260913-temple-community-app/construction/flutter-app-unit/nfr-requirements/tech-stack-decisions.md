# Tech Stack Decisions — flutter-app-unit

| Choice | Selection | Rationale |
|---|---|---|
| Crash reporting | Firebase Crashlytics (Q3) | Free tier, well-integrated Flutter plugin, no other client-side observability tool exists in this project |
| Credential storage | Amplify Auth's default platform-secure storage (Q4) | No custom implementation; Keychain (iOS) / Keystore-backed EncryptedSharedPreferences (Android) are already secure-by-default |
| State management | Plain `ValueNotifier`/`ChangeNotifier` | Already fixed at Practices Discovery (team.md Q10) — no change at this stage |
| Offline strategy | None (Q2) — error+retry per screen | Already the design established in functional-spec.md's per-workflow error paths; this stage confirms no additional caching layer is added |
| Client SDK | `amplify_flutter`, `amplify_auth_cognito`, `amplify_api`, `amplify_storage_s3` | Fixed from Domain/Contract Design's Amplify Gen2 backend choice; isolated to `services/` per the firm layer-boundary rule |

No new technology beyond what Domain Design/Contract Design/Practices Discovery already fixed, aside from Crashlytics — this stage's own new addition, chosen to close the observability gap a `kind: ui` Unit otherwise has no NFR category for (no `observability-requirements.md` applies to this Unit per `produces_kinds`).
