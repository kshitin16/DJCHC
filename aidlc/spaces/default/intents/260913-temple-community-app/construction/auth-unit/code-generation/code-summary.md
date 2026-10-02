# Code Summary — auth-unit

## Files created / modified

All paths are workspace-relative (`/Users/kshitin/DJCHCApp`). This Unit also bootstrapped the whole Amplify Gen2 backend project, so most entries are project scaffold that every later backend Unit builds on.

| Path | Kind | Purpose |
|---|---|---|
| `.git/` | created (dir) | Repository initialized on branch `main` via `git init -b main`; **no commits made** — committing is the builder's call after `pre-commit install`. |
| `.gitignore` | modified (merged) | Appended a delimited `# BEGIN/END sarovar-jinalaya-backend:gitignore` block: `node_modules/`, `.amplify/`, `amplify_outputs*`, `coverage/`, `dist/`, `*.tsbuildinfo`, `.env*`. The existing AI-DLC block is untouched. |
| `package.json` | created, now **shared** | Created by this Unit: `sarovar-jinalaya-backend`, private, ESM. Scripts: `lint`, `format`, `format:check`, `typecheck`, `test`, `test:auth` (unit-scoped), `sandbox`. Later Units have since added their own `test:<unit>` scripts and runtime dependencies (AWS SDK clients, `@aws-appsync/utils`, etc.); auth-unit owns only the entries listed here. |
| `package-lock.json`, `node_modules/` | created | From `npm install` (1172 packages). |
| `tsconfig.json` | created | es2022 / bundler resolution / strict / skipLibCheck / `$amplify/*` path alias; includes `amplify/**/*.ts` and `jest.config.ts`. |
| `jest.config.ts` | created, now **shared** | Created by this Unit: ts-jest ESM preset, node environment, `.js`→`.ts` module mapper, `collectCoverageFrom: ['amplify/**/*.ts', '!amplify/backend.ts']`, and no `coverageThreshold` — correct for the walking-skeleton Bolt, since the 80% floor starts at Bolt 2. **Corrected in Revision 1**: later Units have extended this file, and it now carries `coverageThreshold.global.lines: 80` (added by donation-unit, the first Unit past the skeleton) plus their own `moduleNameMapper` and `collectCoverageFrom` entries. auth-unit neither adds a threshold nor removes theirs. |
| `eslint.config.js`, `.prettierrc`, `.prettierignore` | created | Flat ESLint config (`typescript-eslint` recommended + `eslint-config-prettier`); Prettier scoped away from `aidlc/` and `.claude/`. |
| `.pre-commit-config.yaml` | created | Declares the `gitleaks` hook at `rev: v8.30.1`. Installed on the machine with `pre-commit install` (manual step; `gitleaks` 8.30.1 and `pre-commit` 4.6.2 are now installed locally). |
| `README.md` | created | "Backend" section (layout, prerequisites, install/test/lint, `npx ampx sandbox`, the two `ampx sandbox secret set` commands, per-environment Google redirect-URI registration table per `infrastructure-specification.md`, `Admin` group administration via `aws cognito-idp admin-add-user-to-group` / `admin-remove-user-from-group`) and "Repository hygiene" (`pre-commit install`, GitHub secret scanning / push protection / Dependabot, the sign-in self-review rule). |
| `amplify/package.json` | created | `{ "type": "module" }` — Amplify Gen2 convention. |
| `amplify/auth/resource.ts` | created | `authConfig` (exported, `satisfies Parameters<typeof defineAuth>[0]`) and `auth = defineAuth(authConfig)`: email sign-in attribute, Google provider with `secret('GOOGLE_CLIENT_ID')` / `secret('GOOGLE_CLIENT_SECRET')`, scopes `openid email profile`, `attributeMapping.email`, `callbackUrls: ['sarovarjinalaya://callback/']`, `logoutUrls: ['sarovarjinalaya://signout/']`, `groups: ['Admin']`, `userAttributes.email.required`. Doc comments name BR1.1/BR1.2/BR1.4, NFR3.1/3.2/3.4/3.5, Contracts 1 and 2. |
| `amplify/auth/token-policy.ts` | created | `tokenPolicy` = 60 min access / 60 min ID / 30 days refresh (`as const`) and `selfSignUpDisabled = true`, with BR1.3 / NFR3.1 / NFR3.4 doc comments. |
| `amplify/backend.ts` | created, now **shared** | Created by this Unit as `defineBackend({ auth })` plus the Cognito policy application. Every later backend Unit has since registered its own resource in the `defineBackend` call and appended its own wiring block; auth-unit owns the `defineBackend` skeleton and the auth block only. **Changed in Revision 1**: the ten inline override assignments were replaced by one call to `applyTokenPolicy(cfnUserPoolClient, cfnUserPool)` from `./auth/token-policy` — same behaviour, now covered by a runnable test (see Revision 1, F-1). |
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
- **Synthesis sanity check** — *superseded by Revision 1 / F-1: this was exactly the unreproducible evidence the review rejected. The overrides are now covered by runnable tests over `applyTokenPolicy`.* (not part of the plan, temporary, removed): a throwaway local CDK synth confirmed the overrides land on the L1 resources — 60/60/30 token validity, `generateSecret: false`, `allowAdminCreateUserOnly: true`, `allowedOAuthFlows: ['code']`, the two custom-scheme URLs, `supportedIdentityProviders: [Google, 'COGNITO']`. No AWS calls, no output retained.

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
- *Revision 1 / F-5: still an open item — the decision below is unchanged — but it is no longer invisible to a reader of the code: `amplify/auth/resource.ts` now carries a doc comment on `loginWith.email` explaining it.* The hosted UI's `SupportedIdentityProviders` includes `COGNITO` alongside Google (Amplify's default for an email-login pool). With self-registration disabled no native account can exist, so it is inert; a one-line `supportedIdentityProviders` override in `backend.ts` would hide it from the hosted UI. Left out because it changes a sign-in surface (self-review rule) and the plan did not call for it.
- Before the first `ampx sandbox`: set the two Google secrets, register the sandbox Cognito domain's `/oauth2/idpresponse` on the Google OAuth client (README).
- Run `pre-commit install` at the workspace root; enable GitHub secret scanning / push protection / Dependabot when the repository is created.
- Self-review `amplify/auth/**` and `amplify/backend.ts` before the Bolt merges (project.md Mandated).

