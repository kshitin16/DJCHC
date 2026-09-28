# Code Summary — feed-unit

Built in two passes. The first pass implemented the whole design and discovered that the installed Amplify version (`@aws-amplify/data-schema@1.26.1`) refuses identity-pool guest authorization on no-Lambda custom resolvers, falling back to an AppSync API key (expires ≤ 365 days). The builder rejected that fallback; **Revision 2** made the public `listPosts` a small Lambda-backed query with the guest-identity rule the design intended and removed the API-key mode entirely. The five admin operations are AppSync JavaScript resolvers with no Lambda, as designed.

## Files created / modified

28 entries in `source-manifest.json`; workspace-relative.

| Path | Kind | Purpose |
|---|---|---|
| `package.json`, `package-lock.json` | modified | devDependency `@aws-appsync/utils@^2.1.1` (types for the APPSYNC_JS runtime); script `test:feed` (unit-scoped: `amplify/data/post` + `amplify/functions/feed-api`). |
| `jest.config.ts` | modified | `moduleNameMapper` for `@aws-appsync/utils` → the in-repo test double; resolver `.js` files added to and `test-support/**` excluded from `collectCoverageFrom`. `coverageThreshold` untouched (80% lines). |
| `tsconfig.json` | modified | `allowJs`/`checkJs`; includes `amplify/data/post-resolvers/*.js` so the `// @ts-check` resolvers are type-checked. |
| `amplify/data/resource.ts` | modified | Appended `PostType` enum, `Post` model (every `entities.md` field incl. `deletedAt`) with `disableOperations(['queries','mutations','subscriptions'])` so Contract 3's operation names are exact; model auth `allow.guest().to(['read'])`, `allow.authenticated().to(['read'])`, `allow.group('Admin')`; custom types `CreatePost`/`UpdatePost` (Amplify appends `Input` for argument use → `CreatePostInput`/`UpdatePostInput` in the SDL); `listPosts` (guest + authenticated, **`a.handler.function(feedApi)`**); `listAllPostsForAdmin`, `getPost`, `createPost`, `updatePost`, `deletePost` (`allow.group('Admin')`, `a.handler.custom` JS resolvers). No `apiKeyAuthorizationMode`. Donation content untouched. |
| `amplify/backend.ts` | modified | `feedApi` added to `defineBackend`; least-privilege `dynamodb:Scan` on the `Post` table only + `POST_TABLE_NAME` injected; DynamoDB Streams enabled on the `Post` table with `NEW_AND_OLD_IMAGES` (Contract 8). auth-unit and donation-unit wiring untouched. |
| `amplify/functions/feed-api/resource.ts`, `handler.ts` (+ `handler.test.ts`) | created (Rev 2) | 128MB/10s, `resourceGroupName: 'data'`. `createHandler(deps)` factory (injected document client + clock); `Scan` with `attribute_not_exists(deletedAt) AND dateTime >= :cutoff`, follows `LastEvaluatedKey`, defensive `isVisibleInFeed`, sorted most-recent-first; returns the public `Post` shape. Data-source errors surfaced. 6 tests. |
| `amplify/data/post-shared/post-rules.ts` (+ test) | created | Reference rules: BR2.1/2.2 `validatePostInput`, BR2.4 `ageOutCutoffIso`/`isVisibleInFeed`, BR2.6 `isNotDeleted`, `sortMostRecentFirst`, `canonicalDateTimeIso`. 8 tests. |
| `amplify/data/post-shared/post-table-config.ts` (+ test) | created | `postStreamViewType = 'NEW_AND_OLD_IMAGES'` — the Contract 8 commitment pinned outside the coverage-excluded `backend.ts`. 1 test. |
| `amplify/data/post-resolvers/{listAllPostsForAdmin,getPost,createPost,updatePost,deletePost}.js` (+ tests) | created | APPSYNC_JS resolvers (`// @ts-check` + JSDoc). Admin-group backstop check (`util.unauthorized()`) behind the declarative rule; soft delete via `UpdateItem` (never `DeleteItem`); conditions refuse already-deleted posts; `createdByGoogleId` from `ctx.identity.sub`, immutable on update; `dateTime` canonicalized on write so string comparison/sort is chronological. 4/4/6/5/4 tests. |
| `amplify/data/post-resolvers/post-rules-parity.test.ts` | created | 5 tests proving the rule functions inlined in the resolvers (APPSYNC_JS cannot import modules; Amplify uploads `entry` files verbatim) behave identically to `post-rules.ts`. |
| `amplify/data/post-schema.test.ts` | created | 6 SDL/definition tests (enum, fields, disabled generated ops, six operations, auth modes incl. "no API key anywhere", input types). |
| `amplify/data/test-support/appsync-utils-double.ts`, `resolver-context.ts` | created | The `@aws-appsync/utils` double (injectable clock, deterministic `autoId`, throwing `error`/`unauthorized`, `toMapValues`) and `ctx` builders. Excluded from coverage. |
| `README.md` | modified | "Feed" section: the six operations and who may call them; public read = Identity Pool guest role (nothing expires, no API key); soft-delete semantics; Streams consumed by reminder-unit; self-review checklist for the permission surface. |

