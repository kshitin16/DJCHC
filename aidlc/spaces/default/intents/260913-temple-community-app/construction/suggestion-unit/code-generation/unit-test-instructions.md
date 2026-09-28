# Unit Test Instructions — suggestion-unit

## Test framework and setup

- **Framework**: Jest 29 + `ts-jest` (ESM), `testEnvironment: 'node'` — the shared runner in `jest.config.ts`; the project-wide 80% line-coverage floor stays in force. The `@aws-appsync/utils` double feed-unit added is reused for the one APPSYNC_JS resolver.
- **Install**: `npm install` after plan Step 1.1 adds `@aws-sdk/client-cloudwatch`.
- No AWS credentials, no `ampx sandbox`, no network: handlers take their repository, metrics emitter, clock, and id generator by injection; the repository and metrics emitter take their SDK clients by injection.

## How to run THIS UNIT's tests

Exact, unit-scoped command:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/data/suggestion amplify/functions/suggestion-shared amplify/functions/submit-suggestion amplify/functions/all-suggestions
```

Wired as `npm run test:suggestion`. It matches `amplify/data/suggestion-schema.test.ts`, `amplify/data/suggestion-resolvers/**`, `amplify/functions/suggestion-shared/**`, `amplify/functions/submit-suggestion/**`, and `amplify/functions/all-suggestions/**` only. Runnable at plan Step 2.1 (verified once with `--passWithNoTests`; the script omits that flag).

With unit-scoped coverage:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/data/suggestion amplify/functions/suggestion-shared amplify/functions/submit-suggestion amplify/functions/all-suggestions --coverage --collectCoverageFrom='amplify/functions/suggestion-shared/**/*.ts' --collectCoverageFrom='amplify/functions/submit-suggestion/handler.ts' --collectCoverageFrom='amplify/functions/all-suggestions/handler.ts' --collectCoverageFrom='amplify/data/suggestion-resolvers/**/*.js'
```

Never use a bare `npm test` as this Unit's own verification.

## Test files and cases (38 tests across 7 files)

| File | Tests | Covers |
|---|---|---|
| `amplify/data/suggestion-schema.test.ts` | 6 | `Suggestion` fields; generated ops disabled on both models; `submitterIndex`; the three Contract 4 operations; authenticated-only vs. Admin-only auth; the counter model exposes nothing to clients |
| `amplify/functions/suggestion-shared/rules.test.ts` | 8 | 300/301 words; whitespace runs; empty text; IST date at the 18:30Z boundary; TTL after next IST midnight + 48 h; `DAILY_LIMIT === 5` |
| `amplify/functions/suggestion-shared/suggestion-repository.test.ts` | 6 | Create condition; Scan pagination; the exact atomic increment expressions (`ADD`, condition `< 5`, key `<sub>#<date>`, `if_not_exists` TTL); condition failure → `{ allowed: false }`; other errors rethrown |
| `amplify/functions/suggestion-shared/metrics.test.ts` | 3 | Namespace/name/value; CloudWatch error swallowed and logged; one call per emission |
| `amplify/functions/submit-suggestion/handler.test.ts` | 7 | Validation before any write; limit reached → no create; increment-then-create ordering with `identity.sub` and `now`; IST-dated counter key; metric after create; metric failure does not fail the submission; create failure surfaced |
| `amplify/functions/all-suggestions/handler.test.ts` | 4 | Non-admin refused; all pages scanned; newest first; empty |
| `amplify/data/suggestion-resolvers/myPastSuggestions.test.ts` | 4 | Query on `submitterIndex`; key is `identity.sub`, never an argument; descending; response items / empty |

Per-component volume (Standard strategy, 5–8 per component): schema 6, rules 8, repository 6, submit handler 7; the metrics emitter (3) and the two single-operation read paths (4 each) are small components whose remaining behaviour is covered by the shared rules/repository tests.

## Expected coverage

- Global floor 80% lines (unchanged). Expected for this Unit's own files ≥ 90%.
- Excluded from collection: `amplify/functions/*/resource.ts`, `amplify/backend.ts`, `amplify/data/test-support/**` (as before).

## Mocking / stubbing guidance

- **Fake, don't mock modules.** Repository tests use a `send(command)` recorder returning canned outputs (paginated Scan; an error with `name === 'ConditionalCheckFailedException'` for the limit case). Metrics tests inject a fake CloudWatch client. Handler tests inject `FakeSuggestionRepository` / `FakeMetrics` with call recording so the increment → create → metric ordering is assertable.
- The `myPastSuggestions` resolver test uses the existing `@aws-appsync/utils` double and the `ctx` builders in `amplify/data/test-support/resolver-context.ts`.
- Never mock `@aws-amplify/backend`; the schema test reads the exported schema definition/SDL.
- Clock and id: injected `now()` and `newId()`; IST tests use fixed UTC instants around `18:30:00Z`.

## Test data management

- Fixtures are object literals built by helpers (`aSuggestion({ text: '…' })`, `wordsOf(n)` to build an n-word string) inside each test file; no fixture directory, no snapshots.

## Integration tests

None in this pass. The walking-skeleton `integration_test` (flutter-app-unit) can later add "signed-in user submits a suggestion → it appears in My Suggestions → an admin sees it in All Suggestions → a non-admin cannot call `allSuggestions`" against `ampx sandbox`, which is also the first real execution of the atomic counter against DynamoDB.
