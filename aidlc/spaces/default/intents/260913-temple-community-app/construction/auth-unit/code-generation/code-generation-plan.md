# Code Generation Plan — auth-unit

## Scope

auth-unit (U1, `kind: service`) is pure Cognito configuration inside the single shared Amplify Gen2 backend: a User Pool with Google federation, a PUBLIC (no-secret) App Client using Authorization Code + PKCE, an `Admin` Cognito Group whose membership surfaces as the `cognito:groups` claim (Contract 2), and 1-hour access/ID + 30-day refresh token lifetimes. It owns no data entity (`entities.md`), no Lambda, no resolver (`infrastructure-specification.md`). Its behaviour is fully described by BR1.1–BR1.4 (`rules.md`) and the two workflows in `functional-spec.md`.

Because the workspace is greenfield (no code exists yet), this Unit is also the one that **bootstraps the Amplify Gen2 backend project** at the workspace root: `package.json`, TypeScript, `amplify/backend.ts`, ESLint + Prettier, Jest, and the repository hygiene the team affirmed (git on `main`, `.gitignore`, pre-commit secret scanning). Every later backend Unit adds its own `amplify/<area>/resource.ts` to this scaffold.

Out of scope for this Unit: the Flutter client and `services/auth_service.dart` (flutter-app-unit, U6), the GitHub Actions workflow (CI Pipeline stage 3.7), and any Amplify Hosting configuration (Operation phase).

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

The contract's `plan_profile.steps` is the ordering baseline. Layers that genuinely do not exist for this Unit are listed as omitted with the reason, not silently dropped. Every step is test-after: implement, then write and run that layer's tests. The walking-skeleton smoke-level bar applies (this is Bolt 1), so tests assert the configuration shape, not deployed Cognito behaviour.

### Step 1 — Project structure and production configuration skeleton

