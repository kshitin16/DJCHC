# Sarovar Jinalaya — temple community app

Mobile app for the Digamber Jain temple community: a notice/event feed, a calendar
with day-before event reminders, donations, a PDF library and a suggestion box.

This document covers both halves: the **Amplify Gen2 backend** in `amplify/`, and
the **Flutter client** in `lib/` (flutter-app-unit) — see [Mobile App](#mobile-app).

## Backend

### Layout

```
amplify/
  backend.ts            # composition root — every Unit registers its resource here
  donations-flag.ts     # donation-unit: DONATIONS_ENABLED release gate (false)
  auth/
    resource.ts         # auth-unit: Cognito User Pool, Google federation, Admin group
    token-policy.ts     # auth-unit: token lifetimes + no-self-sign-up policy
    resource.test.ts    # auth-unit smoke tests
  data/
    resource.ts         # shared Amplify Data schema (Donation + Post + Reminder + DeviceToken + Document + Suggestion models, Contract 3/4/5/6/9 ops)
    donation-schema.test.ts
    post-schema.test.ts # feed-unit: Post model + Contract 3 operations
    document-schema.test.ts # pdf-library-unit: Document model + Contract 6 operations
    suggestion-schema.test.ts # suggestion-unit: Suggestion + SuggestionDailyCount models, Contract 4 operations
    reminder-schema.test.ts # reminder-unit: Reminder + DeviceToken models (both with ownerIndex), Contract 9 operations
    post-resolvers/     # feed-unit: five admin AppSync JavaScript resolvers (APPSYNC_JS, no Lambda)
    suggestion-resolvers/ # suggestion-unit: the myPastSuggestions AppSync JavaScript resolver
    post-shared/        # feed-unit: pure Post rules (BR2.x) + the table's Streams commitment
    test-support/       # feed-unit: Jest double for @aws-appsync/utils + ctx builders (never deployed)
  functions/
    donation-shared/    # donation-unit: types, repository, validation, adapter, ...
    donation-api/       # donation-unit: AppSync resolver Lambda (Contract 5)
    donation-webhook/   # donation-unit: aggregator webhook receiver (Contract 7)
    donation-reconciler/# donation-unit: scheduled reconciliation poller
    feed-api/           # feed-unit: both Contract 3 list queries (public listPosts, admin listAllPostsForAdmin) — one paginated Scan implementation
    document-shared/    # pdf-library-unit: constants, types, errors, validation, repository, S3 adapter
    document-api/       # pdf-library-unit: the one Lambda behind all five Contract 6 operations
    suggestion-shared/  # suggestion-unit: types, errors, rules (BR3.x), repository (atomic counter), metric emitter
    submit-suggestion/  # suggestion-unit: the submitSuggestion Lambda (128MB/5s)
    all-suggestions/    # suggestion-unit: the admin-only allSuggestions Lambda (256MB/30s)
    reminder-shared/    # reminder-unit: constants, types, errors, rules (BR7.x), stream classification, repository, Scheduler/FCM/feed adapters, metric emitter
    reminder-api/       # reminder-unit: the one Lambda behind all five Contract 9 operations (guest identity)
    reminder-stream-handler/ # reminder-unit: Contract 8 consumer of the Post table stream (cascade-cancel on soft delete)
    deliver-push/       # reminder-unit: EventBridge Scheduler target — FCM push + FIRED
    auto-clear/         # reminder-unit: EventBridge Scheduler target — CLEARED at the event's dateTime
  storage/
    resource.ts         # pdf-library-unit: the S3 bucket holding the library's PDFs
  backend.test.ts       # tests for the policy constants backend.ts applies
```

Later Units add their models to `amplify/data/resource.ts` and further
`amplify/functions/<name>/resource.ts` directories, following the same
Amplify Gen2 layout.

### Prerequisites

- Node.js >= 18 (developed against Node 22) and npm
- An AWS account with credentials on the default SDK credential chain — only
  needed to run the sandbox or deploy, **not** to run the unit tests
- `git`, plus `pre-commit` and `gitleaks` for the commit hook (see
  [Repository hygiene](#repository-hygiene))

### Install, test, lint

```bash
npm install
npm run test:auth     # auth-unit's tests only (Jest, no AWS access needed)
npm run test:donation # donation-unit's tests only (its path pattern also matches feed-unit's data tests)
npm run test:feed     # feed-unit's tests only
npm run test:pdf      # pdf-library-unit's tests only
npm run test:suggestion # suggestion-unit's tests only
npm run test:reminder # reminder-unit's tests only
npm test              # every backend test
npm test -- --coverage  # every backend test + the 80% line-coverage floor (CI)
npm run lint          # ESLint (typescript-eslint recommended + eslint-config-prettier)
npm run typecheck     # tsc --noEmit
npm run format        # Prettier --write
```

Tests run Jest with ts-jest in ESM mode; the scripts already set
`NODE_OPTIONS=--experimental-vm-modules`, so a bare `npm run test:auth` works.

`jest.config.ts` enforces the project's **80% line-coverage floor** whenever
coverage is collected. Run the whole suite with `--coverage` (as CI does) to
have the floor checked; the per-Unit scripts are deliberately run without it,
because a scoped run only exercises one Unit's files. The floor is never
lowered to make a step pass.

### Local development: the Amplify sandbox

```bash
npx ampx sandbox
```

`ampx sandbox` provisions a personal cloud sandbox of the whole backend (Cognito
User Pool, hosted UI domain, …) and writes `amplify_outputs.json` for the client
(git-ignored). The sandbox needs the two Google OAuth secrets described next.

### Google OAuth secrets — never in source

`amplify/auth/resource.ts` references the Google OAuth client id and secret as
`secret('GOOGLE_CLIENT_ID')` / `secret('GOOGLE_CLIENT_SECRET')`. They are resolved
at deploy time from Amplify's secret store (SSM Parameter Store SecureString
parameters) and must never appear in a committed file.

- **Sandbox** (per developer):

  ```bash
  npx ampx sandbox secret set GOOGLE_CLIENT_ID
  npx ampx sandbox secret set GOOGLE_CLIENT_SECRET
  ```

  Each command prompts for the value.

- **Branch environments** (`main` → staging, `production` → production): set the
  same two secrets in the Amplify console for that app/branch (App settings →
  Secrets), or with `npx ampx sandbox secret set <NAME> --branch <branch>`.

The Google OAuth client itself is created in the Google Cloud Console (APIs &
Services → Credentials → OAuth 2.0 Client ID, type "Web application"). Keep the
production client separate from the dev/staging one so a compromised dev
credential cannot impersonate the production app on Google's consent screen.

### Per-environment Google redirect-URI registration (one-time, manual)

Each Amplify environment gets its own Cognito hosted-UI domain
(`<prefix>.auth.ap-south-1.amazoncognito.com`), and Google only accepts redirects
to URIs that are explicitly whitelisted on the OAuth client. Amplify does not
automate this. After an environment's backend is first deployed and its Cognito
domain is known, add that domain's `/oauth2/idpresponse` URL to the Google OAuth
client's **Authorized redirect URIs**:

| Environment                      | Google OAuth client                           | Redirect URI to register                                                                                |
| -------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Local (`ampx sandbox`)           | dev client (or the shared dev/staging client) | `https://<sandbox-cognito-domain>/oauth2/idpresponse` — re-register whenever a fresh sandbox is created |
| Staging (`main` branch)          | dev/staging client                            | `https://<main-branch-cognito-domain>/oauth2/idpresponse`                                               |
| Production (`production` branch) | production client (kept separate)             | `https://<production-branch-cognito-domain>/oauth2/idpresponse`                                         |

Find the domain in the Cognito console (User pool → App integration → Domain) or
in `amplify_outputs.json` (`auth.oauth.domain`). A missing registration shows up
as a `redirect_uri_mismatch` error from Google on the first sign-in attempt.

### Administering the Admin group

Admin status is Cognito group membership, not a value in code: a signed-in person
is an admin if and only if their token's `cognito:groups` claim contains `Admin`.
The group is declared in `amplify/auth/resource.ts`; membership is managed
out-of-band with the AWS CLI or console, and changing it never requires a code
change or a deploy.

**Precondition — the person must sign in through the app at least once first.**
Every user profile in this pool is created by the Google federation flow on that
person's first sign-in; until then they do not exist in the user pool and
`admin-add-user-to-group` fails with `UserNotFoundException`. Ask them to open
the app and sign in with Google, then grant the group.

**Use the `Username` field, not the `sub` attribute.** For a user who came from a
third-party IdP, `admin-add-user-to-group`'s `--username` must be
[the username of a user from a third-party IdP][api-aautg], and Cognito names
those profiles `[Provider name]_identifier` — here `Google_<google-subject-id>`,
because the provider is registered as `Google`. The `sub` attribute is a
different value and is accepted only for local (username + password) users,
of which this pool has none. `list-users` prints both; take `Username`.

```bash
# Look the person up by e-mail. Read the top-level `Username` field of the
# result (e.g. "Google_11020304050607080910") — NOT the `sub` attribute.
aws cognito-idp list-users --user-pool-id <user-pool-id> \
  --filter 'email = "person@example.com"' --region ap-south-1 \
  --query 'Users[].{Username:Username,Email:Attributes[?Name==`email`].Value|[0]}'

# Grant admin
aws cognito-idp admin-add-user-to-group --user-pool-id <user-pool-id> \
  --username 'Google_<google-subject-id>' --group-name Admin --region ap-south-1

# Revoke admin
aws cognito-idp admin-remove-user-from-group --user-pool-id <user-pool-id> \
  --username 'Google_<google-subject-id>' --group-name Admin --region ap-south-1
```

[api-aautg]: https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminAddUserToGroup.html

A change takes effect at the person's next token refresh — within one hour, the
access/ID token lifetime — not instantly and not only at their next sign-in.

### Sign-in model, in one paragraph

Sign-in is Google only, federated through Cognito's hosted UI with the
Authorization Code + PKCE flow and a PUBLIC app client (no client secret is ever
embedded in the app). The pool has email as its sign-in attribute because Amplify
requires one, but self-registration is disabled, so no email/password account can
exist; Google-federated users are created automatically on first sign-in and are
treated identically on every later sign-in. Tokens: 1-hour access/ID, 30-day
refresh.

### Donations (later release, disabled)

donation-unit ships as a **thin, flagged-off build**: the payment-aggregator
account does not exist yet and the tax-exemption precondition (FR5.4) is
unconfirmed. Everything that does not depend on the real aggregator is built
and tested — the `Donation` model and its owner-read-only authorization, the
three Contract 5 operations (`initiateDonation`, `cancelDonation`,
`myDonations`), the signature-verified, idempotent Contract 7 webhook receiver
and the scheduled reconciliation poller — while every aggregator interaction
sits behind one interface, `AggregatorAdapter` in
`amplify/functions/donation-shared/aggregator-adapter.ts`, whose only
implementation today (`PlaceholderAggregatorAdapter`) throws
`AggregatorNotConfiguredError` from its network methods.

**What the flag does.** `amplify/donations-flag.ts` exports
`DONATIONS_ENABLED = false`. Each donation Lambda receives it as the
`DONATIONS_ENABLED` environment variable and refuses cleanly while it is not
exactly `'true'`: the three GraphQL operations throw
`DonationsDisabledError("Donations are not available yet")`, the webhook
Function URL answers `404`, and the reconciler tick is a logged no-op. The
gate fails closed — an unset or mistyped value counts as disabled.

**Secrets (never in source).** Two per environment, referenced as `secret()`
in the function declarations and resolved at deploy time from Amplify's secret
store (SSM Parameter Store SecureString):

```bash
npx ampx sandbox secret set DONATION_AGGREGATOR_API_KEY          # reconciler + api
npx ampx sandbox secret set DONATION_AGGREGATOR_WEBHOOK_SECRET   # webhook HMAC key
```

Use the aggregator's **TEST-mode** values for the sandbox and the `main`
(staging) branch, and **LIVE-mode** values only for the `production` branch
(set branch secrets in the Amplify console or with
`npx ampx sandbox secret set <NAME> --branch <branch>`). The webhook verifies
an HMAC-SHA256 hex signature of the raw request body carried in the
`x-razorpay-signature` header (override the header name with the
`DONATION_WEBHOOK_SIGNATURE_HEADER` environment variable if the chosen
aggregator differs).

**Webhook URL.** After a deploy, `amplify_outputs.json` carries the public
Function URL as `custom.donationWebhookUrl`. Register that URL with the
aggregator as its payment-status webhook target. The URL uses auth mode
`NONE` on purpose — the aggregator cannot sign SigV4 requests — and the
handler's signature check is the actual authentication; no request reaches
the table without a valid signature.

**Enable procedure.**

1. Replace `PlaceholderAggregatorAdapter` in
   `amplify/functions/donation-shared/aggregator-adapter.ts` with the real
   aggregator client (`createCheckout`, `getPaymentRecord`, `stopMandate`;
   keep `verifyWebhookSignature` matching the aggregator's scheme). Nothing
   outside that file needs to change for the integration itself.
2. Set the two secrets for the target environment (above).
3. Flip `DONATIONS_ENABLED` to `true` in `amplify/donations-flag.ts`.
4. Add the first `ampx sandbox`-backed integration test (a signed test payload
   to the webhook URL that moves a Donation to `SUCCEEDED`).
5. **Self-review before merging** — this change touches payment handling
   (project rule: any change to sign-in, permissions or payment handling gets
   a brief self-review even when working solo). Re-check: no raw card/UPI
   data anywhere in the adapter, the webhook still verifies the signature
   before any table access, and BR5.4 still resolves timeouts from the
   aggregator's own record.

Deferred to the full build: the `donation-reconciliation-alerts` SNS topic
and its email subscription (an Environment Provisioning action) and custom
metrics.

### Feed

feed-unit owns the `Post` entity (an event, a visiting-dignitary announcement
or, once donations ship, a donation call-out) and the six Contract 3
operations. The four single-item admin operations (`getPost`, `createPost`,
`updatePost`, `deletePost`) are AppSync **JavaScript resolvers**
(`amplify/data/post-resolvers/*.js`, `APPSYNC_JS` runtime) reading and
writing the `Post` DynamoDB table directly, with no Lambda. Amplify uploads
each resolver file verbatim, so those files import only `@aws-appsync/utils`
and inline the few rule functions and constants they share with
`amplify/data/post-shared/post-rules.ts` (the reference implementation);
`post-rules-parity.test.ts` proves the copies agree.

The two **list** queries — public `listPosts` and admin-only
`listAllPostsForAdmin` — are instead served by one small Lambda,
`amplify/functions/feed-api`, which imports `post-rules.ts` directly (Lambdas
are bundled). Each has its own reason: `listPosts` because of the guest-auth
restriction (see "Public read model"), and `listAllPostsForAdmin` because it
must **page** through the table, which an `APPSYNC_JS` unit resolver cannot do
— it makes exactly one data-source call per invocation. As a JavaScript
resolver it read only the first Scan page and silently stopped showing older
posts once the table passed roughly 100 rows, with no error. Contract 3
declares `listAllPostsForAdmin: [Post!]!` with no arguments and no pagination
field, so pagination cannot be exposed through the operation without breaking
the contract; sharing the Lambda keeps the contract shape exact and returns
every row. Both list paths now share one paginated Scan implementation and one
page-size constant, so a pagination bug cannot reappear in one while the other
stays correct.

| Operation                                        | Who may call it                                                                         | What it does                                                                                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `listPosts: [Post!]!`                            | **Anyone** — a guest (Cognito Identity Pool unauthenticated role) or any signed-in user | The public feed: non-deleted posts whose `dateTime` is within 1 day of now or in the future, most recent first (BR2.4, BR2.6)                          |
| `listAllPostsForAdmin: [Post!]!`                 | Admin group only                                                                        | Every non-deleted post, no age-out filter, so an aged-out post can still be found and edited (BR2.7)                                                   |
| `getPost(id): Post`                              | Admin group only                                                                        | One post; `null` if missing or deleted (BR2.6)                                                                                                         |
| `createPost(input: CreatePostInput!): Post!`     | Admin group only                                                                        | Validates type (BR2.1) and title <= 100 / description <= 1000 characters (BR2.2); attributes the post to the caller's JWT `sub`; server-generated `id` |
| `updatePost(id, input: UpdatePostInput!): Post!` | Admin group only                                                                        | Updates only the supplied fields; refuses an already-deleted post; a new `dateTime` simply re-enters the age-out filter at read time (BR2.5)           |
| `deletePost(id): Post!`                          | Admin group only                                                                        | **Soft** delete: sets `deletedAt`; refuses a second delete (BR2.6)                                                                                     |

**Who enforces the admin gate.** The declarative `allow.group('Admin')` rule
on each admin operation in `amplify/data/resource.ts` is the enforcing
layer: AppSync rejects a caller whose `cognito:groups` claim lacks `Admin`
before any handler runs. Each admin operation additionally re-checks the
caller's groups — `ctx.identity.groups` + `util.unauthorized()` in the four
JavaScript resolvers, `event.identity.groups` in the `feed-api` Lambda's
`requireAdmin` — a defense-in-depth backstop, not the gate. That backstop is
load-bearing rather than decorative: Amplify's IAM authorization mode does not
apply `@auth` rules to an IAM principal, and an IAM caller carries no
`cognito:groups`, so `requireAdmin` is what refuses it. Screen-level gating in
the Flutter app is UX convenience only. The generated model operations on
`Post` are disabled, so the table is reachable solely through these six
operations.

**Public read model.** `listPosts` is reachable without signing in through
the Cognito **Identity Pool's unauthenticated (guest) role**
(`allow.guest()` + `allow.authenticated()` on the operation) — the same mode
Contract 9 uses, with nothing that expires and no API key anywhere. The
installed `@aws-amplify/data-schema` (1.26.x) refuses `allow.guest()` on
`a.handler.custom` (JavaScript resolver) operations, so `listPosts` is
Lambda-backed: `amplify/functions/feed-api` (128MB / 10s, `dynamodb:Scan` on
the `Post` table only, `POST_TABLE_NAME` injected by `backend.ts`) runs a
paginated filtered Scan, re-applies the visibility rule to every row, sorts
most-recent-first and returns the public `Post` shape. The same function also
serves `listAllPostsForAdmin`, under that operation's own `Admin`-group rule —
sharing a handler never shares an authorization rule. flutter-app-unit's
`services/feed_service.dart` calls `listPosts` with
`authorizationMode: identityPool` when no user is signed in and with the
default `userPool` mode otherwise; every other feed operation uses
`userPool`. reminder-unit's `myReminders` Lambda reaches this same query
over IAM with a single-field `appsync:GraphQL` grant (see "Calendar &
Reminders"). When Amplify lifts the restriction,
`listPosts` can move back to a JavaScript resolver with no behaviour change.

**Soft-delete semantics.** `deletePost` never removes a row: it sets
`deletedAt` (and `updatedAt`) with a DynamoDB condition that the post exists
and is not already deleted. A deleted post is excluded from every read —
`listPosts`, `listAllPostsForAdmin` and `getPost` alike — and there is no
in-app undo. The delete mutation's own response is the only place a non-null
`deletedAt` is ever returned.

**`dateTime` is stored in canonical UTC form** (`YYYY-MM-DDTHH:mm:ss.SSSZ`;
`createPost`/`updatePost` normalize offsets and missing milliseconds). The
public feed's DynamoDB filter and every sort compare that
string, which is chronological only in this form — never write `dateTime`
to the table by any other path.

**Streams (Contract 8).** `amplify/backend.ts` enables DynamoDB Streams on
the `Post` table with `StreamViewType: NEW_AND_OLD_IMAGES`
(`amplify/data/post-shared/post-table-config.ts`). reminder-unit's Contract 8
handler consumes the stream: a `dateTime` change is a MODIFY record, and a
soft delete is a MODIFY record whose OLD image lacks `deletedAt` while the NEW
image has it — detectable only because the OLD image is carried. feed-unit
owns the stream setting; the consuming event-source mapping is reminder-unit's.

**Why a Scan.** Both list operations Scan the table with a filter, through the
same `feed-api` helper, which follows `LastEvaluatedKey` until exhausted and
therefore never returns a truncated list. The table is sized at a
few hundred rows for the app's lifetime, so an index would add cost without
benefit today; `feed-api/handler.ts` names the `feedIndex` GSI to add if the
table ever grows.

**Self-review before merging** (project rule: any change to sign-in or
permissions gets a brief self-review even when working solo). This Unit adds
a permission surface — the guest-readable `listPosts` and the `Admin`-only
rules on five operations. Re-check on every change to
`amplify/data/resource.ts`, `post-resolvers/` or `functions/feed-api/`: guest
access appears on `listPosts` (and `Post` read) only; every admin operation
still carries `allow.group('Admin')` and nothing broader; the `feed-api`
role holds `dynamodb:Scan` on the `Post` table and nothing else;
`post-schema.test.ts` still asserts the rules. Because `feed-api` now serves
both a public and an admin operation, also re-check that its handler still
dispatches on `event.info.fieldName` and calls `requireAdmin` on the
`listAllPostsForAdmin` branch — a shared handler must never let the public
branch reach the admin data set.

**Testing.** `npm run test:feed` runs the Unit's 49 tests: schema/SDL
assertions, the pure rules, the `feed-api` Lambda against a fake document
client, and each admin resolver's `request`/`response` executed against an
in-repo double of `@aws-appsync/utils` (`amplify/data/test-support/`, mapped
in `jest.config.ts`). Jest does not run the real `APPSYNC_JS` runtime; the
resolvers' first real execution is in `npx ampx sandbox`, where the walking skeleton's end-to-end flow (sign in,
admin creates one post, it appears in the public feed, a non-admin cannot
create) is exercised from the Flutter `integration_test`.

### PDF Library (later release — backend complete, hidden in the app)

pdf-library-unit adds the `Document` model, the project's first S3 bucket
(`amplify/storage/resource.ts`) and one Lambda, `document-api`, behind the
five Contract 6 operations. Unlike donations there is no backend feature
flag: nothing here depends on an external party, so the backend is built
complete and an admin can upload documents through the sandbox as soon as it
deploys. "Later release" is enforced by the app alone — flutter-app-unit
keeps the Library navigation entries feature-flagged off until the release.

**Operations and who may call them.** Authorization is enforced
declaratively by AppSync in `amplify/data/resource.ts` (the enforcing
layer); the Lambda re-checks the group on the admin operations as a backstop
only; the Flutter screens are UX convenience only.

| Operation                                       | Who                         | What                                                                                                                                                                 |
| ----------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listDocuments(category)`                       | anyone (guest or signed in) | documents, newest first; a category filters via the `categoryIndex` GSI, none scans the (small) table                                                                |
| `getDocumentDownloadUrl(id)`                    | anyone                      | a pre-signed S3 GET URL for the record's `s3Key`, valid **1 hour**                                                                                                   |
| `createDocumentUploadUrl(title, category)`      | `Admin` group only          | a pre-signed S3 PUT URL valid **15 minutes**, bound to `Content-Type: application/pdf`, plus the `s3Key` `documents/<CATEGORY>/<uuid>.pdf`. No record is written yet |
| `confirmDocumentUpload(s3Key, title, category)` | `Admin` group only          | verifies the object exists and is a PDF, then creates the `Document` record (`uploadedByGoogleId` = the caller's `sub`)                                              |
| `deleteDocument(id)`                            | `Admin` group only          | hard delete: the S3 object first, then the record; returns the `id`                                                                                                  |

**The upload flow is direct-to-S3.** The admin's client (1) calls
`createDocumentUploadUrl`, (2) PUTs the PDF bytes to the returned URL with
`Content-Type: application/pdf` — the file never passes through AppSync or
the Lambda, so this Unit imposes no size limit — and (3) calls
`confirmDocumentUpload` with the same `s3Key`, `title` and `category` (the
API keeps no "pending upload" state). Confirm accepts only a key of exactly
the shape this Unit issues (prefix `documents/`, a known category, a UUID
name, `.pdf`); anything else — path traversal included — is refused before
S3 is touched. A non-PDF object is deleted from S3 and the confirm fails; a
missing object fails without side effects (upload again, or request a fresh
URL if the 15 minutes ran out). Retrying a confirm for a key that already has
a record hits the `attribute_not_exists(id)` condition rather than creating a
duplicate.

**Delete ordering.** The S3 object is removed FIRST and the record only after
that succeeds. If the S3 delete fails the record is untouched (still listed,
still downloadable) and the call fails — retry from the start. If the record
delete then fails, the error is surfaced and a retry resolves it (the S3
delete of an already-gone key is a no-op). The reverse orphan — a
downloadable file whose record was already removed — can never be produced.

**Accepted risk (from the infrastructure specification).** An object
uploaded via `createDocumentUploadUrl` but never confirmed stays in the
bucket with no record and is never surfaced by `listDocuments`. There is no
automatic cleanup beyond a human noticing it in the bucket — low blast
radius on an admin-only, low-volume path.

**Bucket hardening** (`amplify/backend.ts`): all public access blocked, SSE-S3
default encryption, versioning OFF (a versioned bucket would silently make a
hard-deleted PDF recoverable — `backend.ts` fails the synth if anything ever
turns it on), and `AbortIncompleteMultipartUpload` after 7 days. The bucket
has no user-facing access grant at all: every read and write goes through a
pre-signed URL the Lambda issues, which is what makes the URL expirations
meaningful.

**Self-review before merging** (project rule: any change to sign-in or
permissions gets a brief self-review even when working solo). This Unit adds
a permission surface. Re-check on every change to `amplify/data/resource.ts`,
`amplify/storage/resource.ts`, `functions/document-shared/` or
`functions/document-api/`: guest access appears on `listDocuments`,
`getDocumentDownloadUrl` (and `Document` read) only; the three admin
operations still carry `allow.group('Admin')` and nothing broader; the
`document-api` role holds `s3:PutObject`/`GetObject`/`DeleteObject` on
`<bucket>/documents/*` and `dynamodb:GetItem`/`PutItem`/`DeleteItem`/`Query`/`Scan`
on the `Document` table (+ its indexes) and nothing else; the storage
resource grants no `access` to anyone; the URL lifetimes in
`document-shared/constants.ts` are still 900 s / 3600 s;
`document-schema.test.ts` and `constants.test.ts` still assert all of it.

**Testing.** `npm run test:pdf` runs the Unit's 37 tests: schema/SDL
assertions, the URL-lifetime pin, the repository and the S3 adapter against
fake clients (a fake presigner — nothing is ever signed for real), the pure
validation, and the Lambda against a fake repository + fake S3 adapter that
record call order (so "S3 before record" is asserted). The first integration
test to add when the Library ships in the app is the sandbox-backed upload
round trip, owned by flutter-app-unit's `integration_test`.

### Suggestion Box

suggestion-unit (U3, first release) owns Contract 4: a signed-in user drops a
free-text suggestion for the temple committee; the user sees their own past
suggestions; an admin sees everyone's. Nothing here is reachable without a
Cognito User Pool JWT.

**The three operations and who may call them.**

| Operation                                      | Who                                                                   | How it runs                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `submitSuggestion(text: String!): Suggestion!` | any signed-in user                                                    | `submit-suggestion` Lambda                                                                                 |
| `myPastSuggestions: [Suggestion!]!`            | any signed-in user — returns only the caller's own rows, newest first | direct AppSync JS resolver (`data/suggestion-resolvers/myPastSuggestions.js`), a Query on `submitterIndex` |
| `allSuggestions: [Suggestion!]!`               | Admin group only — every row, newest first                            | `all-suggestions` Lambda (full Scan loop + sort)                                                           |

**Who enforces what.** The ENFORCING layer is declarative, in
`amplify/data/resource.ts`: `submitSuggestion` and `myPastSuggestions` carry
`allow.authenticated()`; `allSuggestions` carries `allow.group('Admin')` and
nothing broader; the `Suggestion` model itself grants owner READ (matched on
`submittedByGoogleId` against the JWT `sub`) plus Admin READ and NO write to
anyone — every write goes through the `submit-suggestion` Lambda's IAM role.
The code-level checks are BACKSTOPS only: the submit Lambda reads the
caller's `sub` from `event.identity` (never from arguments) and refuses an
event without one; the admin Lambda re-checks the `Admin` group; the
`myPastSuggestions` resolver keys its Query on `ctx.identity.sub`, so another
user's rows cannot even be requested. Flutter screens are UX convenience.

**Limits.** Text is up to **300 words** (not characters: trimmed, split on
whitespace runs — BR3.1); an empty or over-long submission is rejected before
anything is written. Each user may submit **5 per calendar day in IST
(Asia/Kolkata)** — BR3.5. That cap is enforced with ONE atomic conditional
DynamoDB `UpdateItem` on the internal `SuggestionDailyCount` table, keyed
`<sub>#<YYYY-MM-DD IST>`: `ADD count :one` with condition
`attribute_not_exists(count) OR count < 5`. The check and the increment are
the same request, so two simultaneous submissions cannot both slip through
(there is no read-then-write). A failed condition is the "over the limit"
answer and creates no record; the user is told to try again after midnight
IST. Accepted trade-off: the counter increments BEFORE the record is written,
so a `Suggestion` write that fails after the increment still costs one of the
day's five; the reverse (an uncounted suggestion) is impossible.

**Permanence.** There is no delete mutation for anyone (BR3.4) and no
read/resolved/actioned field or mutation (BR3.6): `allSuggestions` is a plain
list. The generated model operations are disabled on both models, so the
tables are reachable only through the three operations above. PITR is on for
the `Suggestion` table. Suggestion text is personal data: both tables use
AWS-managed encryption at rest, AppSync is HTTPS-only, and the Lambdas never
log the text.

**Counter hygiene.** Each counter row carries a `ttl` attribute (next IST
midnight + 48 h, epoch seconds), set by the same atomic update with
`if_not_exists`; `backend.ts` enables DynamoDB Time to Live on `ttl`, so the
rows expire on their own at no write cost.

**Observability.** Every successful submission emits one `suggestion-count`
data point (value 1) to the custom CloudWatch namespace
`SarovarJinalaya/Suggestions`. The emission is best-effort — a CloudWatch
failure is logged and never fails a saved submission.

**Permissions to self-review before merging** (project.md mandate): the
`submit-suggestion` role holds `dynamodb:UpdateItem` on the counter table
only, `dynamodb:PutItem` on the `Suggestion` table only, and
`cloudwatch:PutMetricData` restricted by the `cloudwatch:namespace` condition
key to `SarovarJinalaya/Suggestions` (the action has no ARN to scope to); the
`all-suggestions` role holds `dynamodb:Scan` on the `Suggestion` table only;
`suggestion-schema.test.ts` asserts the auth rules above.

**Testing.** `npm run test:suggestion` runs the Unit's 38 tests: schema/SDL
assertions, the pure rules (300/301 words, whitespace runs, the IST date at
the 18:30Z boundary, the TTL formula), the repository against a fake client
(the exact atomic-increment expressions, condition failure → not allowed,
Scan pagination), the metric emitter, both Lambdas against fakes that record
call order (increment → create → metric), and the resolver via the
`@aws-appsync/utils` double. The first integration test to add, in
flutter-app-unit's `integration_test` against `ampx sandbox`, is
"submit → appears in My Suggestions → admin sees it → non-admin cannot call
`allSuggestions`" — also the first real execution of the counter against
DynamoDB.

### Calendar & Reminders

reminder-unit (U7, first release) owns Contract 9: a day-before push reminder
for every Event-type post, per device, **with no sign-in** — every operation
is scoped to the device's Cognito Identity Pool _guest_ identity (BR7.6). It
also consumes Contract 8 (feed-unit's `Post` table stream) to cancel
reminders for a deleted post.

**The five operations.** All are `allow.guest()` + `allow.authenticated()`
(a signed-in user's device still has a guest identity and is treated
identically) and all run in the one `reminder-api` Lambda, which reads the
caller ONLY from `event.identity.cognitoIdentityId` — never from an argument.

| Operation                                                            | What it does                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerDeviceToken(pushToken: String!, platform: DevicePlatform!)` | Idempotent per device identity: the same token re-registered updates `registeredAt`; a new token rotates the row in place. A new row is `remindersEnabled = true` — **on by default** (BR7.1).                                                                          |
| `setRemindersEnabled(enabled: Boolean!)`                             | Flips the app-wide toggle and touches **no** existing Reminder (BR7.7): `false` only suppresses future auto-creation.                                                                                                                                                   |
| `myReminders`                                                        | The lazy **sync**: calls feed-unit's `listPosts` (Contract 3), and for every `EVENT` post that has not passed and has no Reminder with the currently-correct `initialFireAt`, creates one (BR7.1). Returns every Reminder owned by the caller, including terminal ones. |
| `snoozeReminder(id: ID!)`                                            | Owner only. Re-fires at a **fixed 21:00 IST** the same day (BR7.3); refused after 21:00 IST; an already-snoozed Reminder is a no-op that still re-syncs its schedule; a terminal one is a plain no-op.                                                                  |
| `cancelReminder(id: ID!)`                                            | Owner only. SCHEDULED/SNOOZED → CANCELLED (BR7.5); an already-terminal Reminder is a no-op that still deletes both schedules (BR7.10).                                                                                                                                  |

**Who enforces what.** AppSync's declarative rules are the enforcing layer
for "guest identity only" (BR7.6). The Lambda is THE enforcing layer for
ownership (a snooze/cancel by another device is refused before any status
branch) and for `myReminders`' owner scoping (a Query on `ownerIndex` keyed
on the caller's identity). The model-level `guest`/`authenticated` READ
rules only make the fields of a returned `Reminder`/`DeviceToken` readable —
the generated `list`/`get`/`create`/… operations are disabled on both models,
so the tables are reachable solely through the five operations. Flutter
screens are UX convenience only.

**Fire times (IST is a fixed UTC+05:30).** The initial reminder fires at
**09:00 IST the day before** the post's IST date (BR7.2) — computed from the
DATE only, so a same-day time edit never changes it. Snooze fires at
**21:00 IST** on that same day (BR7.3). A Reminder auto-clears at the post's
own `dateTime` from SCHEDULED, SNOOZED **or FIRED** (BR7.4); CANCELLED is
final.

**The EventBridge Scheduler model (NFR-PERF.3).** Each new Reminder gets two
ONE-TIME schedules in this Unit's own group
(`reminder-schedules-<8-hex>`, built from the stack's GUID because
`AWS::Scheduler::ScheduleGroup` caps `Name` at 64 characters and Amplify's
stack names alone exceed that): `fire-<id>` → `deliver-push` at
`initialFireAt` (re-pointed to `snoozeFireAt` on snooze) and `clear-<id>` →
`auto-clear` at the post's `dateTime`. Schedules are `at(...)` expressions in
UTC with `ActionAfterCompletion: DELETE`, so they remove themselves after
firing. A dedicated execution role (trusted by `scheduler.amazonaws.com`) may
invoke exactly those two Lambdas. Every schedule create/update/delete logs
`{ schedule, reminderId, postId, fireAt }`; `deliver-push` emits the
`reminder-delivery-delta` metric (seconds between intended and actual
delivery) under `SarovarJinalaya/Reminders`.

**Contract 8 consumer.** `reminder-stream-handler` is mapped onto feed-unit's
`Post` stream (`NEW_AND_OLD_IMAGES`, LATEST, batch 10, bisect on error, 3
retries, partial-batch failure reporting). A MODIFY whose `deletedAt` goes
from absent to set is `PostDeleted`: every SCHEDULED/SNOOZED Reminder for
that post is cancelled and its two schedules deleted (BR7.9); redelivery is
safe because the transition is conditional and the deletes are no-ops on a
gone schedule (BR7.10). A `PostDateTimeChanged` is a **deliberate no-op**
(BR7.8, the builder's simplicity-over-completeness choice): the existing
Reminder is left pointing at the stale date and the device gets an ADDITIONAL
Reminder for the new date on its next sync. Do not "fix" this toward an
in-place reschedule unless the builder asks.

**The `ownerIndex` fix (R-04).** Both tables are keyed on `id`, but every
identity-scoped lookup is by `ownerIdentityId`. Both models therefore carry an
`ownerIndex` GSI (`Reminder`: sorted by `initialFireAt`; `DeviceToken`: no
sort key) and every such lookup is an index Query — never a Scan, never a
mis-keyed `GetItem`. `postIdIndex` on `Reminder` backs the Contract 8 cascade.
IAM in `backend.ts` is index-scoped accordingly.

**FCM setup (one-time).** Push delivery uses FCM's HTTP v1 API with a
Firebase service-account credential. Store the service-account JSON as an
Amplify secret — never in source, never as a plain env var:

```bash
npx ampx sandbox secret set REMINDER_FCM_SERVICE_ACCOUNT   # paste the JSON
```

`deliver-push` reads it through `secret('REMINDER_FCM_SERVICE_ACCOUNT')` and
obtains a short-lived OAuth2 token with `google-auth-library`. The APNs key
upload into the Firebase project (so iOS devices receive FCM pushes) is
flutter-app-unit's Infrastructure Design item. `listPosts` is reached from the
Lambda over IAM with a SigV4-signed GraphQL POST. `backend.ts` grants
`appsync:GraphQL` on the single `Query.listPosts` field ARN and sets
`AMPLIFY_DATA_GRAPHQL_ENDPOINT` — deliberately NOT the schema-level
`allow.resource(fn)`, which grants every query in the shared backend
(admin-only ones included).

**Design choices recorded here.** (1) A device that never registered a
`DeviceToken` gets no auto-created Reminders on sync — there is nothing to
deliver to; the Calendar still shows the events. (2) An invalid/unregistered
push token leaves the Reminder pending (not FIRED, not CANCELLED) with a
warning, so it stays visible in the Calendar. (3) All five operations share
one Lambda: the installed Amplify refuses `allow.guest()` on a no-Lambda
custom resolver, the same constraint every other Unit hit. (4) The reminder
block sits before the pdf-library block in `amplify/data/resource.ts` so
pdf-library-unit's SDL-window test (which must not see a `status` field
between `Document` and `DocumentUploadTarget`) keeps passing.

**Permissions self-review (project.md).** `backend.ts` changes here touch
IAM: `reminder-api` — `dynamodb:Query` on both `ownerIndex` GSIs and
`postIdIndex`, `GetItem/PutItem/UpdateItem` on both tables,
`scheduler:Create/Update/DeleteSchedule` on the group only, `iam:PassRole` on
the scheduler role (conditioned on `iam:PassedToService =
scheduler.amazonaws.com`); `reminder-stream-handler` — `Query` on
`postIdIndex`, `UpdateItem` on `Reminder`, `scheduler:DeleteSchedule` on the
group (the event source grants its own stream reads); `deliver-push` —
`GetItem/UpdateItem` on `Reminder`, `Query` on `DeviceToken/ownerIndex`,
`cloudwatch:PutMetricData` restricted to the `SarovarJinalaya/Reminders`
namespace; `auto-clear` — `UpdateItem` on `Reminder`,
`scheduler:DeleteSchedule` on the group. The scheduler execution role may
invoke exactly `deliver-push` and `auto-clear`.

**Tests.** `npm run test:reminder` — 13 suites: the schema (both `ownerIndex`
GSIs, the five operations, guest+authenticated on all, no Admin/owner rule),
the pure rules with fixed IST instants, Contract 8 classification, the
repository (index-scoped Queries, the conditional `IN` transition), the
Scheduler/FCM/feed adapters against fakes, and the four Lambdas against fakes
that record call ORDER (ownership before any branch; transition then schedule;
both deletes). The first integration test to add, in flutter-app-unit's
`integration_test` against `ampx sandbox`, is "open Calendar → guest identity
resolves → device registers → reminders appear → snooze → cancel" — the first
real run of EventBridge Scheduler creation and the Contract 8 stream mapping.
FCM delivery itself is verified manually on a real device once the Firebase
project and APNs key exist.

## Mobile App

The Flutter client (flutter-app-unit) — one binary for iOS and Android over the
Amplify Gen2 backend above. Twelve screens, English + Hindi, Crashlytics, and FCM
push for event reminders.

### Layout

The Flutter project root **is** the repository root, which is Amplify Gen2's
standard Flutter layout and the one `amplify.yml` / CI assume.

```
pubspec.yaml
analysis_options.yaml      # flutter_lints
lib/
  main.dart                # entry point: startup order + the Crashlytics handlers
  app.dart                 # SarovarJinalayaApp, AppShell, routing and gating
  amplify_outputs.dart     # GENERATED, git-ignored (see "Backend outputs")
  models/                  # plain Dart data classes, one per contract entity
  screens/                 # one file per screen; screens/admin/ for the admin ones
  widgets/                 # shared widgets (states, dialogs, nav, list items, calendar)
  services/                # the ONLY layer allowed to touch Amplify
    gateways.dart          #   the narrow interfaces every service depends on
    amplify_gateway.dart   #   the one Amplify data/auth import
    push_gateway.dart      #   the one firebase_messaging import
    documents/             #   hand-written GraphQL documents, one file per contract
  state/                   # the three root ChangeNotifiers
  utils/                   # IST formatting, word count, feature flags, ScreenState
  l10n/app_strings.dart    # the English and Hindi string tables
test/                      # mirrors lib/; unit + widget tests
integration_test/          # local-only, device + sandbox (never run in CI)
tool/                      # check_coverage.dart, stub_amplify_outputs.sh
```

- **Application ID / bundle ID**: `in.sarovarjinalaya.app`, and the Dart package
  name is `sarovar_jinalaya`. The Firebase apps and the store listings are
  registered under that application ID — **change it before registering them** if
  a different one is wanted, in `android/app/build.gradle.kts`
  (`namespace` + `applicationId`) and in Xcode (`PRODUCT_BUNDLE_IDENTIFIER`).

### The `services/`-only Amplify rule (firm)

Only files under `lib/services/` may import `package:amplify_*` or call a
GraphQL operation — `team.md` Q12 and `project.md` § Mandated. Concretely:

- `lib/services/amplify_gateway.dart` is the **single** Amplify data/auth import.
- `lib/services/push_gateway.dart` is the **single** `firebase_messaging` import.
- The five contract services (`feed_service.dart`, `suggestion_service.dart`,
  `donation_service.dart`, `pdf_service.dart`, `reminder_service.dart`) and
  `auth_service.dart` depend only on the `ApiGateway` / `AuthGateway` /
  `PushGateway` interfaces in `gateways.dart`, which is what makes them
  unit-testable with fakes and no AWS credentials.
- **No screen or widget imports Amplify at all.** Screens receive their services
  by constructor injection.

`flutter_lints` has no import-boundary rule, so this holds by review discipline.
A quick check that it still holds:

```bash
grep -rln "package:amplify_\|package:firebase_" lib/ | sort
# expected, and nothing else:
#   lib/main.dart                        (firebase_core + firebase_crashlytics only)
#   lib/services/amplify_gateway.dart
#   lib/services/push_gateway.dart
```

### Authorization mode per call

Every GraphQL call names its AppSync auth mode explicitly. This table is derived
from `amplify/data/resource.ts` and is enforced in code by
`publicReadAuthMode()` plus the per-service constants:

| Operation(s)                                                                                    | Auth mode                                                 | Why                                                                                             |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `listPosts`, `listDocuments`, `getDocumentDownloadUrl`                                          | `identityPool` when signed out, `userPool` when signed in | public reads; the schema carries `allow.guest()` + `allow.authenticated()`                      |
| `myReminders`, `registerDeviceToken`, `setRemindersEnabled`, `snoozeReminder`, `cancelReminder` | **always `identityPool`**, signed in or not               | Contract 9 is scoped to the device's Identity Pool id, never to a Google sign-in (FR7.8, BR7.6) |
| everything else                                                                                 | `userPool`                                                | the schema's `defaultAuthorizationMode`                                                         |

**Client-side gating is a UX convenience, never the security boundary**
(NFR-AUTHZ.2). Hiding the Admin entry from a non-admin and redirecting a
signed-out user off a gated tab are read-only checks against values `AuthState`
already holds. Each backend Unit's own AppSync rule — `allow.group('Admin')`,
the owner rules, the guest-identity scoping — is what actually enforces access.
A bug in `app.dart` can show or hide a control wrongly; it cannot grant access.

### Identity note: the Identity Pool id changes at sign-in

Amplify's Identity Pool issues a **different** identity id once a user signs in
than it did for the same device as a guest. Contract 9's reminders are keyed on
that id, so "this device's reminders" are effectively per sign-in state.

The app handles this by re-syncing: `DeviceIdentityState` notifies when the id
changes and Calendar re-runs `myReminders` (which lazily backfills, BR7.1), so
reminders keep working across sign-in and sign-out. **What is not yet answered**
is whether the earlier identity's already-scheduled reminders still fire,
producing a duplicate push for the same event. That is a question for the first
run of `integration_test/app_test.dart` against a real sandbox; no cancel-all
logic was added, deliberately keeping the reminder module simple.

Also deliberate and carried forward from NFR Design: a **Post `dateTime` change
does not reschedule** an existing Reminder (BR7.8). The changed date surfaces as
an additional Reminder on the next sync, and the existing one keeps pointing at
the stale date. Do not "fix" this toward full correctness without asking.

### Feature flags — Screens 8-11 are built but hidden

Donate, My Donations, PDF Library and Admin PDF Library are fully implemented and
tested, but compiled out by default (`lib/utils/feature_flags.dart`):

| Flag                  | Default | Turn it on when                                                                                 |
| --------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `DONATIONS_ENABLED`   | `false` | donation-unit's payment-aggregator account exists and FR5.4's tax-exemption precondition clears |
| `PDF_LIBRARY_ENABLED` | `false` | the builder chooses to surface the library                                                      |

```bash
flutter run --dart-define=DONATIONS_ENABLED=true --dart-define=PDF_LIBRARY_ENABLED=true
```

The bottom navigation grows from 4 tabs to 6 when both are on. Six exceeds the
usual 5-tab guidance; restructuring under a "More" entry is deferred until that
release actually ships.

### Running locally

```bash
flutter pub get

# Backend outputs. `lib/amplify_outputs.dart` is git-ignored and generated:
npx ampx sandbox --outputs-format dart --outputs-out-dir lib    # local dev
# or, for a deployed branch:
npx ampx generate outputs --branch production --app-id <id> --format dart --out-dir lib

flutter run                       # needs a device/emulator (see Prerequisites)
```

`flutter analyze` and `flutter test` need **neither** the outputs file to be real
nor any AWS credentials: `tool/stub_amplify_outputs.sh` writes a placeholder
(`const amplifyConfig = '{}';`) when the file is absent, which is exactly what CI
does. It never overwrites a real one.

### Tests

```bash
flutter test test/                          # the whole unit + widget suite
flutter test --coverage test/               # with coverage
dart run tool/check_coverage.dart --min 80  # the affirmed 80% line floor
flutter analyze
dart format --set-exit-if-changed .
```

`check_coverage.dart` reads `coverage/lcov.info`, prints the real percentage and
exits non-zero below the floor. **The floor is never lowered to make a run pass**
— the script refuses a `--min` below 80 for exactly that reason. A shortfall is
surfaced, not hidden.

No test touches AWS, Firebase, the network or a device: every service takes its
gateway, HTTP client and preference store by injection, and the tests use
hand-written fakes (`test/support/`) rather than a mocking framework.

### Running the integration suite (local only)

`integration_test/app_test.dart` is **not** part of CI and not run by
`flutter test test/`. It is where the things a fake cannot prove get proven:
Google sign-in through the real Cognito hosted UI, the admin gate being refused
**server-side**, and Contract 9's guest identity end to end. Prerequisites:

1. `npx ampx sandbox --outputs-format dart --outputs-out-dir lib` running.
2. A connected device or emulator (Android SDK, or Xcode + CocoaPods).
3. Firebase configured (below), for the push-token steps.
4. A Google account, plus a second one that is **not** in the `Admin` group.

```bash
flutter test integration_test/app_test.dart -d <device-id>
```

Most of its tests are marked `skip:` with the manual step they need — read the
file's header before running it.

### Firebase setup (one-time)

Crashlytics (NFR-CRASH.1) and FCM push both need a Firebase project. Until it
exists the app builds and runs normally with crash reporting and push reminders
inert — `lib/services/app_bootstrap.dart` reports Firebase as unavailable and
logs once, and `android/app/build.gradle.kts` applies the Google Services plugin
only when `google-services.json` is present.

```bash
dart pub global activate flutterfire_cli
flutterfire configure --project <firebase-project-id>
```

That writes `android/app/google-services.json` and
`ios/Runner/GoogleService-Info.plist`. Both are **committed** — they are
non-secret client configuration, and `.gitignore` deliberately does not exclude
them. For iOS push you must additionally upload an **APNs authentication key**
(`.p8`) to Firebase → Project settings → Cloud Messaging, and enable the Push
Notifications capability on the Runner target in Xcode.

Crash capture is wired **explicitly** in `main.dart` and is not automatic: the
Crashlytics Flutter plugin catches native crashes on its own, but Dart and async
errors — most of a Flutter app's crashes — are captured only because `main()`
assigns `FlutterError.onError` and `PlatformDispatcher.instance.onError`.
Removing either silently defeats NFR-CRASH.1 while still looking configured.

No crash report ever carries personal data: no custom keys and no user
identifier are set, so a suggestion's text, a donation amount, an email and a
push token cannot reach one.

### Prerequisites for a device build

`flutter analyze` and `flutter test` need only the Flutter SDK. A **build or
device run** additionally needs:

- **Android**: the Android SDK (Android Studio, or the command-line tools) with
  platform 35 and build-tools installed, and `ANDROID_HOME` set. `minSdk` is 24
  (Amplify's floor).
- **iOS**: Xcode with its command-line tools, plus CocoaPods
  (`sudo gem install cocoapods`), then `cd ios && pod install`.

Run `flutter doctor` to confirm. Neither toolchain is required to work on the
Dart code or to run the test suite.

### Release

1. Bump `version:` in `pubspec.yaml` — the build number must strictly increase;
   both stores reject a reused one.
2. Generate the real outputs for the target branch (see "Running locally").
3. Android release signing reads `android/key.properties`:

   ```properties
   storeFile=/absolute/path/to/upload-keystore.jks
   storePassword=...
   keyPassword=...
   keyAlias=upload
   ```

   That file and every `*.jks` / `*.keystore` are git-ignored and never
   committed. **When it is absent the release build falls back to debug
   signing** so a fresh clone still builds — check it is present before
   producing a store artifact.

4. `flutter build appbundle --release` / `flutter build ipa --release`.
5. Work through the release checklist below.

### Release checklist (replaces a second reviewer)

- [ ] No secrets committed — the `gitleaks` pre-commit hook ran, and GitHub's
      secret scanning and push protection are clean.
- [ ] No open Dependabot alerts on `pubspec.yaml` or `package.json`, or each one
      explicitly triaged.
- [ ] Any AWS permissions or auth change double-checked (see the self-review
      trigger below).
- [ ] `flutter analyze`, `dart format --set-exit-if-changed .`,
      `flutter test --coverage test/` and
      `dart run tool/check_coverage.dart --min 80` all pass.
- [ ] The build number was bumped.

### Self-review trigger for sign-in and gating changes

`project.md` § Mandated: any change touching sign-in, permissions or (later)
payment handling gets a brief self-review before merging, even working solo. On
the app side that means a change to any of:

- `lib/services/auth_service.dart`, `lib/services/amplify_gateway.dart`,
  `lib/state/auth_state.dart` — the identity path;
- `lib/app.dart` — the gating and routing rules;
- the auth-mode argument of any call in `lib/services/` — especially the Contract 9
  operations, which must stay `identityPool`, and the public reads, which must
  stay guest-capable;
- `lib/services/donation_service.dart` and `lib/screens/donate_screen.dart`,
  once donations ship.

Ask of each one: _does this change which server-side rule decides access?_ The
answer should always be no — the client only decides what to show.

### Localization

Two languages, one string table per language in `lib/l10n/app_strings.dart`. The
device locale picks the initial language (Hindi for `hi*`, English otherwise) and
the Account screen's toggle overrides it, persisted locally via
`shared_preferences` — a device preference, not a synced Contract field. A key
missing from Hindi falls back to the English string; `t()` never returns a raw
key.

> **The Hindi copy is machine-written and needs a native-speaker review before
> release.** It is correct in structure but not verified for tone or terminology,
> particularly the religious vocabulary (`नित्य पूजन`, `विविध विधान`, `भक्तामर`)
> and the reminder wording.

## Repository hygiene

- **Branching**: trunk-based on `main`, short-lived feature branches,
  squash-merged.
- **Pre-commit secret scanning** (mandatory): `.pre-commit-config.yaml` declares
  the `gitleaks` hook, which scans staged diffs before every commit. Install once
  per machine:

  ```bash
  brew install pre-commit gitleaks   # or: pip install pre-commit
  pre-commit install
  ```

- **GitHub-side scanning** (mandatory second layer): in the GitHub repository
  settings enable _Secret scanning_, _Push protection_ and _Dependabot alerts_
  (Code security and analysis). Dependabot watches both `package.json` and
  `pubspec.yaml`.
- **Self-review**: any change that touches sign-in, permissions (this includes
  `amplify/auth/**` and `amplify/backend.ts`) or payment handling (this includes
  `amplify/functions/donation-*/**`, `amplify/data/resource.ts` and
  `amplify/donations-flag.ts`) gets a brief self-review before merging, even
  when working solo. reminder-unit's IAM (`amplify/backend.ts`, the
  scheduler execution role and `iam:PassRole`) falls under the same rule. On the
  app side the same trigger covers `lib/services/auth_service.dart`,
  `lib/services/amplify_gateway.dart`, `lib/state/auth_state.dart`, `lib/app.dart`
  and any change to a call's auth mode — see [Mobile App](#mobile-app) >
  "Self-review trigger for sign-in and gating changes".
- **CI**: a GitHub Actions workflow on every push/PR to `main` — `npm run lint`,
  `npm run typecheck` and `npm test` on the backend, plus `flutter analyze`,
  `dart format --set-exit-if-changed .`, `flutter test --coverage test/` and
  `dart run tool/check_coverage.dart --min 80` on the app — is added by the CI
  Pipeline stage. If Amplify Hosting's own pipeline is used for deploys, a test
  step must be added to `amplify.yml` deliberately; it runs no app tests by
  default.

## Dependency advisory triage

> **Triaged 2026-10-02** under `team.md` Q8, which accepts "Dependabot alerts
> clear, **or explicitly triaged**". Recorded here so each merge does not
> re-litigate the same 21 findings.

`npm audit` reports 21 vulnerabilities (18 high, 3 moderate). **All of them are
in `devDependencies` — the Amplify build and deploy toolchain. None is in a
runtime dependency.**

Runtime `dependencies` are the AWS SDK clients plus `google-auth-library`;
none is flagged. Nothing vulnerable executes in a Lambda or ships inside the
iOS or Android app.

Root advisories, all reached transitively through `@aws-amplify/backend` and
`@aws-amplify/backend-cli`:

| Package | Severity | Issue |
|---|---|---|
| `immutable` | high | Prototype pollution; `List` trie overflow DoS; hash-collision DoS |
| `brace-expansion` | high | DoS via uncontrolled recursion |
| `lodash` | high | Code injection via `_.template` |
| `csv-parse` | moderate | Prototype replacement via the columns path |
| `mysql2` | — | Decompression-bomb DoS (unused — this project has no MySQL) |

**Why accepted rather than fixed:** the only remedy `npm audit fix --force`
offers is downgrading `@aws-amplify/backend-cli` from 1.x to **0.11.1**, a
breaking change to the entire deploy toolchain — the same toolchain that
provisions the backend. Trading a working deploy path for advisories that
cannot reach production is a poor exchange.

**Exploitability here:** these are reachable only by feeding malicious input to
the local `ampx`/CDK CLI during a build. That presupposes an attacker already
executing code on the builder's machine or in CI, at which point the signing
keys and AWS credentials are the real exposure, not `lodash`.

**Revisit when:** Amplify bumps its transitive dependencies (watch the
`@aws-amplify/backend` changelog), or if any flagged package ever appears in
runtime `dependencies`. Re-run `npm audit --audit-level=high` at that point
rather than assuming this triage still holds.
