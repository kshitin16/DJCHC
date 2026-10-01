# CI Pipeline Configuration

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: all seven units' `code-summary.md`; `construction/build-and-test/build-and-test-summary.md`; `construction/build-and-test/test-results.md`.
- [Q1] Add a stub-config step so the app job compiles on a fresh checkout.
- [Q2] Pin Flutter to 3.47.4 rather than tracking `channel: stable`.
- [Q3] Narrow the local `format:check` to match the CI gate's paths.

## What this stage changed

The workflow already existed. `donation-unit`'s Code Generation revision added
`.github/workflows/ci.yml` to close an enforcement gap — `jest.config.ts`
declared the 80% coverage floor but nothing ran `--coverage`, so nothing enforced
it. That file was explicitly not an attempt to own this stage.

This stage reviewed it against the repository and found **one defect that would
have failed its first run**, plus two divergences. All three are now fixed.

### Fix 1 — the app job could not have passed (Q1)

`lib/amplify_outputs.dart` is gitignored, because it holds real backend config.
But `lib/main.dart` imports it. On a fresh CI checkout the file does not exist,
so `dart format`, `flutter analyze` and `flutter test` all fail at module load.

The workflow had never executed, so this was invisible. It is exactly the class of
defect that only a real run — or reading the workflow against the `.gitignore` —
can find.

Added before the format step:

```yaml
      - name: Stub Amplify config
        run: tool/stub_amplify_outputs.sh
```

The script already existed, is executable, writes a `'{}'` placeholder, and never
overwrites an existing file — so it is safe locally as well as in CI.

### Fix 2 — Flutter version pinned (Q2)

`channel: stable` resolved to whatever was newest at run time, against a
`pubspec.yaml` declaring `sdk: ^3.13.3`. A future stable release could change
analyzer or lint behaviour and turn CI red for reasons unrelated to the change
under test. Now `flutter-version: 3.47.4`, matching the local toolchain, so CI and
the developer machine agree and an upgrade is a deliberate commit.

### Fix 3 — format gate and local script reconciled (Q3)

The CI step checked `amplify jest.config.ts eslint.config.js` while
`npm run format:check` also covered `README.md`, which Prettier would reflow. The
two disagreed: the local script was red while CI was green.

`package.json`'s `format` and `format:check` scripts are now narrowed to the same
three paths, and the CI step calls `npm run format:check` rather than repeating the
path list. One definition, two callers. `README.md`'s hand-aligned tables survive;
reformatting documentation to satisfy a gate remains a separate decision if ever
wanted.

Verified after the change: `npm run format:check` → "All matched files use
Prettier code style!"

## Pipeline shape

One workflow, `.github/workflows/ci.yml`, two independent jobs.

**Triggers:** push to `main`, pull request targeting `main`. This matches the
affirmed trunk-based strategy — short-lived branches, squash-merge to `main` — so
every branch gets gated before it lands and `main` is gated after.

**Concurrency:** `ci-${{ github.ref }}` with `cancel-in-progress: true`, so a newer
push supersedes an in-flight run rather than queueing behind it.

**Permissions:** `contents: read` only. The workflow neither writes to the repo nor
needs a token beyond checkout.

### Job: Backend (Amplify Gen2 / TypeScript)

| Step | Command | Gate |
|---|---|---|
| Checkout | `actions/checkout@v4` | — |
| Node | `actions/setup-node@v4`, Node 20, `cache: npm` | — |
| Install | `npm ci` | fails on a lockfile mismatch |
| Lint | `npm run lint` | zero ESLint findings |
| Format | `npm run format:check` | Prettier clean on code |
| Type check | `npm run typecheck` | `tsc --noEmit` clean |
| Test | `NODE_OPTIONS=--experimental-vm-modules npx jest --coverage` | all tests pass **and** the 80% line floor holds |

`--coverage` is what arms `coverageThreshold.global.lines: 80`. Without the flag
Jest does not evaluate the threshold, so the floor exists on paper only. The flag
must never be dropped and the number must never be lowered to make the step pass —
`org.md` is explicit that a defined coverage floor may not be weakened.

`NODE_OPTIONS=--experimental-vm-modules` is required: the backend is ESM and Jest
cannot parse the Amplify imports without it.

### Job: App (Flutter)

| Step | Command | Gate |
|---|---|---|
| Checkout | `actions/checkout@v4` | — |
| Flutter | `subosito/flutter-action@v2`, `flutter-version: 3.47.4`, `cache: true` | — |
| Install | `flutter pub get` | resolves |
| Stub config | `tool/stub_amplify_outputs.sh` | the compile precondition |
| Format | `dart format --output=none --set-exit-if-changed lib test integration_test` | formatted |
| Analyze | `flutter analyze` | zero issues |
| Test | `flutter test --coverage` | all tests pass |

The two jobs run in parallel; neither depends on the other. Expected wall time is
a few minutes, well inside the "fast feedback" target.

## What CI deliberately does not do

- **No `integration_test/` run.** It needs a device or emulator. Those checks are
  specified in `build-and-test/integration-test-instructions.md` and belong to a
  real environment.
- **No `flutter build`.** Producing an APK or IPA needs the Android SDK or Xcode;
  artefact builds belong to Deployment Pipeline (4.1) and Deployment Execution (4.3).
- **No `ampx sandbox` / `cdk synth`.** That needs AWS credentials. Backend
  synthesis assertions are listed in `integration-test-instructions.md` IT-8 and
  land at Environment Provisioning (4.2).
- **No artefact publication.** Amplify Gen2 packages Lambdas at deploy time via
  esbuild, so there is nothing for CI to push to ECR, CodeArtifact or S3. Adding an
  artefact store now would be ceremony without a consumer.
- **No deploy.** Deployment is Operation's work. This is CI, not CD.

## Still unproven

**This workflow has never executed in GitHub.** Every command in it has been run
locally and passes, the YAML is structurally sound, and the first-run defect is
fixed — but "it will work" remains a prediction until a push proves it. The
`subosito/flutter-action@v2` step in particular has never run in GitHub's
environment.

Its first real run is itself a meaningful check, and it is the cheapest one
outstanding: push the branch.

## A note on Amplify Hosting

If Amplify Hosting's own build pipeline is later used for deploys, a test step has
to be added to `amplify.yml` deliberately — Amplify Hosting does not run
app-level tests by default. Recorded at practices discovery (team.md Q7) and still
true; no `amplify.yml` exists yet.
