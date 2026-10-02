# Phase Boundary Verification — Construction → Operation

Run at CI Pipeline (3.7), the final Construction stage. Date: 2026-10-01.

## Sources

- `construction/build-and-test/cross-unit-traceability.md`
- all seven `construction/*/code-generation/traceability.json`
- `construction/build-and-test/build-and-test-summary.md` (Target Verification Matrix)
- `construction/build-and-test/test-results.md`
- `.aidlc-reviews/code-generation/units/*/` (seven recorded review verdicts)
- `construction/ci-pipeline/quality-gates.md`

## Verdict: **NOT CLEAN** — proceeding to Operation is a human decision

Three of the four boundary conditions hold. One does not, and one item is a
genuine uncovered requirement rather than an accepted risk. Nothing here is
hidden: every item below was surfaced at the gate that owned it and explicitly
accepted, except where noted.

| Condition | Result |
|---|---|
| All Units built | **Pass** — 7 of 7 |
| All Units tested | **Pass** — 487 tests, all passing |
| Code-generation findings resolved | **Accepted risk**, not resolved — see below |
| Cross-unit FR/NFR/AC gate passed | **Fail** — see `cross-unit-traceability.md` |

## Condition 1 — all Units built

Pass. Seven units, each with a recorded `UNIT_COMPLETED` receipt under the current
stage attempt, each with a current `REVIEW_COMPLETED` verdict from
`aidlc-architecture-reviewer-agent`:

| Unit | Review verdict | Traceability file |
|---|---|---|
| auth-unit | READY | present |
| donation-unit | READY | present |
| feed-unit | READY | present |
| pdf-library-unit | READY | present |
| suggestion-unit | READY | present |
| reminder-unit | READY | present |
| flutter-app-unit | READY | present |

No traceability file is missing.

## Condition 2 — all Units tested

Pass. Measured at Build and Test, not asserted:

- Backend: 47 suites, **284 tests**, all pass. Lines **94.97%**, branches 82.62%.
- App: **203 tests**, all pass. Lines **91.31%**.
- Both clear the affirmed 80% line floor. Nothing was lowered or disabled.
- `tsc --noEmit`, ESLint, Prettier and `flutter analyze` all clean.

**Scope of that evidence.** These are unit tests. Every backend test fakes the
DynamoDB client; every app service test fakes the Amplify gateway. They prove the
code compiles and its logic is internally consistent. They prove nothing about
real AWS: no Cognito sign-in, no DynamoDB write, no AppSync query, no S3 transfer,
no push delivery, no CloudFormation synthesis has ever happened. The app has never
been built into an installable artefact or run on a device.

That limitation is recorded in `test-results.md` and is why 25 matrix targets read
`Unverified` rather than `Met`.

## Condition 3 — code-generation findings

**Accepted risk, not resolved.** Seven advisory reviews produced 5 major and ~30
minor findings. The human approved the Code Generation gate, which maps every open
finding to `Accepted risk` on the `GATE_APPROVED` row — they were triaged, not
overlooked.

The five majors, carried forward:

| Unit | Finding | Gating condition |
|---|---|---|
| donation | A webhook settling before `markPending` commits leaves a succeeded donation with no aggregator reference, breaking recurring cancellation | Before `DONATIONS_ENABLED` is flipped |
| donation | The orphan sweep re-logs an error per row every tick and never quiets; it also catches legitimately abandoned checkouts | Before `DONATIONS_ENABLED` is flipped |
| reminder | A device syncing after the intended send time — the normal first open — can leave a reminder that never fires and never clears | Before reminders ship |
| flutter-app + reminder | Signed-in users' reminder calls may be rejected by AppSync: the app calls in IAM mode, the schema's rule may accept that only for guests | First sandbox run (IT-1) |
| suggestion | Documentation credits the wrong layer for owner-only enforcement; the enforcement itself is correct | Documentation only |

Two of the five are behind a feature flag that is off. One is documentation. The
reminder pair are the live ones and both are cheap to settle — IT-1 needs one
signed-in sign-in against a sandbox.

## Condition 4 — cross-unit coverage gate

**Fail.** `cross-unit-traceability.md` returned FAIL with three findings:

- **X-1 — FR5.4 uncovered, `N/A`.** An organisational precondition (tax-exemption
  status confirmed with the aggregator). No code artefact can satisfy it, so no
  unit could have claimed it. Correctly absent; tracked as a donations release
  blocker. Not a defect.
- **X-2 — NFR7 (accessibility) `Not Met` and unowned.** This is the one item that is
  not merely an accepted risk: a requirement with nothing built toward it. Zero
  `Semantics` or `semanticLabel` in `lib/`; no accessibility test at any level; no
  gate at any level covers it. The human accepted it as deferred at the Build and
  Test gate, but **no scheduled stage owns it**, so it will not resurface on its own.
- **X-3 — `FR6.3` orphan.** One unit's `upstream_ids` cites an ID that
  `requirements.md` does not define. Harmless in effect; nothing rests on it.

28 of 29 functional requirements are covered `OK` with existing target files. Six
of eight NFRs are substantively covered through their per-unit children.

## CI gates enforce what Build and Test measured

Confirmed. `quality-gates.md` Gate 1 runs exactly the commands Build and Test
executed — `npm run lint`, `format:check`, `typecheck`, `jest --coverage`,
`dart format`, `flutter analyze`, `flutter test --coverage` — and blocks merge on
failure. The `--coverage` flag is what arms the 80% floor; without it the threshold
is not evaluated.

One caveat: **the workflow has never run in GitHub.** This stage fixed a defect
that would have failed its first run (the gitignored `amplify_outputs.dart` the app
job needs), pinned the Flutter version, and reconciled the format gate with the
local script. Every command passes locally. "It will work in CI" remains a
prediction until a push proves it.

Also: Gate 1 blocks merge only if branch protection on `main` requires the workflow
to pass. That is a repository setting, not something the workflow file can assert.
Worth verifying before relying on it — it is the difference between gates and
notifications.

## Carried into Operation

| Item | Owning stage |
|---|---|
| ~17 latency targets to measure | performance-validation (4.6) — added to scope at the Build and Test gate |
| 8 integration checks (IT-1 … IT-8), IT-1 first | deployment-execution (4.3) |
| Backend synthesis assertions — bucket, IAM, token policy, field-scoped grant | environment-provisioning (4.2) |
| Smoke tests in a deployed environment | deployment-execution (4.3) |
| First real CI run | first push |
| **NFR7 accessibility** | **unowned** |
| Android SDK / Xcode / CocoaPods install | the builder |
| Payment aggregator account, Firebase project, Google OAuth credentials | the builder |
| Native Hindi review of app copy | the builder |
| ~10 deferred documentation corrections | unowned, low risk |

## Recommendation

The boundary is not clean, and the honest statement is that Operation would begin
with real, named outstanding work rather than a green field. But nothing
outstanding is a blocker for *starting* Operation, because Operation is precisely
where most of it gets settled: deploying a sandbox converts the largest block of
`Unverified` targets into measured ones, and IT-1 is the cheapest high-value check
in the whole backlog.

The one item that genuinely needs a decision rather than a deployment is **NFR7**.
It has no owner and no gate, so if it is not picked up deliberately it will simply
not happen.
