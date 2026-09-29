# Code Summary — auth-unit

## Files created / modified

All paths are workspace-relative (`/Users/kshitin/DJCHCApp`). This Unit also bootstrapped the whole Amplify Gen2 backend project, so most entries are project scaffold that every later backend Unit builds on.

| Path | Kind | Purpose |
|---|---|---|
| `.git/` | created (dir) | Repository initialized on branch `main` via `git init -b main`; **no commits made** — committing is the builder's call after `pre-commit install`. |
| `.gitignore` | modified (merged) | Appended a delimited `# BEGIN/END sarovar-jinalaya-backend:gitignore` block: `node_modules/`, `.amplify/`, `amplify_outputs*`, `coverage/`, `dist/`, `*.tsbuildinfo`, `.env*`. The existing AI-DLC block is untouched. |
| `package.json` | created | `sarovar-jinalaya-backend`, private, ESM. Scripts: `lint`, `format`, `format:check`, `typecheck`, `test`, `test:auth` (unit-scoped), `sandbox`. |
| `package-lock.json`, `node_modules/` | created | From `npm install` (1172 packages). |
| `tsconfig.json` | created | es2022 / bundler resolution / strict / skipLibCheck / `$amplify/*` path alias; includes `amplify/**/*.ts` and `jest.config.ts`. |
| `jest.config.ts` | created | ts-jest ESM preset, node environment, `.js`→`.ts` module mapper, `collectCoverageFrom: ['amplify/**/*.ts', '!amplify/backend.ts']`, **no `coverageThreshold`** (walking-skeleton Bolt; the 80% floor is added at Bolt 2). |
| `eslint.config.js`, `.prettierrc`, `.prettierignore` | created | Flat ESLint config (`typescript-eslint` recommended + `eslint-config-prettier`); Prettier scoped away from `aidlc/` and `.claude/`. |
| `.pre-commit-config.yaml` | created | Declares the `gitleaks` hook at `rev: v8.30.1`. Installed on the machine with `pre-commit install` (manual step; `gitleaks` 8.30.1 and `pre-commit` 4.6.2 are now installed locally). |
| `README.md` | created | "Backend" section (layout, prerequisites, install/test/lint, `npx ampx sandbox`, the two `ampx sandbox secret set` commands, per-environment Google redirect-URI registration table per `infrastructure-specification.md`, `Admin` group administration via `aws cognito-idp admin-add-user-to-group` / `admin-remove-user-from-group`) and "Repository hygiene" (`pre-commit install`, GitHub secret scanning / push protection / Dependabot, the sign-in self-review rule). |
| `amplify/package.json` | created | `{ "type": "module" }` — Amplify Gen2 convention. |
| `amplify/auth/resource.ts` | created | `authConfig` (exported, `satisfies Parameters<typeof defineAuth>[0]`) and `auth = defineAuth(authConfig)`: email sign-in attribute, Google provider with `secret('GOOGLE_CLIENT_ID')` / `secret('GOOGLE_CLIENT_SECRET')`, scopes `openid email profile`, `attributeMapping.email`, `callbackUrls: ['sarovarjinalaya://callback/']`, `logoutUrls: ['sarovarjinalaya://signout/']`, `groups: ['Admin']`, `userAttributes.email.required`. Doc comments name BR1.1/BR1.2/BR1.4, NFR3.1/3.2/3.4/3.5, Contracts 1 and 2. |
| `amplify/auth/token-policy.ts` | created | `tokenPolicy` = 60 min access / 60 min ID / 30 days refresh (`as const`) and `selfSignUpDisabled = true`, with BR1.3 / NFR3.1 / NFR3.4 doc comments. |
| `amplify/backend.ts` | created | `defineBackend({ auth })`; applies `tokenPolicy` to `cfnUserPoolClient` (validity + units); throws at synth time if `generateSecret` were ever `true` and sets it explicitly `false` (PUBLIC client, PKCE); merges `allowAdminCreateUserOnly: true` into `cfnUserPool.adminCreateUserConfig` without clobbering Amplify's invite template. |
| `amplify/auth/resource.test.ts` | created | 6 Jest tests on `authConfig` (Admin group; secret refs are objects, not string literals; scopes; callback/logout URLs; attribute mapping; email-only login, no phone). |
| `amplify/backend.test.ts` | created | 2 Jest tests on `token-policy.ts` (60/60/30 with units; `selfSignUpDisabled === true`). |

Record directory: `source-manifest.json` (18 entries, above) and this file; `traceability.json` alongside.

## Resolved dependency versions

`@aws-amplify/backend@1.25.0`, `@aws-amplify/backend-cli@1.10.0`, `aws-cdk-lib@2.269.0`, `constructs@10.8.1`, `esbuild@0.28.2`, `typescript@5.9.3`, `jest@29.7.0`, `ts-jest@29.4.12`, `@types/jest@29.5.14`, `@types/node@22.20.3`, `eslint@9.39.5`, `typescript-eslint@8.70.0`, `prettier@3.9.7`, `eslint-config-prettier@10.1.8`, plus `ts-node@10.9.2` (see deviations). Toolchain: Node v22.23.2, npm 10.9.8.

## Key implementation decisions

