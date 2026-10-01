# Build Instructions

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Test Strategy: Standard.
- Consumed: all seven units' `code-generation-plan.md`, `unit-test-instructions.md` and `code-summary.md` under `construction/*/code-generation/`.

This project is two builds in one repository: an Amplify Gen2 / TypeScript backend
(`amplify/`) and a Flutter app (`lib/`) sharing the workspace root.

## Prerequisites

| Requirement | Status on the build machine | Needed for |
|---|---|---|
| Node.js >= 18, npm | Present (Node v22.23.2, npm 10.9.8) | Backend build, tests, lint |
| Flutter SDK (stable) | Present (3.47.4) | `flutter analyze`, `flutter test` |
| Android SDK + platform tools | **Absent** | `flutter build apk`, device runs, `integration_test/` |
| Xcode + CocoaPods | **Absent** | `flutter build ios`, device runs, `integration_test/` |
| AWS credentials on the default chain | Not required for build/test | `ampx sandbox`, deploy-time checks |

The two absent toolchains are a documented, accepted limitation of this pass:
`flutter build` and the `integration_test/` suite cannot run here. Everything
below that does not depend on them runs clean.

## Dependency installation

```bash
npm ci                 # backend; use `npm install` on a fresh clone without a lockfile
flutter pub get        # app
```

## Environment setup

`lib/amplify_outputs.dart` is gitignored but imported by `lib/main.dart`, so a
fresh clone does not compile until that file exists. Create it one of two ways:

```bash
tool/stub_amplify_outputs.sh          # writes a '{}' stub; enough for analyze + unit tests
npx ampx sandbox --outputs-format dart --outputs-out-dir lib   # real config; needs AWS credentials
```

CI must run the stub step (or a real sandbox) **before** `flutter analyze` and
`flutter test`, or both fail at module load. `.github/workflows/ci.yml` is the
enforcement point.

Backend secrets are referenced by name, never committed. For a sandbox:

```bash
npx ampx sandbox secret set GOOGLE_CLIENT_ID
npx ampx sandbox secret set GOOGLE_CLIENT_SECRET
npx ampx sandbox secret set FCM_SERVICE_ACCOUNT_JSON
```

## Build and verification commands

| Step | Command | Expected |
|---|---|---|
| Backend type check | `npm run typecheck` | exit 0, no output |
| Backend lint | `npm run lint` | exit 0, no findings |
| Backend format | `npm run format:check` | "All matched files use Prettier code style!" |
| App analyze | `flutter analyze` | "No issues found!" |
| App format | `dart format --set-exit-if-changed lib test integration_test` | exit 0 |
| Backend synth (needs AWS creds) | `npx ampx sandbox --once` | stack synthesises |
| App build (needs Android SDK / Xcode) | `flutter build apk --debug` / `flutter build ios --no-codesign` | artefact produced |

There is no separate bundle/transpile step for the backend: Amplify Gen2 compiles
functions at deploy time via esbuild, so `tsc --noEmit` plus the deploy is the
build.

## Troubleshooting

- **`Cannot find module './amplify_outputs.dart'`** — run the stub script above.
- **Jest fails parsing Amplify ESM** — every Jest command needs
  `NODE_OPTIONS=--experimental-vm-modules`. The `npm run test:*` scripts set it;
  a bare `npx jest` does not.
- **`No context value present for amplify-backend-namespace key`** — something
  imported `amplify/backend.ts` outside the `ampx` CLI. Backend composition
  cannot be synthesised from a plain Node or Jest process; test the extracted
  pure functions instead.
- **A worker process has failed to exit gracefully** — benign warning from the
  Jest run; no test leaks state that affects results.