## Re-verification (2026-09-28)

The Sep 20 rejection of reminder-unit's gate reset the whole code-generation stage attempt, invalidating this Unit's Plan Approval receipt even though its code was already correct and unchanged. Re-ran Plan Approval under the current attempt (fresh fingerprint, human re-confirmed) and verified the existing implementation directly rather than re-dispatching generation on unchanged code:

- `npm run test:auth`: 8/8 passing (2 suites: `amplify/auth/resource.test.ts`, `amplify/backend.test.ts`).
- `npm run typecheck`: clean.
- `npm run lint`: found and fixed a real config gap — `eslint.config.js` had no `build/`/`android/`/`ios/` in `globalIgnores`, so once flutter-app-unit's `flutter test`/`analyze` populated `build/` with vendored third-party JS (CocoaPods/SPM package internals), this backend's ESLint swept it in (2026 errors, none of them this project's code). Added the three ignores; `npm run lint` is now clean (0 errors).
- Repository content is unchanged: no `amplify/auth/**` or `amplify/backend.ts` file was touched.

## Revision 1 (review findings) — 2026-09-29

The human reviewed the implementation and raised five findings. This section records what changed; the original content above is unedited except for three stale table rows, each marked in place.

### F-1 — Prove the token policy is *applied*, not just *declared*

The problem was real: `token-policy.ts` exported the 60/60/30 constants and `backend.test.ts` asserted them, but nothing asserted that `backend.ts` writes them onto the App Client. The only evidence was the throwaway synth noted under "Key implementation decisions" — run once, deleted, unreproducible. The `traceability.json` rows claiming BR1.3 / NFR3.1 coverage rested on that.

**Route taken: the pure-function extraction, not `Template.fromStack`.** The CDK-assertions route was tried first and is genuinely unavailable here. A probe test that does nothing but `await import('../backend.js')` fails at module load:

```
No context value present for amplify-backend-namespace key
  at getBackendIdentifier (node_modules/@aws-amplify/backend/src/backend_identifier.ts:9:39)
  at defineBackend (node_modules/@aws-amplify/backend/src/backend_factory.ts:202:19)
  at amplify/backend.ts:136:24
```

`defineBackend` reads CDK context keys that only the `ampx` CLI sets, so there is no `Stack` to hand `Template.fromStack` without reimplementing the `ampx` bootstrap inside Jest — and that reimplementation would itself be untested scaffolding standing between the test and the thing under test. (The probe file was deleted; it was a feasibility check, not evidence of coverage. The error above is the evidence, and it reproduces from any test that imports `backend.ts`.)

So the override application moved into `amplify/auth/token-policy.ts` as:

```
export function applyTokenPolicy(
  cfnUserPoolClient: TokenPolicyClientTarget,
  cfnUserPool: SelfSignUpPoolTarget,
): void
```

`backend.ts` now calls it once. The two parameter types are `Pick<CfnUserPoolClient, …>` / `Pick<CfnUserPool, …>` over the real `aws-cdk-lib/aws-cognito` types via a **type-only** import (erased at runtime, so the module stays synthesis-free): production code is still type-checked against CloudFormation's own property types, while a test can pass a plain object with those fields.

Five new tests in `amplify/backend.test.ts` drive the function and assert what it writes: the three validities plus `tokenValidityUnits`; `generateSecret: false`; that it throws when `generateSecret` is already `true`; that `allowAdminCreateUserOnly: true` merges into an existing `adminCreateUserConfig` without clobbering it; and that an unresolved CDK token is not spread into that merged config.

**What this does and does not prove.** It proves the policy-application logic is correct and reproducible on every run. It does not prove that `backend.ts` calls it — that link is still eyeballed. But it is now a single visible call site instead of ten scattered assignments, which is the strongest verification available without a deploy. Stated plainly rather than papered over.

### F-2 — Stale claims about shared files

`jest.config.ts`, `package.json` and `amplify/backend.ts` were described as if auth-unit still owned all of them. Corrected in the file table above; each is now marked `now **shared**` with one sentence on what later Units added. The specific error called out in review — "no `coverageThreshold`" — is fixed: donation-unit added `coverageThreshold.global.lines: 80`. auth-unit adds no threshold of its own (the affirmed smoke-level bar for this Bolt) and does not remove that one.

### F-3 — README's admin-grant command was wrong

It was. `aws cognito-idp admin-add-user-to-group --username <sub>` does not work for a Google-federated user. Verified against the [AdminAddUserToGroup API reference](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminAddUserToGroup.html), which states the value "must be the `sub` of a local user **or the username of a user from a third-party IdP**", and against [Linking federated users to an existing user profile](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation-consolidate-users.html), which gives the profile naming format as `[Provider name]_identifier` (its own example: `LoginWithAmazon_amzn1.account.AFAEXAMPLE`). The provider here is registered as `Google`, so the username is `Google_<google-subject-id>`. This pool contains no local users at all, so the `sub` form never applies.

The README section now uses `Google_<google-subject-id>` for both grant and revoke, tells the reader to take the top-level `Username` field from `list-users` rather than the `sub` attribute (with a `--query` that prints exactly that), and states the missing precondition: **the person must sign in through the app at least once** before a profile exists in the pool, otherwise the command fails with `UserNotFoundException`. Both forms are not shown — the correct one is now known, so showing an alternative would only invite the wrong pick.

### F-4 — Jest ESM prefix missing from the documented commands

`unit-test-instructions.md` gave a bare `npx jest …`, which fails: the backend is `"type": "module"` on the `ts-jest` ESM preset and needs `NODE_OPTIONS=--experimental-vm-modules`. The `npm run test:auth` script had it; the documented commands did not. Both the plain and the `--coverage` form now carry the prefix, with one sentence saying it is required rather than optional. Added to the deviations table below.

The approved plan carries the same bare command at Step 2.2, and the plan is under approval and was not edited.

### F-5 — The inert `COGNITO` provider

`supportedIdentityProviders` lists `COGNITO` next to `Google`. It was disclosed under "Open items" but a reader of the code could not tell. A doc comment now sits on `loginWith.email` in `amplify/auth/resource.ts` — the setting that causes Amplify to add it — explaining that the hosted UI therefore renders a username/password form, and why it is inert: `allowAdminCreateUserOnly: true` blocks self-registration, no native account is ever created administratively, so every profile in the pool comes from Google federation and has no password to authenticate with. It also records why it is left rather than overridden (narrowing `supportedIdentityProviders` changes a sign-in surface, which is what project.md's self-review mandate covers, and it was not in the approved plan), and that the app never opens the hosted UI login page. A shorter cross-reference sits at the call site in `backend.ts`.

### Revision 1 deviations

| Deviation | Why | Effect |
|---|---|---|
| The documented unit-test commands now carry `NODE_OPTIONS=--experimental-vm-modules`, which the approved plan's Step 2.2 command omits | The plan's bare form does not run; the prefix is required by the ESM test setup | `unit-test-instructions.md` and `npm run test:auth` agree. The plan itself was not edited — it is under approval |
| `amplify/auth/token-policy.ts` gained a type-only `aws-cdk-lib/aws-cognito` import, contradicting its original "no CDK import" note | Needed so `applyTokenPolicy`'s parameters are typed against the real CFN property types rather than `unknown` | None at runtime: `import type` is erased. The module is still synthesis-free |
| `amplify/backend.test.ts` grew from 2 tests to 7 | F-1 | Above the Standard strategy's 5–8 per component only if `token-policy.ts` is counted as one component with `resource.ts`; counted separately it is 6 and 7 |

### Revision 1 verification — COMPLETED

All three commands were run after the plan was re-approved, and all three pass:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS (no output) |
| `npm run lint` | PASS (`eslint .`, no findings) |
| `npm run test:auth` | PASS — 2 suites, **14 tests** |

**One production type change was required to get there.** Risk 1 below was
real, though not in the place predicted. `tsc` rejected the *test stubs*, not
the override assignment:

```
amplify/backend.test.ts(28,3): error TS2739: Type '{}' is missing the following
properties from type 'TokenPolicyClientTarget': accessTokenValidity,
idTokenValidity, refreshTokenValidity, tokenValidityUnits, generateSecret
```

CDK's L1 constructs declare these as `accessTokenValidity: number | undefined`
— required properties whose type includes `undefined` — rather than optional
ones, so `Pick<…>` produced a type a stub could not satisfy without
pre-populating the very fields `applyTokenPolicy` exists to write. Both target
types are now wrapped in `Partial<…>`. That is the correct shape on the merits,
not a concession to the test: these are properties this module ASSIGNS, so a
caller has no obligation to have set them first. The property VALUE types are
still CloudFormation's own, so a wrong-typed assignment is still a compile
error — the type safety the finding cared about is intact.

The `token-policy.ts` file header was also corrected (it still claimed "plain
constants, no CDK import", untrue once the function and the type-only import
landed), and now records why importing `backend.ts` in a test is impossible.

Risks 2 and 3 below did not materialise.

**Original note, superseded, kept for the record:**

~~`npx tsc --noEmit`, `npm run lint` and `npm run test:auth` were not run.~~ They could not be, at the time.

Editing `unit-test-instructions.md` for F-4 changed a file that is an input to the Plan Approval fingerprint, which invalidated the approval. The `plan-approval-guard` hook then blocked every mutation-capable shell command for this Unit, including the three verification commands and even `git status`, with:

> the Plan Approval fingerprint does not match the active intent, target, stage attempt, plan, test instructions, and Testing Contract; re-run the fingerprint command, re-present the plan, and approve again

This is the guard working as designed — F-4 required the edit, and the edit legitimately invalidates the approval. But it means the code changes above are **unverified**: they type-check and lint by inspection only. Before this revision is accepted, the fingerprint must be re-run and the plan re-approved, and then all three commands must pass. Known risks if they do not, in likelihood order:

1. `Pick<CfnUserPoolClient, 'tokenValidityUnits'>` is `IResolvable | TokenValidityUnitsProperty | undefined`; assigning `tokenPolicy.tokenValidityUnits` (a readonly `as const` object) should satisfy it, but this is the most likely place for a `tsc` complaint.
2. The `as unknown as NonNullable<…>` cast in the CDK-token test is deliberate; if `@typescript-eslint` flags an unnecessary assertion it needs adjusting.
3. `amplify/backend.ts` no longer uses `Duration`/`Stack`/other imports only if the removed block was their sole consumer — it was not (the donation/reminder blocks use them), but `no-unused-vars` would catch it if wrong.

None of these would change the design; they are mechanical. ~~The honest statement is that the three commands have not been run and the revision is not verified.~~ Superseded: all three were subsequently run and pass, as recorded above.
