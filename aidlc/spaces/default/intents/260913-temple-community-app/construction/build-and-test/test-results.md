# Build and Test Results

Run date: 2026-10-01. Machine: macOS, Node v22.23.2, npm 10.9.8, Flutter 3.47.4.

## Build status: **SUCCESS**

| Check | Command | Result |
|---|---|---|
| Backend type check | `npm run typecheck` | PASS — no output |
| Backend lint | `npm run lint` | PASS — no findings |
| Backend format | `npm run format:check` | PASS — "All matched files use Prettier code style!" |
| App analyze | `flutter analyze` | PASS — "No issues found!" (7.1s) |
| Backend synth | `npx ampx sandbox` | **NOT RUN** — needs AWS credentials |
| App build | `flutter build apk` / `ios` | ~~**NOT RUN** — Android SDK, Xcode and CocoaPods absent~~ **PASS, amended 2026-10-01 at Deployment Execution** — both platforms build |

The two not-run items are a declared limitation of this machine, recorded in
`build-instructions.md`. They are not failures, but they mean the build has never
been proven past type-check and analyze.

## Test results: **ALL PASS**

### Backend — Jest

Commands collected from all seven units' `unit-test-instructions.md` and
deduplicated. The per-unit commands are scoped filters over one suite, so the
whole suite was run once rather than seven overlapping times:

```
npm test -- --coverage
```

| Metric | Value |
|---|---|
| Test suites | 47 passed, 47 total |
| Tests | **284 passed, 284 total** |
| Failed / skipped | 0 / 0 |
| Lines | **94.97%** (1228/1293) |
| Statements | 93.58% (1283/1371) |
| Functions | 87.71% (307/350) |
| Branches | 82.62% (580/702) |

Per-unit scoped commands available and individually runnable: `test:auth`,
`test:donation`, `test:feed`, `test:pdf`, `test:suggestion`, `test:reminder`.

One benign warning: "A worker process has failed to exit gracefully." No test
leaks state that affects results; all 284 pass deterministically.

### App — Flutter

```
flutter test --coverage
```

| Metric | Value |
|---|---|
| Tests | **203 passed, 203 total** |
| Failed | 0 |
| Lines | **91.31%** (1860/2037) |

### Integration tests: **NOT RUN**

`integration_test/` requires a device or emulator, so it needs the Android SDK or
Xcode. Eight integration checks are specified in
`integration-test-instructions.md`, all needing a deployed sandbox.

### Performance tests: **NOT RUN**

Every target is a deployed-environment measurement. See
`performance-test-instructions.md`, and finding F-1 below.

### Security tests: partially verified in source

Eight checks confirmed by source inspection and the passing suite; six require a
deployed environment. See `security-test-instructions.md`.

## Coverage floors

| Floor | Source | Required | Actual | Verdict |
|---|---|---|---|---|
| Backend lines | team.md Q6, from the second Bolt onward | >= 80% | 94.97% | **Met** |
| App lines | same | >= 80% | 91.31% | **Met** |
| Walking-skeleton units | team.md Q5 — smoke-level bar, no threshold | n/a | — | **Met** (no threshold imposed, none required) |

The 80% floor is configured in `jest.config.ts` as `coverageThreshold.global.lines`
and is armed by the `--coverage` run that `.github/workflows/ci.yml` performs. No
threshold was lowered or disabled at any point.

## Stage verdict: **FAILED** by the stage's own predicate

Every command that ran, passed. The stage still fails, for one structural reason:

### F-1 — ~17 performance targets are Unverified with no owning stage

The failure predicate is: *any applicable target is `Not Met` or `Unverified`*.
A target may be deferred only when a later validation stage explicitly owns it.

**Performance Validation (4.6) is SKIP in this scope.** So the ~17 latency targets
across all seven units — sign-in round trip, feed reads, document reads, reminder
sync, app cold start, screen transitions and the rest — cannot be deferred to
anyone. They are `Unverified`, which by the predicate fails the stage.

This is not a test that broke. It is a plan gap: the scope committed to measurable
latency targets at NFR Requirements and then skipped the stage that would measure
them.

### F-2 — NFR7 (accessibility) uncovered

See `cross-unit-traceability.md` finding X-2. Zero accessibility affordances in
`lib/`, no accessibility test of any kind, no unit claiming the requirement.

### F-3 — the build has never run past type-check

No `flutter build`, no `ampx sandbox`, no deployed anything. The code compiles and
its tests pass; it has never been assembled into a runnable artefact.

### F-1 resolution — scope recomposed

The human chose to add **Performance Validation (4.6)** back to the scope rather
than accept the gap. Recorded result:

```
Recomposed: 0 skipped (none), 1 added (performance-validation)
Stages in scope: 26
Completed: 18/26
```

The ~17 latency targets now have an explicitly scheduled owning stage, so their
deferral is legitimate under the stage's own rule rather than an orphaned
`Unverified`. Their Owning Stage in the matrix is updated from "none scheduled"
to `performance-validation`, with expected evidence arriving at that stage.

Note what this does and does not change. It fixes the *ownership* gap: the
targets are now someone's job, with a recorded method in
`performance-test-instructions.md`. It does not make them measured — a deferred
target remains `Unverified` by the stage's definition and still cannot contribute
to a successful stage result. So the stage verdict stays FAILED; what changed is
that the failure is now an honest "not yet measured, owned by 4.6" rather than
"committed to and quietly dropped".

## Failure-escalation ladder — where this landed

1. **In-stage fix** — not applicable. Nothing here is a test-config or build-script
   fault within this stage's remit. The suites are green.
2. **Classify and estimate impact** — the root cause of F-1 is neither generated
   code nor a code-generation approach choice. It is the *scope*: a skipped stage.
   There is an identifiable fix in a swappable dimension, and it is cheap — see
   the options below.
3. **Autonomous loop-back** — not applicable. `Construction Autonomy Mode: gated`.
4. **Halt and ask** — this is where the stage stops. The options, with estimated
   impact, are presented to the human.

### Options with estimated impact

| Option | Effort | Cost | Risk |
|---|---|---|---|
| **Add Performance Validation (4.6) back to the scope** — gives F-1's targets a real owner; they become legitimately `Deferred` rather than `Unverified` | Low — one `recompose` call, no code | None | Low. Adds one stage to the plan |
| **Measure during Deployment Execution (4.3)** instead — record actuals against the first real environment and close the matrix there | Low to set up; measurement needs a device and a sandbox | AWS sandbox cost only | Medium — 4.3 does not own quality gates, so the targets could slip again |
| **Accept the failure** — log it and proceed to CI Pipeline with the targets recorded `Unverified` | None | None | Medium-High. The project's own rule says quality targets may not be weakened to make a step pass; accepting is the human's call to make, not the agent's |
| **Abort** — stop Construction here | None | None | Low. Everything is on disk and resumable |

F-2 (accessibility) is independent of which option is chosen and needs its own
decision: implement toward WCAG AA, or record a deliberate deferral.

## No loop-back log

No `### Loop-back N` entries. This stage has never jumped back to code-generation,
and the failure above is not a code defect, so a loop-back would not address it.