- [x] 1.1 Verify prerequisites and surface any gap instead of working around it: Node.js ≥ 18 and npm on PATH (`node --version`, `npm --version`); AWS credentials are NOT required for this Unit's steps (no deploy, no sandbox run).
- [x] 1.2 Initialize a git repository at the workspace root on branch `main` if none exists (`git init -b main`) — team.md Way of Working (trunk on `main`, GitHub host). Do not commit; committing is the builder's call.
- [x] 1.3 Create the root `.gitignore` entries the backend needs, merging into the existing file (never overwrite it): `node_modules/`, `.amplify/`, `amplify_outputs*`, `coverage/`, `dist/`, `*.tsbuildinfo`, `.env*`.
- [x] 1.4 Create root `package.json` (`"name": "sarovar-jinalaya-backend"`, `"private": true`, `"type": "module"`) with scripts `lint`, `format`, `typecheck` (`tsc --noEmit`), `test` (`jest`), `test:auth` (the unit-scoped command from Step 2), `sandbox` (`ampx sandbox`), and devDependencies: `@aws-amplify/backend`, `@aws-amplify/backend-cli`, `aws-cdk-lib`, `constructs`, `esbuild`, `typescript`, `jest`, `ts-jest`, `@types/jest`, `@types/node`, `eslint`, `typescript-eslint`, `prettier`, `eslint-config-prettier`. Pin to the current majors at generation time; record the resolved versions in `code-summary.md`.
- [x] 1.5 Create `tsconfig.json` (Amplify Gen2's recommended settings: `"module": "es2022"`, `"moduleResolution": "bundler"`, `"target": "es2022"`, `"strict": true`, `"skipLibCheck": true`, `"paths": {"$amplify/*": ["./.amplify/generated/*"]}`) and `amplify/package.json` (`{"type": "module"}`), as the Amplify Gen2 layout the team adopted (team.md Code Style).
- [x] 1.6 Create `amplify/backend.ts` with `defineBackend({ auth })` importing `./auth/resource` — the composition root every later Unit extends.
- [x] 1.7 Create `eslint.config.js` (flat config: `typescript-eslint` recommended + `eslint-config-prettier`) and `.prettierrc` — the affirmed backend formatter/linter pair (team.md Q9/Code Style).
- [x] 1.8 Create `.pre-commit-config.yaml` declaring the `gitleaks` pre-commit hook (project.md Mandated, team.md Q13) plus a README note on installing it (`pre-commit install`). The hook is declared here; installing it on the builder's machine is a manual step recorded in Step 6.
- [x] 1.9 `npm install` so the project compiles and the test runner can execute.

### Step 2 — Bootstrap the test runner and record the exact unit-scoped command

- [x] 2.1 Create `jest.config.ts` using `ts-jest` in ESM mode (`preset: 'ts-jest/presets/default-esm'`, `extensionsToTreatAsEsm: ['.ts']`, `moduleNameMapper` for `^(\.{1,2}/.*)\.js$`), `testEnvironment: 'node'`, `collectCoverageFrom: ['amplify/**/*.ts', '!amplify/backend.ts']`, and `coverageThreshold` left UNSET for this walking-skeleton Bolt (the 80% floor applies from Bolt 2; it is added then, never lowered later).
- [x] 2.2 Record and verify the unit-scoped command before any test is written: `npx jest --rootDir . amplify/auth` (runs only files under `amplify/auth/`). Verify it exits 0 with "no tests found" tolerated via `--passWithNoTests` at this bootstrap moment only; the `test:auth` script omits `--passWithNoTests` so a missing test file fails from Step 4 onward.

### Step 3 — Data model / database behavior: implement the Cognito User Pool definition

For this Unit the "data model" layer IS the Cognito User Pool and App Client configuration (`infrastructure-specification.md`, `security-design.md`).

- [x] 3.1 Create `amplify/auth/resource.ts` exporting a plain, testable `authConfig` object and `export const auth = defineAuth(authConfig)`. `authConfig`:
  - `loginWith.email: true` — required by `defineAuth` as the pool's sign-in attribute; the app never exposes email/password sign-in (BR1.1: Google only), and Step 3.3 disables self-sign-up so no password path exists.
  - `loginWith.externalProviders.google` with `clientId: secret('GOOGLE_CLIENT_ID')`, `clientSecret: secret('GOOGLE_CLIENT_SECRET')`, `scopes: ['openid', 'email', 'profile']`, `attributeMapping: { email: 'email' }` — BR1.1's `sub`/`email` claims (Contract 1). Secrets are references, never literals (project.md Mandated; `security-design.md`).
  - `loginWith.externalProviders.callbackUrls: ['sarovarjinalaya://callback/']` and `logoutUrls: ['sarovarjinalaya://signout/']` — this closes the open obligation flutter-app-unit's Infrastructure Design placed on this Unit (the app-facing custom-URL-scheme redirect), in addition to whatever sandbox/hosted-UI defaults Amplify adds.
  - `groups: ['Admin']` — BR1.2 / Contract 2's `cognito:groups` claim source.
  - `userAttributes.email.required: true`.
- [x] 3.2 In `amplify/backend.ts`, after `defineBackend`, set the App Client's token validity explicitly on `backend.auth.resources.cfnResources.cfnUserPoolClient`: `accessTokenValidity: 60`, `idTokenValidity: 60`, `refreshTokenValidity: 30`, `tokenValidityUnits: { accessToken: 'minutes', idToken: 'minutes', refreshToken: 'days' }` — the 1h/30d lifetimes BR1.3 and `security-design.md` depend on, made explicit rather than relying on defaults. Confirm `generateSecret` stays false (PUBLIC client, PKCE — `security-design.md` NFR3.1).
- [x] 3.3 In `amplify/backend.ts`, set `backend.auth.resources.cfnResources.cfnUserPool.adminCreateUserConfig = { allowAdminCreateUserOnly: true }` so no one can self-register with email/password; Google-federated users are still created automatically by the federation flow. Document this in the file's header comment.
- [x] 3.4 `npx tsc --noEmit` passes.

### Step 4 — Data model / database behavior: write and run its tests

- [x] 4.1 Create `amplify/auth/resource.test.ts` (Jest, smoke-level per the walking-skeleton bar, 6 tests — inside the Standard strategy's 5–8 per component):
  1. `authConfig.groups` contains exactly `'Admin'` (BR1.2, Contract 2).
  2. Google provider is configured with `clientId`/`clientSecret` that are secret references, not string literals (BR1.1; no hardcoded secret).
  3. Google scopes include `email` (Contract 1's `email` claim) and `openid`.
  4. `callbackUrls` includes `sarovarjinalaya://callback/` and `logoutUrls` includes `sarovarjinalaya://signout/` (flutter-app-unit's obligation).
  5. `attributeMapping.email` maps to `email` (Contract 1).
  6. `loginWith.email` is `true` and no `phone` login is enabled (single sign-in attribute, matching `security-design.md`).
- [x] 4.2 Create `amplify/backend.test.ts` (2 tests, smoke-level): the token-validity constants module used by Step 3.2 exports 60/60/30 with the expected units, and `allowAdminCreateUserOnly` is `true`. To keep this testable without synthesizing CDK, factor the values into `amplify/auth/token-policy.ts` (`export const tokenPolicy = {...}`, `export const selfSignUpDisabled = true`) that `backend.ts` imports.
- [x] 4.3 Run `npm run test:auth`; all 8 tests pass. Run `npm run lint` and `npm run typecheck`; both pass.

### Omitted layers (genuinely inapplicable — documented, not skipped silently)

- **Repository / data access**: no entity is owned (`entities.md`: `entities: []`).
- **Business logic**: BR1.1–BR1.4 are realized entirely by Cognito's own behaviour; the only code-level expression is the configuration in Step 3.
- **API / endpoint**: Cognito's hosted UI and token endpoints are AWS-managed; this Unit exposes no GraphQL or REST operation (`infrastructure-specification.md`).
- **Frontend behavior**: `services/auth_service.dart` and the Sign In screen belong to flutter-app-unit (U6, `unit-of-work.md`).

### Step 5 — Environment/build configuration

- [x] 5.1 `README.md` at the workspace root, "Backend" section: prerequisites; `npx ampx sandbox` for local development; setting the two Google secrets for the sandbox (`npx ampx sandbox secret set GOOGLE_CLIENT_ID`, `... GOOGLE_CLIENT_SECRET`) and, for branch environments, via the Amplify console — never in source; the per-environment Google Cloud Console redirect-URI registration step exactly as `infrastructure-specification.md` lists it (sandbox / `main` / `production` hosted-UI domains → `/oauth2/idpresponse`); and how the `Admin` group is administered out-of-band (`aws cognito-idp admin-add-user-to-group --user-pool-id <id> --username <sub> --group-name Admin`, FR1.2's "editable list, not a hardcoded value").
- [x] 5.2 README "Repository hygiene" section: `pre-commit install` for the gitleaks hook; GitHub secret scanning / push protection / Dependabot are enabled on the GitHub repository settings (a one-time manual step — team.md Q13).

### Step 6 — Documentation and traceability

- [x] 6.1 Inline doc comments in `resource.ts`, `token-policy.ts`, and `backend.ts` naming the rule each setting realizes (BR1.1–BR1.4, NFR3.1–NFR3.5).
- [x] 6.2 Write `source-manifest.json` listing every path created in the workspace (including `package-lock.json` and the `node_modules/` tree as a directory claim).
- [x] 6.3 The conductor writes `code-summary.md` and `traceability.json` in this record directory after generation.

## Story-to-step traceability

User Stories was a skipped stage for this workflow, so traceability runs to requirements and rules directly.

| Requirement / rule | Realized by |
|---|---|
| FR1.1 — Google sign-in via Cognito federation | Step 3.1 (`externalProviders.google`, callback/logout URLs) |
| FR1.2 — admin access via a Cognito admin group, editable without code change | Step 3.1 (`groups: ['Admin']`), Step 5.1 (out-of-band group administration) |
| FR1.3 — public read vs. signed-in write | Not this Unit's code — each consuming Unit's own authorization rules; this Unit supplies the claims (Contract 1/2) |
| BR1.1 — identity from Google federation | Step 3.1 |
| BR1.2 — admin = `cognito:groups` contains `Admin` | Step 3.1, test 4.1.1 |
| BR1.3 — revocation at next token refresh (≤1h) | Step 3.2 (explicit 1h access/ID token validity), test 4.2 |
| BR1.4 — no first-sign-in special case | Steps 3.1–3.3 (no custom trigger, no self-sign-up branch) |
| NFR3.1 — public client, PKCE, token lifetimes | Steps 3.1–3.2 |
| NFR3.2 — group claim, no custom trigger | Step 3.1 |
| NFR3.3 — encryption (Cognito-managed, TLS) | Inherited from Cognito; no code |
| NFR3.4 — STRIDE realization | Steps 3.1–3.3 (server-issued claims, PKCE, no secret in binary) |
| NFR3.5 — access-boundary / change-review process | Step 6.1 doc comments; process control, no code |
| NFR4 — personal data encrypted | Inherited from Cognito; no code |
| NFR6 — self-review of sign-in changes | Process; noted in README (Step 5.2) |
| NFR8 — test-after, smoke-level for the skeleton | Steps 2, 4 |

## Known deviations declared up front

- **Secret store**: `infrastructure-specification.md` names AWS Secrets Manager for the Google OAuth credentials. Amplify Gen2's native `secret()` mechanism stores them as SSM Parameter Store SecureString parameters (set via `ampx sandbox secret set` / the Amplify console). The intent — never committed, encrypted at rest, referenced by name — is met; the store differs. Recorded in `code-summary.md` and the stage diary so the infra spec can be amended with a note rather than silently drifting.
- **`loginWith.email: true`**: `defineAuth` requires an email or phone sign-in attribute even for a federation-only pool; Step 3.3 removes the self-sign-up path so no email/password account can be created outside Google federation.
