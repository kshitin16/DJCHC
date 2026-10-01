# CI Pipeline — Questions

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: all seven units' `code-summary.md`, `construction/build-and-test/build-and-test-summary.md`, `construction/build-and-test/test-results.md`, plus the existing `.github/workflows/ci.yml`.

Most of this stage's usual questions are already answered by affirmed practice and
are not re-asked:

- **CI tool** — GitHub Actions (team.md Q7, affirmed).
- **Branch strategy** — trunk-based, short-lived branches, squash-merge to `main` (team.md Q2, affirmed).
- **Quality gates** — lint, format, type-check, tests with the 80% coverage floor, blocking merge (team.md Q6/Q7, affirmed).
- **Artifact repository** — none required. Amplify Gen2 packages Lambdas at deploy time via esbuild, and the Flutter app's artefacts are produced by the release build, not by CI. No ECR, CodeArtifact or S3 artefact store is needed at this stage.

What remains are three decisions about the workflow that already exists but has
never executed.

## Q1. The app job will fail on its first run. How should it be fixed?

`lib/amplify_outputs.dart` is gitignored (it holds real backend config), but
`lib/main.dart` imports it. On a fresh CI checkout the file does not exist, so
`flutter analyze` and `flutter test` both fail at module load. The workflow has
never run, so this has never surfaced.

- A. Add a step that runs `tool/stub_amplify_outputs.sh` before analyze and test — the script already exists and writes a `'{}'` stub, which is enough for analyze and widget tests
- B. Commit a checked-in stub `amplify_outputs.dart` and un-ignore it, letting a real sandbox overwrite it locally
- C. Generate real config in CI with `npx ampx sandbox --outputs-format dart` — needs AWS credentials in GitHub secrets
- X. Other (please specify)

[Answer]: A

## Q2. Should the Flutter version be pinned?

The app job uses `subosito/flutter-action@v2` with `channel: stable`, which
resolves to whatever is newest at run time. `pubspec.yaml` declares
`sdk: ^3.13.3`. A future stable release could change analyzer behaviour or lint
output and turn CI red for reasons unrelated to any change you made.

- A. Pin an explicit `flutter-version` matching the local toolchain (3.47.4) — reproducible, needs a deliberate bump to upgrade
- B. Keep `channel: stable` — always current, accepts the risk of an unrelated break
- X. Other (please specify)

[Answer]: A

## Q3. Should the format gate cover `README.md`?

`npm run format:check` includes `README.md`, but the CI step is deliberately
narrowed to `amplify jest.config.ts eslint.config.js`. The README has
hand-aligned tables that Prettier would reflow. So the local script and the CI
gate disagree, which is its own trap.

- A. Leave CI scoped to code and narrow the local `format:check` to match, so both agree
- B. Reformat `README.md` once and widen the CI gate to the full `npm run format:check`
- C. Leave both as they are and accept the divergence
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
