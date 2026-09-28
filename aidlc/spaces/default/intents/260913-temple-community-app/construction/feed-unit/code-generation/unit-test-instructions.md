# Unit Test Instructions — feed-unit

## Test framework and setup

- **Framework**: Jest 29 + `ts-jest` (ESM), `testEnvironment: 'node'` — the shared runner in `jest.config.ts`. The project-wide 80% line-coverage floor (set by donation-unit) remains in force and is not changed by this Unit.
- **Resolver test double**: the six AppSync JavaScript resolvers import `@aws-appsync/utils`, a module that only exists inside AppSync. `jest.config.ts` maps `^@aws-appsync/utils$` to `amplify/data/test-support/appsync-utils-double.ts`, a small in-repo double implementing exactly the functions the resolvers use (`util.dynamodb.toMapValues`/`toDynamoDB`, `util.time.nowISO8601` with an injectable clock, deterministic `util.autoId`, throwing `util.error`/`util.unauthorized`). It is excluded from coverage.
- **Install**: `npm install` after plan Step 1.1 adds `@aws-appsync/utils` (types).
- No AWS credentials, no `ampx sandbox`, no network. Resolvers are exercised by calling their exported `request(ctx)` / `response(ctx)` with hand-built `ctx` objects.

## How to run THIS UNIT's tests

Exact, unit-scoped command:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/data/post amplify/functions/feed-api
```

Wired as `npm run test:feed`. It matches `amplify/data/post-schema.test.ts`, `amplify/data/post-shared/**`, `amplify/data/post-resolvers/**`, and (Revision 2) `amplify/functions/feed-api/**` only. Runnable at plan Step 2.2 (verified once with `--passWithNoTests`; the script omits that flag).

With unit-scoped coverage:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/data/post amplify/functions/feed-api --coverage --collectCoverageFrom='amplify/data/post-shared/**/*.ts' --collectCoverageFrom='amplify/data/post-resolvers/**/*.{js,ts}' --collectCoverageFrom='amplify/functions/feed-api/handler.ts'
```

Never use a bare `npm test` as this Unit's own verification.

## Test files and cases (Revision 2: 49 tests across 11 files)

| File | Tests | Covers |
|---|---|---|
| `amplify/data/post-schema.test.ts` | 6 | `PostType` values; `Post` fields; generated operations disabled; six Contract 3 operations with exact argument names; guest+authenticated on `listPosts`, `Admin` group only on the five admin operations; input types |
| `amplify/data/post-shared/post-table-config.test.ts` | 1 | `postStreamViewType === 'NEW_AND_OLD_IMAGES'` (Contract 8 commitment) |
| `amplify/data/post-shared/post-rules.test.ts` | 8 | BR2.1 type validation; BR2.2 boundary lengths (100/101, 1000/1001); partial validation; 24h cutoff; visibility incl./excl.; descending sort |
| `amplify/functions/feed-api/handler.test.ts` | 6 | Revision 2 — Lambda-backed `listPosts`: Scan filter with both clauses and exact cutoff; sort; `LastEvaluatedKey` pagination; empty; data-source error surfaced; deleted rows never returned |
| `amplify/data/post-resolvers/post-rules-parity.test.ts` | 5 | The rule functions inlined in the five admin JS resolvers behave identically to `post-rules.ts` |
| `amplify/data/post-resolvers/listAllPostsForAdmin.test.ts` | 4 | `deletedAt`-only filter; sort; non-admin unauthorized; admin passes |
| `amplify/data/post-resolvers/getPost.test.ts` | 4 | GetItem key; missing → null; deleted → null; live returned |
| `amplify/data/post-resolvers/createPost.test.ts` | 6 | Validation before request; type rejection; identity from `ctx.identity.sub`; timestamps + `__typename`; condition; server-generated id |
| `amplify/data/post-resolvers/updatePost.test.ts` | 5 | Only supplied fields; `updatedAt`; partial validation; refuses deleted; `createdByGoogleId` immutable |
| `amplify/data/post-resolvers/deletePost.test.ts` | 4 | Soft delete sets `deletedAt` + `updatedAt`; never `DeleteItem`; refuses second delete; non-admin unauthorized |

Per-component volume (Standard strategy, 5–8 per component): schema 6, rules 8, the `feed-api` Lambda 6, and the five admin resolvers 4–6 each (the two 4-test resolvers are single-operation files whose remaining behaviour is the shared rules already covered).

## Expected coverage

- Global floor 80% lines (unchanged). Expected for this Unit's own files ≥ 90% — the resolvers and rules are small pure functions.
- Excluded from collection: `amplify/data/test-support/**` (the double), `amplify/backend.ts`, `amplify/functions/*/resource.ts` (as before).

## Mocking / stubbing guidance

- The only "mocks" are the `@aws-appsync/utils` double above (for the five admin JS resolvers) and, for the `feed-api` Lambda, a fake DynamoDB document client with a `send(command)` recorder exactly as donation-unit's repository tests use. Do not mock `@aws-amplify/backend`; the schema test reads the exported schema definition.
- Build `ctx` objects with small helpers per file: `adminCtx(args)` (identity with `groups: ['Admin']`, `sub: 'admin-sub'`), `userCtx(args)` (no groups), `guestCtx()`; `resultCtx(items)` for `response()`.
- The double's clock is set per test (`setNow('2026-09-17T10:00:00Z')`) so the 24h cutoff assertions are exact.
- If Step 7.2 takes path (b) (inlined rule functions in the resolvers), add one parity test per resolver asserting its inlined validator returns the same verdicts as `post-rules.ts` for a fixed table of inputs.

## Test data management

- Fixtures are object literals via `aPost({ dateTime: '…', deletedAt: undefined })` inside each test file; no fixture directory, no snapshots.

## Integration tests

None at the backend level in this pass. The end-to-end "sign in → admin creates one post → it appears in the public feed → a non-admin cannot create" flow is the walking skeleton's `integration_test` owned by flutter-app-unit (team.md Q7), run locally against `ampx sandbox` — which is also where the AppSync JS resolvers get their first real execution (Jest runs them against the double, not the APPSYNC_JS runtime).
