# Code Generation Plan — feed-unit

> **Revision 2 (builder's decision after the first build):** the installed Amplify version refuses identity-pool guest authorization on `a.handler.custom` operations, and the first build fell back to an AppSync API key (expires ≤ 365 days). The builder chose instead to make `listPosts` a small Lambda-backed query with the guest-identity rule the design intended. Steps 3.1, 3.2, 9.1, 10.2 and the deviations list are revised accordingly; the five admin operations stay as JS resolvers. Everything already built stays valid except where a revised step says otherwise.

## Scope

feed-unit (U2, `kind: service`, **first release — walking-skeleton member**) owns the `Post` entity (`entities.md`) and the six Contract 3 operations: public `listPosts`, admin-only `listAllPostsForAdmin` / `getPost` / `createPost` / `updatePost` / `deletePost`. Rules BR2.1–BR2.7 (`rules.md`) and the five workflows in `functional-spec.md` are approved. Per `infrastructure-specification.md` this Unit was designed with no Lambda of its own; Revision 2 adds exactly one small Lambda (`feed-api`, backing `listPosts` only — see 9.1) because the installed Amplify version cannot combine guest-identity authorization with a no-Lambda custom resolver. The five admin operations remain AppSync resolvers over the `Post` table, with DynamoDB Streams enabled (`NEW_AND_OLD_IMAGES`) so reminder-unit's Contract 8 handler can observe `dateTime` changes and soft-deletes.

This Unit extends the shared `amplify/data/resource.ts` schema donation-unit introduced, adds AppSync **JavaScript resolvers** (the APPSYNC_JS runtime — no Lambda, matching the infra spec), and enables Streams on the `Post` table in `amplify/backend.ts`. Everything is live in the first release (no feature flag).

Out of scope: `services/feed_service.dart` and the Feed / Admin Post List screens (flutter-app-unit), the Contract 8 consumer (reminder-unit).

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "implement each applicable testable layer, then write and",
  "scope": "temple-mobile-app",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and\n  run that layer's tests, with the walking-skeleton Bolt held to a lighter\n  smoke-level bar across the board — including the admin allowlist gate —\n  and the standard 80% line-coverage floor applying from the second Bolt\n  onward.\n\nAffirmed specifics (Q4-Q7):\n\n- **Test-after, not TDD/BDD** (Q4): writing code first, then its tests,\n  fits a builder who doesn't yet have confidence in the API/widget shapes\n  of either Flutter or Amplify Gen2 — test-first would compound that\n  learning-curve risk.\n- **Walking-skeleton Bolt test rigor: light smoke-level check everywhere in\n  the skeleton, including the admin allowlist gate** (Q5 — Answer A). The\n  quality agent's review recommended a stricter option for the admin gate\n  specifically (a real pass/fail assertion proving non-admins are\n  rejected, since it's a security boundary), but the human deliberately\n  chose the lighter, uniform smoke-level bar for the entire skeleton\n  instead. This is recorded as the builder's considered choice, not an\n  oversight — a proper test for the admin gate's server-side enforcement\n  is expected to land with the fuller coverage floor from the second Bolt\n  onward, once the architecture is proven end-to-end.\n- **Coverage target beyond the skeleton: the org default's 80%\n  line-coverage floor, adopted as-is** (Q6). The quality agent flagged\n  that the 80% floor's applicability was ambiguous under the custom\n  `temple-mobile-app` scope signal (it isn't in the org default's named\n  scope list); the builder resolved this directly by choosing to adopt the\n  80% target rather than a looser or undefined bar.\n- **CI + backend test framework: GitHub Actions with Jest** (Q7). A single\n  GitHub Actions workflow runs on every push/PR to `main`: `flutter\n  analyze` + `flutter test --coverage` on the Flutter app side, and\n  ESLint/`tsc --noEmit` + Jest on the Amplify Gen2/TypeScript backend\n  side (Lambda handlers, AppSync resolver logic) — blocking merge on\n  failure. This is the project's only enforcement mechanism for test\n  quality, since there is no second reviewer to catch a skipped or\n  weakened test. If Amplify Hosting's own build pipeline is used for\n  deploys, a test step must be added to `amplify.yml` deliberately —\n  Amplify Hosting does not run app-level tests by default.\n- Test-type mix (carried forward from the quality agent's contribution,\n  not separately re-asked, since it elaborates rather than contradicts the\n  affirmed methodology): Flutter unit tests for business logic,\n  `flutter_test` widget tests for UI, and `integration_test` for\n  higher-risk end-to-end flows (Cognito/Google-federation sign-in, the\n  admin allowlist gate, and later the donation flow) — integration-level\n  coverage matters more than usual here because a unit test that mocks the\n  Amplify client can pass while the real integration is still broken. On\n  the backend, Jest unit tests for Lambda handlers and schema/contract\n  checks against the AppSync GraphQL schema, exercised against Amplify\n  Gen2's local sandbox (`ampx sandbox`) rather than a live deployed\n  environment."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:817e454c78e3d1ec2c498999a8752124a36e6c73860f504900f17dbf0ec17f6a",
  "contract_sha256": "sha256:322e5d191e27095d9fb5ca26b5cd076c3c99c52b68d46d1e676c77d2a10d3881"
}
```

## Steps

Test-after per the contract. feed-unit is part of the walking skeleton (sign-in → one feed post → admin gate), so the skeleton's smoke-level bar applies to *this Unit's* tests; the project-wide 80% floor donation-unit switched on stays in force for the whole suite and is not lowered. In practice the resolver logic below is small and pure, so the Unit's own files are expected to land well above 80% regardless.

### Step 1 — Project structure

- [x] 1.1 Add devDependency `@aws-appsync/utils` (types for the APPSYNC_JS runtime; no runtime code ships with it). `npm install`.
- [x] 1.2 Create `amplify/data/post-resolvers/` for the six resolver files and `amplify/data/post-shared/` for the pure logic they share, plus `amplify/data/test-support/appsync-utils-double.ts` (a minimal test double for the handful of `@aws-appsync/utils` functions the resolvers use — see Step 2).

### Step 2 — Test runner: unit-scoped command and the resolver test double

- [x] 2.1 In `jest.config.ts`, add a `moduleNameMapper` entry mapping `^@aws-appsync/utils$` to `<rootDir>/amplify/data/test-support/appsync-utils-double.ts` so resolver files import cleanly under Jest (the real module exists only inside AppSync). Exclude `amplify/data/test-support/**` from `collectCoverageFrom`. Do not touch `coverageThreshold`.
- [x] 2.2 Add script `test:feed`: `NODE_OPTIONS=--experimental-vm-modules jest --rootDir . amplify/data/post` (matches `amplify/data/post-resolvers/**` and `amplify/data/post-shared/**` plus `amplify/data/post-schema.test.ts`). Verify once with `--passWithNoTests`; the script omits it. Confirm `npm test` still passes.

### Step 3 — Data model: the `Post` model, Streams, and Contract 3's operations

- [x] 3.1 In `amplify/data/resource.ts`, add enum `PostType { EVENT VISITING_DIGNITARY DONATION_CALL_OUT }` and model `Post` with `entities.md`'s fields: `type` (required enum), `title`, `description`, `dateTime` (required datetime), `createdByGoogleId` (required), `createdAt`, `updatedAt` (required), `deletedAt` (optional). Disable the generated CRUD operations on the model (`.disableOperations([...])` for queries, mutations and subscriptions) so the generated `listPosts`/`getPost` names do not collide with Contract 3's custom operations; the table still exists as the resolvers' data source. Model-level authorization: `allow.guest().to(['read'])`, `allow.authenticated().to(['read'])`, `allow.group('Admin')` — declarative, and documented as what actually enforces BR2.3 alongside the operation-level rules below. **Revision 2:** no `apiKeyAuthorizationMode` on `defineData` and no `allow.publicApiKey()` anywhere — the API-key fallback from the first build is removed.
- [x] 3.2 Add custom types `CreatePostInput { type, title, description, dateTime }` and `UpdatePostInput { type?, title?, description?, dateTime? }` and the six Contract 3 operations, each with `a.handler.custom({ dataSource: a.ref('Post'), entry: './post-resolvers/<name>.js' })`:
  - `listPosts: [Post!]!` — **Revision 2:** `a.handler.function(feedApi)` (the `feed-api` Lambda from 9.1), authorization `allow.guest()`, `allow.authenticated()` — public read via the Cognito Identity Pool unauthenticated role, the same mode Contract 9 uses. (Guest is refused on `a.handler.custom` by `@aws-amplify/data-schema@1.26.1`, which is why this one operation is Lambda-backed.)
  - `listAllPostsForAdmin: [Post!]!`, `getPost(id: ID!): Post`, `createPost(input: CreatePostInput!): Post!`, `updatePost(id: ID!, input: UpdatePostInput!): Post!`, `deletePost(id: ID!): Post!` — `allow.group('Admin')` only (BR2.3/BR2.7, Contract 2). Names, arguments, and return shapes exactly per Contract 3. If custom-type arguments are not supported by the installed `@aws-amplify/backend`, fall back to scalar arguments and report it.
- [x] 3.3 In `amplify/backend.ts`, enable DynamoDB Streams on the `Post` table with `StreamViewType: NEW_AND_OLD_IMAGES` (`security-design.md`: load-bearing for Contract 8's `PostDeleted` detection) via the table's CFN resource; leave auth-unit's and donation-unit's wiring untouched.
- [x] 3.4 `npx tsc --noEmit` passes.

### Step 4 — Data model: tests

- [x] 4.1 `amplify/data/post-schema.test.ts` (6 tests): `PostType` values match Contract 3; `Post` declares every `entities.md` field; generated model operations are disabled; the six custom operations exist with Contract 3's argument names; `listPosts` allows guest + authenticated while the five admin operations allow only the `Admin` group; `CreatePostInput`/`UpdatePostInput` carry the four fields. Assert on the schema definition / transformed SDL, as donation-unit's schema test does.
- [x] 4.2 `amplify/data/post-shared/post-table-config.ts` exports `postStreamViewType = 'NEW_AND_OLD_IMAGES' as const` (imported by `backend.ts`); a 1-test file asserts it, so the Streams commitment is pinned outside the coverage-excluded `backend.ts`.

### Step 5 — Repository / data access: omitted with reason

No repository layer: AppSync JS resolvers talk to DynamoDB directly through the request/response mapping the APPSYNC_JS runtime provides; the "data access" is the resolver's `request()` function, built and tested in Steps 7–10.

### Step 6 — (no tests for the omitted layer)

### Step 7 — Business logic: pure helpers shared by the resolvers

- [x] 7.1 `amplify/data/post-shared/post-rules.ts` (plain TS, no AppSync imports): `POST_TYPES`, `TITLE_MAX = 100`, `DESCRIPTION_MAX = 1000`, `validatePostInput(input, { partial })` (BR2.1, BR2.2 — returns `{ ok } | { ok: false, message }`), `ageOutCutoffIso(nowIso)` (now − 1 day, BR2.4), `isVisibleInFeed(post, nowIso)` (not deleted AND `dateTime >= cutoff`), `isNotDeleted(post)` (BR2.6), `sortMostRecentFirst(posts)` (by `dateTime` desc, BR2.4).
- [x] 7.2 Because the APPSYNC_JS runtime cannot import arbitrary modules, each resolver file in Step 9 either (a) imports `post-rules.ts` relatively if the installed Amplify version bundles custom-resolver entries with esbuild (check `@aws-amplify/backend`'s custom handler bundling in `node_modules`), or (b) inlines the same small functions with a `// mirrors post-shared/post-rules.ts` comment and a Jest test asserting the two stay identical in behaviour. Report which path was taken.

### Step 8 — Business logic: tests

- [x] 8.1 `post-rules.test.ts` (8 tests): each valid type accepted, unknown type rejected (BR2.1); title at 100 accepted, 101 rejected; description at 1000 accepted, 1001 rejected (BR2.2); partial validation skips absent fields; cutoff is exactly 24h before now; `isVisibleInFeed` includes a post 23h in the past, excludes 25h in the past and any deleted post; sort is dateTime-descending.

### Step 9 — API / endpoint: the six AppSync JS resolvers

Each file exports `request(ctx)` and `response(ctx)` in the APPSYNC_JS style and uses only `@aws-appsync/utils` (`util.dynamodb.toMapValues`, `util.time.nowISO8601`, `util.autoId`, `util.error`, `util.unauthorized`).

- [x] 9.1 **Revision 2 — `amplify/functions/feed-api/resource.ts` + `handler.ts`** (replaces the `listPosts.js` resolver, which is deleted along with its test): `defineFunction` 128MB/10s, `resourceGroupName: 'data'`, env `POST_TABLE_NAME`; least-privilege IAM `Scan` on the `Post` table only (wired in `backend.ts` like the donation Lambdas). Handler (`createHandler(deps)` factory, injected document client and clock, imports `post-rules.ts` directly — Lambdas are bundled): DynamoDB `Scan` with filter `attribute_not_exists(deletedAt) AND dateTime >= :cutoff`, follows `LastEvaluatedKey` until exhausted, sorts most-recent-first with `sortMostRecentFirst` (BR2.4, BR2.6), returns the public `Post` shape. A Scan is deliberate at this table's projected few-hundred-row size; the file names the `feedIndex` GSI to add if it grows. reminder-unit's `myReminders` Lambda later reaches this operation through `allow.resource(fn)`, noted in the file.
- [x] 9.2 `listAllPostsForAdmin.js` — Scan with `attribute_not_exists(deletedAt)` only (BR2.7, no age-out), sorted most-recent-first.
- [x] 9.3 `getPost.js` — `GetItem` by `id`; response returns `null` when the item is missing or `deletedAt` is set (BR2.6: a deleted post is never returned).
- [x] 9.4 `createPost.js` — validates BR2.1/BR2.2 (`util.error` with a specific message on failure, before any write); `PutItem` with `id = util.autoId()`, `createdByGoogleId = ctx.identity.sub`, `createdAt = updatedAt = now`, `__typename = 'Post'`, condition `attribute_not_exists(id)`.
- [x] 9.5 `updatePost.js` — validates the supplied fields (partial); `UpdateItem` setting only the supplied fields plus `updatedAt`, with condition `attribute_exists(id) AND attribute_not_exists(deletedAt)` (an already-deleted post is refused); a changed `dateTime` naturally lands as a Streams MODIFY record for Contract 8 — no extra code.
- [x] 9.6 `deletePost.js` — `UpdateItem` setting `deletedAt = now` and `updatedAt = now`, condition `attribute_exists(id) AND attribute_not_exists(deletedAt)` (BR2.6 soft delete; refuses a second delete). Never a `DeleteItem`.
- [x] 9.7 Every admin resolver additionally checks `ctx.identity.groups` contains `Admin` and calls `util.unauthorized()` otherwise — defense in depth behind the declarative `allow.group('Admin')` rule, with a comment stating that the declarative rule is the enforcing layer and this check is a backstop.
- [x] 9.8 `npm run lint` and `npm run typecheck` pass (resolver files are plain ES modules type-checked via `// @ts-check` + the `@aws-appsync/utils` types, or `.ts` compiled by Amplify's bundler if that is what the installed version expects — match what `@aws-amplify/backend@1.25.0` documents for `a.handler.custom` entries).

### Step 10 — API / endpoint: tests

- [x] 10.1 `amplify/data/test-support/appsync-utils-double.ts`: implements `util.dynamodb.toMapValues/toDynamoDB`, `util.time.nowISO8601` (injectable clock), `util.autoId` (deterministic), `util.error` (throws), `util.unauthorized` (throws) — enough to execute the resolvers in Jest.
- [x] 10.2 **Revision 2 — `amplify/functions/feed-api/handler.test.ts` (6)** with a fake document client: Scan carries both filter clauses and a cutoff exactly 24h before the injected now; results sorted descending; pagination follows `LastEvaluatedKey` and concatenates pages; empty table returns `[]`; a data-source error is surfaced, not swallowed; the response never includes `deletedAt`-set rows even if the fake returns one (defense in depth).
- [x] 10.3 `listAllPostsForAdmin.test.ts` (4): Scan filter has only the `deletedAt` clause; sorted; non-admin identity → unauthorized; admin passes.
- [x] 10.4 `getPost.test.ts` (4): GetItem key; missing → `null`; deleted → `null`; live post returned.
- [x] 10.5 `createPost.test.ts` (6): over-length title rejected before any request is built; unknown type rejected; happy path sets `createdByGoogleId` from `identity.sub` (never from input), `createdAt`/`updatedAt`, `__typename`; condition `attribute_not_exists(id)`; non-admin → unauthorized; `id` is generated, not client-supplied.
- [x] 10.6 `updatePost.test.ts` (5): only supplied fields in the update expression; `updatedAt` always set; partial validation; condition refuses a deleted post; `createdByGoogleId` can never be changed.
- [x] 10.7 `deletePost.test.ts` (4): sets `deletedAt` and `updatedAt`; never issues `DeleteItem`; condition refuses a second delete; non-admin → unauthorized.
- [x] 10.8 `npm run test:feed` green; `npm test -- --coverage` green with the 80% floor; lint, typecheck, prettier clean.

### Omitted layer

- **Frontend behavior**: `services/feed_service.dart`, the Feed screen and the Admin Post List belong to flutter-app-unit.

### Step 11 — Environment/build configuration

- [x] 11.1 `README.md`: a "Feed" section — the six operations and who may call them, the public-read model (guest identity), the soft-delete semantics, and a note that the `Post` table's Streams (`NEW_AND_OLD_IMAGES`) are consumed by reminder-unit.

### Step 12 — Documentation and traceability

- [x] 12.1 Doc comments naming the rule each resolver realizes (BR2.1–BR2.7, NFR-AUTHZ.1, NFR4.1).
- [x] 12.2 Write `source-manifest.json` (every path created or modified; not `node_modules/`).
- [x] 12.3 The conductor writes `code-summary.md` and `traceability.json`, and closes the accepted-risk finding feed-unit R-01 (Infrastructure Design) by amending the infra spec's Cognito User Pool row to name `listAllPostsForAdmin` and `getPost` as admin-gated.

## Rule-to-step traceability

| Rule / requirement | Realized by |
|---|---|
| BR2.1 declared type only | 7.1, 8.1, 9.4/9.5, 10.5 |
| BR2.2 length limits | 7.1, 8.1, 9.4/9.5, 10.5/10.6 |
| BR2.3 admin-only mutations | 3.2 `allow.group('Admin')` (enforcing layer), 9.7 backstop, 10.5–10.7 |
| BR2.4 public read filter + order | 9.1, 10.2 |
| BR2.5 dateTime edit re-evaluates age-out | 9.5 (filter is read-time, 9.1) |
| BR2.6 soft delete hidden everywhere | 9.3, 9.6, 10.4, 10.7; filters in 9.1/9.2 |
| BR2.7 admin view bypasses age-out | 9.2, 10.3 |
| NFR-AUTHZ.1 public read vs admin write | 3.1–3.2 |
| NFR4.1 encryption | DynamoDB-managed; no code |
| Contract 8 (Streams `NEW_AND_OLD_IMAGES`) | 3.3, 4.2 |
| NFR1.1–1.3 latency budgets | Direct resolvers, no Lambda (9.x) |

## Known deviations declared up front

- **`deletedAt` visible in the GraphQL `Post` type** — Contract 3's `Post` has no `deletedAt`; the model field is exposed as an optional, always-null-in-responses attribute (deleted posts are never returned). Additive, permitted by the contract ownership rules; noted for the contract summary.
- **Scan, not Query, for the two list operations** — deliberate at this table's projected size (see 9.1); the future index is named in the code.
- **One Lambda (`feed-api`) for `listPosts`** — Revision 2; contrary to the infra spec's "no Lambda of its own", forced by the installed Amplify version's guest-auth restriction on custom resolvers. The infra spec gets an amendment note; the five admin operations remain Lambda-free.
- **Generated model operations disabled** to keep Contract 3's operation names exact.