- **Testable config shape**: `authConfig` is exported separately from `defineAuth(authConfig)` and declared with `satisfies` rather than a type annotation, so it is type-checked against `defineAuth`'s parameter type while keeping its literal inferred type — tests read nested fields without non-null assertions. The plan's shape worked under Jest ESM with no mocking; the `config.ts` fallback was not needed.
- **Token lifetimes made explicit** (BR1.3, NFR3.1): 1h/1h/30d are set on the L1 App Client rather than relied on as defaults, so a future Amplify default change cannot silently widen the admin-revocation exposure window.
- **No self-registration** (BR1.1, BR1.4): `allowAdminCreateUserOnly: true` closes the email/password sign-up path that `loginWith.email: true` would otherwise open; Google-federated users are still created by the federation flow. Merged into the existing `adminCreateUserConfig` rather than replacing it.
- **Fail-fast on a client secret** (NFR3.1/3.4): `backend.ts` throws at synthesis if `generateSecret` is ever `true`, so the PUBLIC-client + PKCE posture cannot regress unnoticed.
- **flutter-app-unit's obligation closed**: the app-facing custom-scheme callback/sign-out URLs are registered on the App Client here, as flutter-app-unit's Infrastructure Design required.
- **Synthesis sanity check** (not part of the plan, temporary, removed): a throwaway local CDK synth confirmed the overrides land on the L1 resources — 60/60/30 token validity, `generateSecret: false`, `allowAdminCreateUserOnly: true`, `allowedOAuthFlows: ['code']`, the two custom-scheme URLs, `supportedIdentityProviders: [Google, 'COGNITO']`. No AWS calls, no output retained.

## Test coverage summary

- `npm run test:auth` → **2 suites, 8 tests, 8 passed** (re-run and confirmed by the conductor after hand-back).
- `npm run lint` → clean. `npm run typecheck` → clean. `prettier --check` → clean.
- Unit-scoped coverage (informational, no threshold on this skeleton Bolt): `resource.ts` 100% / `token-policy.ts` 100% statements, branches, functions, lines.
- No integration tests at the backend level (per the unit-test instructions): the end-to-end Google sign-in and admin gate are flutter-app-unit `integration_test` flows.

## Deviations from the plan

| Deviation | Why | Effect |
|---|---|---|
| Added devDependency `ts-node@10.9.2` (not in the plan's list) | Jest 29 needs ts-node to read a `jest.config.ts`; without it plan Step 2.1's config file cannot load | Config-load only (CJS); no effect on the ESM test run |
| Google OAuth secrets live in Amplify's secret store (SSM Parameter Store SecureString via `secret()`), not AWS Secrets Manager as `infrastructure-specification.md` names | Amplify Gen2's native mechanism; declared up front in the plan | Intent met (never committed, encrypted at rest, referenced by name). auth-unit's infra spec should carry an amendment note — recorded in the stage diary |
| Extra `format:check` script and `.prettierignore` | So `npm run format` can never touch `aidlc/` or `.claude/` | Tooling hygiene only |
| Unit-scoped test command is the unit-test-instructions form (`npx jest --rootDir . amplify/auth amplify/backend.test.ts`), a superset of plan Step 2.2's shorter form | The instructions file is the authoritative command | None |

## Open items for the builder (not defects)

- `npm audit`: 20 advisories (3 moderate, 17 high), all transitive under the Amplify CLI/codegen dev toolchain, none in runtime code. The only npm "fix" is a major downgrade of `@aws-amplify/backend*`, deliberately not taken. Triage under team.md Q8's "dependency alerts clear or explicitly triaged" once the GitHub repo exists.
- The hosted UI's `SupportedIdentityProviders` includes `COGNITO` alongside Google (Amplify's default for an email-login pool). With self-registration disabled no native account can exist, so it is inert; a one-line `supportedIdentityProviders` override in `backend.ts` would hide it from the hosted UI. Left out because it changes a sign-in surface (self-review rule) and the plan did not call for it.
- Before the first `ampx sandbox`: set the two Google secrets, register the sandbox Cognito domain's `/oauth2/idpresponse` on the Google OAuth client (README).
- Run `pre-commit install` at the workspace root; enable GitHub secret scanning / push protection / Dependabot when the repository is created.
- Self-review `amplify/auth/**` and `amplify/backend.ts` before the Bolt merges (project.md Mandated).

## Re-verification (2026-09-28)

The Sep 20 rejection of reminder-unit's gate reset the whole code-generation stage attempt, invalidating this Unit's Plan Approval receipt even though its code was already correct and unchanged. Re-ran Plan Approval under the current attempt (fresh fingerprint, human re-confirmed) and verified the existing implementation directly rather than re-dispatching generation on unchanged code:

- `npm run test:auth`: 8/8 passing (2 suites: `amplify/auth/resource.test.ts`, `amplify/backend.test.ts`).
- `npm run typecheck`: clean.
- `npm run lint`: found and fixed a real config gap — `eslint.config.js` had no `build/`/`android/`/`ios/` in `globalIgnores`, so once flutter-app-unit's `flutter test`/`analyze` populated `build/` with vendored third-party JS (CocoaPods/SPM package internals), this backend's ESLint swept it in (2026 errors, none of them this project's code). Added the three ignores; `npm run lint` is now clean (0 errors).
- Repository content is unchanged: no `amplify/auth/**` or `amplify/backend.ts` file was touched.
