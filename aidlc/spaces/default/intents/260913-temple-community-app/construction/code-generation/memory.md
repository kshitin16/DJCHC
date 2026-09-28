<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->

- 2026-09-17T12:30:00Z — Secret store for auth-unit and donation-unit: Amplify Gen2's `secret()` places values in SSM Parameter Store (SecureString), not AWS Secrets Manager as the infra specs name — intent met (never committed, encrypted at rest, referenced by name); both infra specs deserve an amendment note rather than silent drift. donation-unit also added a `donorIndex` GSI beyond its infra spec's `statusIndex` so `myDonations` is a Query, not a Scan.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

- 2026-09-17T12:30:00Z — feed-unit: the installed `@aws-amplify/data-schema@1.26.1` refuses identity-pool guest authorization on `a.handler.custom` operations, so the design's 'no Lambda, public listPosts via guest identity' could not be built as written. The developer's first build fell back to an AppSync API key (expires ≤365 days); the builder rejected that and chose one small Lambda (`feed-api`) for `listPosts` with the guest rule, keeping the five admin operations as JS resolvers. feed-unit's infrastructure-specification.md 'Compute model: none of its own' needs an amendment note (one Lambda).

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

- 2026-09-20T10:05:00Z — reminder-unit review R-01 (Major): Amplify's schema-level `allow.resource(fn).to(['query'])` grants `appsync:GraphQL` on `types/Query/*` — every query in the shared backend, admin-only ones included — and Gen2's `enableIamAuthorizationMode: true` means `@auth` rules are not applied to IAM principals, so that policy is the whole gate. Replaced with an explicit single-field grant on `Query.listPosts` in `backend.ts` (+ the endpoint env var set there). Lesson for flutter-app-unit and any future Lambda consumer of the API: never use the schema-wide `allow.resource(fn)` in this shared backend; grant the field ARN.
- 2026-09-17T12:30:00Z — Carried obligations for later units: reminder-unit's `myReminders` Lambda must reach `listPosts` through `allow.resource(fn)` on the schema (guest auth is for the app, IAM for Lambdas); flutter-app-unit must call `listPosts` with `authorizationMode: identityPool` when signed out.

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->

- 2026-09-20T09:40:00Z — CLOSED: reminder-unit's carried obligation R-04 (Critical). `ownerIndex` GSIs now exist on both `Reminder` (sorted by `initialFireAt`) and `DeviceToken` in `amplify/data/resource.ts`; `myReminders`, `registerDeviceToken`, `setRemindersEnabled` and `deliver-push`'s token lookup are index Queries in `reminder-repository.ts`; `amplify/backend.ts` grants `dynamodb:Query` only on the index ARNs (a Scan is not even permitted); `reminder-schema.test.ts` asserts both indexes. The reminder-unit infra spec was already amended at the design level before this pass. Two amendment notes remain owed to that spec: four Lambdas (one shared `reminder-api`) instead of six, and the FCM secret in SSM SecureString via `secret()`.
- 2026-09-16T17:05:00Z — CARRIED OBLIGATION (builder's decision at the Infrastructure Design gate, "Fix at Code Generation"): reminder-unit's accepted-risk finding R-04 (Critical) must be closed in reminder-unit's code-generation plan — add an `ownerIdentityId` secondary index to BOTH the `Reminder` and `DeviceToken` models in `amplify/data/resource.ts`; change `myReminders`' data access to a Query on the new `Reminder` index and `deliver-push`'s DeviceToken lookup to a Query on the new `DeviceToken` index; make `registerDeviceToken`/`setRemindersEnabled` locate their row via that index; then amend reminder-unit's `infrastructure-design/infrastructure-specification.md` (IAM rows for `myReminders`/`deliver-push`, the `myReminders` sizing row, and the two table rows) with an amendment note. Not optional.
- 2026-09-16T17:05:00Z — CARRIED OBLIGATION (same decision): feed-unit's accepted-risk finding R-01 (Minor) — in feed-unit's `infrastructure-design/infrastructure-specification.md` Shared Infrastructure table, Cognito User Pool row, broaden the admin-group parenthetical from "create/edit/delete" to also name `listAllPostsForAdmin` and `getPost`, with an amendment note, during feed-unit's code-generation pass.
