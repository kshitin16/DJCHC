# Unit Test Instructions — auth-unit

## Test framework and setup

- **Framework**: Jest with `ts-jest` in ESM mode (the Amplify Gen2 backend is `"type": "module"`), `testEnvironment: 'node'`. Configured in `jest.config.ts` at the workspace root (created in plan Step 2.1).
- **Install**: `npm install` at the workspace root (plan Step 1.9). No AWS credentials, no `ampx sandbox`, and no network access to AWS are needed to run this Unit's tests — they assert the configuration objects exported by `amplify/auth/resource.ts` and `amplify/auth/token-policy.ts`, not deployed Cognito behaviour.

## How to run THIS UNIT's tests

Exact, unit-scoped command (runs only test files under `amplify/auth/` plus `amplify/backend.test.ts`):

```bash
npx jest --rootDir . amplify/auth amplify/backend.test.ts
```

Also wired as `npm run test:auth`. The command is runnable (exit 0) immediately after plan Step 2.2 — before the first test file exists it is verified once with `--passWithNoTests`; from Step 4 onward the script deliberately omits that flag so a missing test file fails.

With coverage for this Unit only:

```bash
npx jest --rootDir . amplify/auth amplify/backend.test.ts --coverage --collectCoverageFrom='amplify/auth/**/*.ts'
```

Do not use a bare `npm test` / `npx jest` for this Unit — Build and Test runs every Unit's commands, and an unscoped command would rerun the whole backend suite once per Unit.

## Test files and cases (8 tests, smoke-level — walking-skeleton Bolt)

| File | Tests | What each asserts |
|---|---|---|
| `amplify/auth/resource.test.ts` | 6 | (1) `authConfig.groups` is exactly `['Admin']`; (2) Google `clientId`/`clientSecret` are `secret()` references, not string literals; (3) Google scopes include `openid` and `email`; (4) `callbackUrls` contains `sarovarjinalaya://callback/` and `logoutUrls` contains `sarovarjinalaya://signout/`; (5) `attributeMapping.email === 'email'`; (6) `loginWith.email === true` and no `phone` login |
| `amplify/backend.test.ts` | 2 | (7) `tokenPolicy` is 60 min access / 60 min ID / 30 days refresh with matching units; (8) `selfSignUpDisabled === true` |

## Expected coverage

- This is the walking-skeleton Bolt (Bolt 1): the affirmed bar is smoke-level (team.md Q5), so **no coverage threshold is enforced** in `jest.config.ts` for this Unit's run. Expected line coverage of `amplify/auth/*.ts` is nonetheless ~100%, since the files are declarative configuration fully exercised by the assertions.
- From the second Bolt onward the 80% line-coverage floor (team.md Q6) is added to `jest.config.ts` as `coverageThreshold.global.lines: 80` and never lowered.

## Mocking / stubbing guidance

- Do **not** mock `@aws-amplify/backend`. `resource.ts` exports the raw `authConfig` object separately from `defineAuth(authConfig)`, so tests import `authConfig` and assert on it directly; `defineAuth` is invoked at import time but never synthesized.
- `secret('NAME')` returns a `BackendSecret` object. Test (2) asserts the values are objects (not `typeof 'string'`) — that is the "not a literal" check. Do not compare against a fake secret value.
- No CDK synthesis in unit tests. The `cfnUserPoolClient` / `cfnUserPool` overrides in `backend.ts` are covered by testing the `token-policy.ts` constants they read (tests 7–8); synthesizing the backend belongs to `ampx sandbox` / the deploy pipeline, not to this Unit's Jest run.

## Test data management

- No fixtures, no seeded users, no environment variables. The only "data" is the configuration object under test.
- Google secret names (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) appear in tests only as names being referenced, never as values.

## Integration tests

None for this Unit at the backend level. The end-to-end Google-federation sign-in and the admin-gate check are `integration_test` flows owned by flutter-app-unit (team.md Q7's affirmed test mix; flutter-app-unit's `cicd-pipeline.md` puts them on the local pre-release checklist).
