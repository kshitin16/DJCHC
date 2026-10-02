# Quality Gates

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Consumed: `construction/build-and-test/build-and-test-summary.md` (Target Verification Matrix), `construction/build-and-test/test-results.md`, all seven units' `code-summary.md`.
- Affirmed practice: team.md § Testing Posture Q6/Q7 (80% floor, GitHub Actions blocking merge), org.md § Code Style, org.md § Deployment.

## Gate 1 — Pre-merge (CI, automated, blocking)

Every push to `main` and every pull request targeting `main`. All six must pass or
the merge is blocked. These are the gates Build and Test actually exercised, so
they are enforcing what was measured rather than an aspiration.

| Gate | Criterion | Command | Last measured |
|---|---|---|---|
| G1.1 Backend lint | zero ESLint findings | `npm run lint` | clean |
| G1.2 Backend format | Prettier clean on code paths | `npm run format:check` | clean |
| G1.3 Backend types | `tsc --noEmit` clean | `npm run typecheck` | clean |
| G1.4 Backend tests + coverage | all pass; **lines >= 80%** | `jest --coverage` | 284/284, **94.97%** |
| G1.5 App format + analyze | `dart format` clean; zero analyzer issues | `dart format --set-exit-if-changed`, `flutter analyze` | clean |
| G1.6 App tests + coverage | all pass; lines reported | `flutter test --coverage` | 203/203, **91.31%** |

**G1.4 is the load-bearing one.** `coverageThreshold.global.lines: 80` in
`jest.config.ts` is only evaluated when Jest runs with `--coverage`. Drop the flag
and the floor silently stops existing. Lowering the number to make a build pass is
forbidden by `org.md`: *"Build and Test verifies defined coverage floors and
affirmed quality targets; they may not be weakened to make a step pass."*

This is also the project's **only** automated guard against a skipped or weakened
test, because there is no second reviewer. That makes bypassing it a bigger deal
here than on a team.

### Why the walking-skeleton units are not exempted

`auth-unit` and `feed-unit` were held to a lighter smoke-level test bar by the
builder's recorded choice (team.md Q5), and no per-unit coverage threshold was
imposed on them. But the floor is global, and the whole suite clears it at 94.97%,
so nothing needed relaxing to accommodate the skeleton. No per-unit exemption
exists in `jest.config.ts` and none is needed.

## Gate 2 — Pre-commit (local, developer machine)

| Gate | Criterion | Mechanism |
|---|---|---|
| G2.1 Secret scanning | no credential patterns in the staged diff | `gitleaks` via `.pre-commit-config.yaml` |

Requires a one-time `pre-commit install` on each machine. It is a local hook, so it
is advisory in the sense that it can be bypassed with `--no-verify` — GitHub's own
secret scanning and push protection are the second layer that cannot be.

Both layers were explicitly chosen together, not as alternatives (team.md Q13).

## Gate 3 — Repository settings (GitHub, one-time)

Not expressible in the workflow file; set in repository settings and worth
verifying rather than assuming:

| Gate | Criterion |
|---|---|
| G3.1 Secret scanning + push protection | enabled |
| G3.2 Dependabot alerts | enabled on both `package.json` and `pubspec.yaml` |
| G3.3 Branch protection on `main` | require the CI workflow to pass before merge |

G3.3 is what turns Gate 1 from advisory into blocking. Without it the workflow runs
and reports but nothing stops a merge over a red run. **Worth checking first** — it
is the difference between having gates and having notifications.

## Gate 4 — Pre-release (manual, solo-builder shape)

`org.md` specifies "tech lead + product owner sign-off", which does not map to a
solo builder. team.md Q8 replaced it with a concrete checklist, reproduced here as
the operative gate:

| Gate | Criterion |
|---|---|
| G4.1 | No secrets committed — pre-commit hook and GitHub scanning both clean |
| G4.2 | No open dependency warnings — Dependabot clear or explicitly triaged |
| G4.3 | Any AWS permissions or auth change double-checked before merge |
| G4.4 | Self-review of any change touching sign-in, permissions or payment handling (project.md Mandated) |

G4.4 applies right now: this workflow's code generation touched auth, admin
authorization and the donation settlement path.

## Gate 5 — Post-deploy (Operation phase, not yet owned here)

Listed so they are not lost, with their owning stage:

| Gate | Criterion | Owner |
|---|---|---|
| G5.1 Smoke tests pass in the deployed environment | critical paths respond | deployment-execution (4.3) |
| G5.2 Integration checks IT-1 … IT-8 | all pass against a sandbox | deployment-execution (4.3) |
| G5.3 Backend synthesis assertions | bucket hardening, IAM scoping, token policy, field-scoped grant | environment-provisioning (4.2) |
| G5.4 Latency targets measured | ~17 targets against their stated conditions | performance-validation (4.6) |

G5.4's owner exists because you added Performance Validation back to the scope at
the Build and Test gate. Without that it would have had no owner at all.

## What no gate currently covers

**Accessibility (NFR7).** No gate at any level checks it, because nothing was built
toward it — zero `Semantics` or `semanticLabel` in `lib/`, no accessibility test.
`flutter analyze` does not check WCAG conformance. Recorded `Not Met` and unowned in
the Build and Test matrix, and accepted as deferred at that gate.

If it is picked up later, the natural gate is a CI step running an automated
accessibility check over the widget tree, plus a manual screen-reader pass on the
pre-release checklist. Adding the automated half would be a small change to this
workflow.

## Gate bypass policy

A gate exists to stop a defective change reaching users. Bypassing one is an
incident to be recorded, not a shortcut — and on a solo project, where Gate 1 is
the only automated reviewer, there is nobody else to catch what a bypass lets
through.
