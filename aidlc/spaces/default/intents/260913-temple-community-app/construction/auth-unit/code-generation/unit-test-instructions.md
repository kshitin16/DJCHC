# Unit Test Instructions — auth-unit

## Test framework and setup

- **Framework**: Jest with `ts-jest` in ESM mode (the Amplify Gen2 backend is `"type": "module"`), `testEnvironment: 'node'`. Configured in `jest.config.ts` at the workspace root (created in plan Step 2.1).
- **Install**: `npm install` at the workspace root (plan Step 1.9). No AWS credentials, no `ampx sandbox`, and no network access to AWS are needed to run this Unit's tests — they assert the configuration objects exported by `amplify/auth/resource.ts` and `amplify/auth/token-policy.ts`, not deployed Cognito behaviour.

## How to run THIS UNIT's tests

Exact, unit-scoped command (runs only test files under `amplify/auth/` plus `amplify/backend.test.ts`):

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/auth amplify/backend.test.ts
```

The `NODE_OPTIONS=--experimental-vm-modules` prefix is **required**, not optional:
the backend is `"type": "module"` and `jest.config.ts` uses the `ts-jest` ESM
preset, so without it Jest cannot load an ES module and the run fails before any
test executes. Also wired as `npm run test:auth`, which sets the same prefix.

The command is runnable (exit 0) immediately after plan Step 2.2 — before the first test file exists it is verified once with `--passWithNoTests`; from Step 4 onward the script deliberately omits that flag so a missing test file fails.

With coverage for this Unit only:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/auth amplify/backend.test.ts --coverage --collectCoverageFrom='amplify/auth/**/*.ts'
```

Do not use a bare `npm test` / `npx jest` for this Unit — Build and Test runs every Unit's commands, and an unscoped command would rerun the whole backend suite once per Unit.

## Test files and cases (13 tests, smoke-level — walking-skeleton Bolt)

| File | Tests | What each asserts |
|---|---|---|
| `amplify/auth/resource.test.ts` | 6 | (1) `authConfig.groups` is exactly `['Admin']`; (2) Google `clientId`/`clientSecret` are `secret()` references, not string literals; (3) Google scopes include `openid` and `email`; (4) `callbackUrls` contains `sarovarjinalaya://callback/` and `logoutUrls` contains `sarovarjinalaya://signout/`; (5) `attributeMapping.email === 'email'`; (6) `loginWith.email === true` and no `phone` login |
| `amplify/backend.test.ts` | 7 | Declared policy: (7) `tokenPolicy` is 60 min access / 60 min ID / 30 days refresh with matching units; (8) `selfSignUpDisabled === true`. Applied policy — `applyTokenPolicy` driven against a stand-in for the L1 CFN resources: (9) it writes the three validities and `tokenValidityUnits` onto the App Client; (10) it sets `generateSecret: false`; (11) it throws if `generateSecret` is already `true`; (12) it sets `allowAdminCreateUserOnly: true` on the User Pool, merging into an existing `adminCreateUserConfig` without clobbering it; (13) it does not spread an unresolved CDK token into that merged config |

Revision 1 note: tests 9–13 were added because tests 7–8 assert only that the
policy is *declared*. Nothing asserted that `amplify/backend.ts` *applies* it, and
the original evidence for that was a throwaway CDK synth that was run once and
deleted. See "Mocking / stubbing guidance" for why `Template.fromStack` over the
real backend is not available here.

## Expected coverage

- This is the walking-skeleton Bolt (Bolt 1): the affirmed bar is smoke-level (team.md Q5), so **this Unit adds no coverage threshold of its own**. Expected line coverage of `amplify/auth/*.ts` is nonetheless ~100%, since the files are declarative configuration fully exercised by the assertions.
- Revision 1 correction: `jest.config.ts` is a shared file, and donation-unit — the first Unit past the skeleton — has since added the affirmed 80% line-coverage floor (team.md Q6) as `coverageThreshold.global.lines: 80`. It is global, so the `--coverage` command above is now checked against it; `amplify/auth/**/*.ts` clears it comfortably. That floor is never lowered. (`npm run test:auth` passes no `--coverage`, so the plain unit run does not evaluate it.)

## Mocking / stubbing guidance

- Do **not** mock `@aws-amplify/backend`. `resource.ts` exports the raw `authConfig` object separately from `defineAuth(authConfig)`, so tests import `authConfig` and assert on it directly; `defineAuth` is invoked at import time but never synthesized.
- `secret('NAME')` returns a `BackendSecret` object. Test (2) asserts the values are objects (not `typeof 'string'`) — that is the "not a literal" check. Do not compare against a fake secret value.
- No CDK synthesis in unit tests, and none is available: importing `amplify/backend.ts` under Jest throws `No context value present for amplify-backend-namespace key`, because `defineBackend` reads a CDK context key that only `ampx` supplies. A `Template.fromStack` assertion over the real backend would therefore require reimplementing the `ampx` bootstrap. Instead, the overrides live in `amplify/auth/token-policy.ts` as the pure function `applyTokenPolicy(cfnUserPoolClient, cfnUserPool)`, which `backend.ts` calls once; tests 9–13 drive that function against a plain object standing in for the CFN resources and assert what it writes. Use the exported `TokenPolicyClientTarget` / `SelfSignUpPoolTarget` types for those stand-ins — do not mock `aws-cdk-lib`.

## Test data management

- No fixtures, no seeded users, no environment variables. The only "data" is the configuration object under test.
- Google secret names (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) appear in tests only as names being referenced, never as values.

## Integration tests

None for this Unit at the backend level. The end-to-end Google-federation sign-in and the admin-gate check are `integration_test` flows owned by flutter-app-unit (team.md Q7's affirmed test mix; flutter-app-unit's `cicd-pipeline.md` puts them on the local pre-release checklist).
