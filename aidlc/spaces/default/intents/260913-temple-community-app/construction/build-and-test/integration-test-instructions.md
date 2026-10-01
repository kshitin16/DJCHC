# Integration Test Instructions

## Sources

- [scope] Test Strategy: Standard — integration coverage at key boundaries is the required addition at this level.
- Consumed: all seven units' `code-generation-plan.md`, `unit-test-instructions.md`, `code-summary.md`.

Unit-level coverage is owned per unit by Code Generation and already passes. This
file covers the boundaries no unit test can reach, because each unit's tests fake
the thing on the other side of the boundary.

## Why these matter more than usual here

Every backend unit test fakes the DynamoDB client, and every Flutter service test
fakes the Amplify gateway. That means a test can pass while the real integration
is broken — the team recorded exactly this concern when affirming the test mix.
The checks below are the ones that would catch it.

## Environment

All of these need a deployed sandbox:

```bash
npx ampx sandbox --outputs-format dart --outputs-out-dir lib
```

That writes real `lib/amplify_outputs.dart`, so the Flutter app points at live
AppSync, Cognito and S3. Tear down with `npx ampx sandbox delete` when finished.

## IT-1 — Signed-in reminder authorization (highest priority)

**The known open risk.** `lib/services/reminder_service.dart` calls all five
reminder operations with `AuthMode.identityPool` (IAM). The schema declares them
`allow.guest(), allow.authenticated()` — and `allow.authenticated()` with no
argument means user-pool mode, with no `allow.authenticated('identityPool')` rule
present. So a signed-in device's IAM call may be refused by AppSync while the
same call works signed out.

| Step | Expectation |
|---|---|
| Signed out, call `myReminders` | succeeds |
| Signed out, `registerDeviceToken`, `setRemindersEnabled`, `snoozeReminder`, `cancelReminder` | all succeed |
| Sign in with Google, repeat all five | **all succeed** |

If the signed-in case returns Unauthorized, add `allow.authenticated('identityPool')`
to the five operations in `amplify/data/resource.ts` and redeploy. No unit test
can substitute for this check.

## IT-2 — GraphQL documents against the live schema

The app's hand-written operation documents in `lib/services/documents/` were never
compared field-by-field against the deployed schema. Run each service's operations
once against the sandbox and confirm no `Unknown field`/`Unknown argument` errors.
Cheapest form: exercise every screen once against the sandbox and watch for
GraphQL errors in the console.

## IT-3 — Google federation sign-in end to end

Needs the Google OAuth client and per-environment redirect URIs registered
(`README.md` has the table). Verify: hosted UI opens, consent completes, the app
receives `sub` and `email`, and the custom scheme `sarovarjinalaya://callback/`
returns control to the app.

## IT-4 — Admin allowlist gate, server-side

Add a user to the `Admin` group out of band:

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <pool-id> --username Google_<google-subject-id> --group-name Admin
```

The user must have signed in once first, or this returns `UserNotFoundException`.

| Caller | `createPost` / `updatePost` / `deletePost` / `listAllPostsForAdmin` / `allSuggestions` | Admin PDF operations |
|---|---|---|
| Signed-out guest | refused | refused |
| Signed-in non-admin | refused | refused |
| Signed-in admin | allowed | allowed |

Refusal must come from AppSync, not from the app hiding a button.

## IT-5 — Post stream to reminder cascade (Contract 8)

Create an Event post, let a device sync a Reminder for it, then soft-delete the
post. The reminder's EventBridge schedule must be cancelled and the Reminder row
marked cancelled. This is the one cross-unit data flow with no direct caller.

## IT-6 — S3 pre-signed upload and download round trip

Admin requests an upload URL, PUTs a PDF with `Content-Type: application/pdf`,
confirms the upload, then a guest lists documents and fetches a download URL and
retrieves the file. Then delete the document and confirm the download URL is
refused.

## IT-7 — Suggestion daily cap against real DynamoDB

The cap is a single atomic conditional `UpdateItem`, verified by unit tests
against a condition-evaluating fake. Confirm against the real table that the
sixth submission in one IST day is refused, and that two simultaneous sixth
submissions do not both succeed.

## IT-8 — Backend synthesis assertions

Several claims hold in source but have never been synthesised. At the first
`ampx sandbox` or `cdk synth`, assert on the template:

- S3 bucket: all four public-access-block flags set, SSE-S3 on, versioning off
- Lambda IAM: each function scoped to its own table/indexes; no `ListBucket`
- App client: 60/60/30 token validity, `generateSecret` false, `allowAdminCreateUserOnly` true
- Reminder `appsync:GraphQL` grant: scoped to `types/Query/fields/listPosts` only
- Streams on the `Post` table with `NEW_AND_OLD_IMAGES`

## Out of scope here

Donation flows: `DONATIONS_ENABLED` is false and no payment aggregator account
exists. Donation integration testing belongs to the pass that enables the flag.