## Key implementation decisions

1. **Lambda for `listPosts` only (Revision 2)** — `@aws-amplify/data-schema@1.26.1` hard-refuses `allow.guest()` on `a.handler.custom` (`SchemaProcessor`: "not currently supported with handler.custom"). The builder chose one small Lambda over an expiring API key. The five admin operations stay Lambda-free. When Amplify lifts the restriction, `listPosts` can move back to a JS resolver with no behaviour change.
2. **Step 7.2 path (b)** — Amplify uploads custom-resolver `entry` files verbatim (no bundling), so each admin resolver inlines its rule functions with a `// mirrors post-shared/post-rules.ts` marker, and the parity test pins them to the reference implementation. The Lambda imports `post-rules.ts` directly.
3. **Generated model operations disabled** (`disableOperations`) rather than renaming the model, keeping the GraphQL type `Post` and Contract 3's names exact.
4. **`dateTime` canonicalized on write** — APPSYNC_JS `Array.prototype.sort()` takes no comparator and the DynamoDB range filter is a string comparison; both are chronological only for canonical ISO-8601.
5. **`updatePost` with no supplied fields is refused** (addition beyond the plan, documented).
6. **Conditional-check failures** on update/delete map to "post not found or already deleted"; other data-source errors are surfaced unchanged.

## Test coverage summary

- `npm run test:feed` → **10 suites, 49 tests, 49 passed** (re-run by the conductor after the developer's hand-back).
- `npm test -- --coverage` → **22 suites, 118 tests, 118 passed; 93.0% statements / 86.1% branches / 87.8% functions / 93.9% lines** (80% floor enforced). auth-unit and donation-unit suites remain green.
- `npm run lint`, `npm run typecheck`, `prettier --check` → clean (conductor-verified).
- No integration test in this pass: the walking-skeleton `integration_test` (sign in → admin posts → public feed shows it → non-admin refused) is flutter-app-unit's, against `ampx sandbox` — also the first real APPSYNC_JS execution of the resolvers (Jest runs them against the double).

## Deviations from the design and plan

| Deviation | Why | Effect |
|---|---|---|
| One Lambda (`feed-api`) where the infra spec said "none of its own" | Installed Amplify version refuses guest auth on custom resolvers; builder rejected the API-key fallback | Infra spec amendment note recorded in the stage diary; ~128MB Lambda, cold-start well inside NFR1's 2s feed budget |
| `deletedAt` present on the GraphQL `Post` type | Model field; always null in query responses (deleted posts are never returned); non-null only in `deletePost`'s own response | Additive, allowed by the contract ownership rules; noted for the contract summary |
| Both list operations Scan (single-page for the admin resolver; paginated in the Lambda) | Table projected at a few hundred rows; `feedIndex` GSI named in code for growth | None today |
| `test:donation` script's `amplify/data` pattern also matches feed tests | Pre-existing script; harmless | Left as-is |

## Open items (not defects)

- **reminder-unit** must reach `listPosts` from its `myReminders` Lambda via `allow.resource(fn)` on the schema (recorded for its plan).
- **flutter-app-unit** calls `listPosts` with `authorizationMode: identityPool` when signed out.
- Infrastructure Design note for feed-unit R-01 was applied (admin-gated reads named).
