# Build and Test Summary

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard; Test Strategy: Standard; Construction Autonomy Mode: gated.
- Consumed: all seven units' `code-generation-plan.md` (and their embedded `## Testing Contract`), `unit-test-instructions.md`, `code-summary.md`; every artefact under `*/nfr-requirements/` and `*/nfr-design/`.

## Overall status

| Dimension | Status |
|---|---|
| Build | **Ready** for type-check/analyze; **never assembled** — no `flutter build`, no deploy |
| Tests | **Ready and green** — 284 backend + 203 app, all passing |
| Coverage | **Met** — 94.97% backend, 91.31% app, both over the affirmed 80% floor |
| Deployment | **Not ready** — nothing has been deployed or run on a device |
| Stage verdict | **FAILED** by predicate — see the matrix and `test-results.md` F-1 |

## Test instruction inventory

| File | Generated | Why |
|---|---|---|
| `build-instructions.md` | Yes | Always |
| `integration-test-instructions.md` | Yes | Standard strategy requires it |
| `performance-test-instructions.md` | Yes — above baseline | ~17 measurable latency targets exist and Performance Validation is SKIP, so the method had to be recorded somewhere |
| `security-test-instructions.md` | Yes — above baseline | Firm security rules in `project.md`, personal data, a future payment flow |
| `cross-unit-traceability.md` | Yes | Step 10 gate |
| `test-results.md` | Yes | Step 9 execution record |

## Coverage per unit

All seven units' suites are inside the single backend or app run; the per-unit
scoped commands remain individually runnable.

| Unit | Scoped command | Bar | Status |
|---|---|---|---|
| auth | `npm run test:auth` | smoke (walking skeleton) | 14 tests pass |
| feed | `npm run test:feed` | smoke (walking skeleton member) | pass within the suite |
| donation | `npm run test:donation` | 80% floor | pass within the suite |
| pdf-library | `npm run test:pdf` | 80% floor | pass within the suite |
| suggestion | `npm run test:suggestion` | 80% floor | pass within the suite |
| reminder | `npm run test:reminder` | 80% floor | pass within the suite |
| flutter-app | `flutter test --coverage` | 80% floor | 203 tests pass, 91.31% |

## Target Verification Matrix

Verdicts: `Met`, `Not Met`, `Unverified`. No `Pending` remains.

| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |
|---|---|---|---|---|---|---|
| COV-BACKEND | team.md Q6 | >= 80% lines | 94.97% | `npm test -- --coverage` | build-and-test | **Met** |
| COV-APP | team.md Q6 | >= 80% lines | 91.31% | `flutter test --coverage`, lcov | build-and-test | **Met** |
| COV-ENFORCED | team.md Q7 | CI blocks on failure | Workflow present, arms the floor | `.github/workflows/ci.yml` | ci-pipeline | **Unverified** — never executed in GitHub |
| BUILD-TYPECHECK | org.md Code Style | clean | clean | `npm run typecheck` | build-and-test | **Met** |
| BUILD-LINT | org.md Code Style | clean | clean | `npm run lint` | build-and-test | **Met** |
| BUILD-FORMAT | team.md Q9 | clean | clean | `npm run format:check` | build-and-test | **Met** |
| BUILD-ANALYZE | team.md Q9 | clean | "No issues found!" | `flutter analyze` | build-and-test | **Met** |
| BUILD-ARTEFACT | build-instructions.md | apk / ipa produced | not attempted | Android SDK, Xcode absent | deployment-execution | **Unverified** |
| SEC-SECRETS | project.md Mandated | none committed | none found | gitleaks hook + greps | build-and-test | **Met** |
| SEC-NO-PAYMENT-DATA | project.md Forbidden | no raw card/UPI PIN | none present | donation types + schema inspection | build-and-test | **Met** |
| SEC-ADMIN-SERVER | project.md Mandated | server-side enforced | 19 `allow.group('Admin')` rules + handler backstops | `amplify/data/resource.ts` | build-and-test | **Met** |
| SEC-SERVICE-BOUNDARY | project.md Mandated | only `services/` imports Amplify | 2 files, both in `lib/services/` | grep over `lib/` | build-and-test | **Met** |
| SEC-RATE-LIMIT-ATOMIC | project.md learned rule | atomic conditional write | single conditional `UpdateItem` | `suggestion` tests, 284 pass | build-and-test | **Met** |
| SEC-ENCRYPTION | project.md Mandated | at rest + in transit | configured in source, never synthesised | `amplify/backend.ts` | environment-provisioning | **Unverified** |
| SEC-AUTHZ-MATRIX | security-test-instructions ST-1 | per-role allow/refuse | not exercised | needs sandbox | deployment-execution | **Unverified** |
| SEC-CROSS-TENANT | security-test-instructions ST-2 | no cross-user reads | source-verified only | needs sandbox | deployment-execution | **Unverified** |
| INT-REMINDER-AUTHMODE | integration-test-instructions IT-1 | signed-in calls succeed | not exercised | needs sandbox | deployment-execution | **Unverified** |
| INT-GRAPHQL-DOCS | integration-test-instructions IT-2 | documents match schema | not compared | needs sandbox | deployment-execution | **Unverified** |
| AUTH-NFR1.1 | auth `performance-requirements.md` | < 3 s p95 | not measured | — | performance-validation | **Unverified** |
| AUTH-NFR1.2 | auth `performance-requirements.md` | < 5 ms | not measured | — | performance-validation | **Unverified** |
| FEED-NFR1.1 | feed `performance-requirements.md` | < 2 s p95 | not measured | — | performance-validation | **Unverified** |
| FEED-NFR1.2 | feed `performance-requirements.md` | < 2 s p95 | not measured | — | performance-validation | **Unverified** |
| FEED-NFR1.3 | feed `performance-requirements.md` | < 2 s p95 | not measured | — | performance-validation | **Unverified** |
| PDF-PERF.1 | pdf-library `performance-requirements.md` | < 2 s p95 | not measured | — | performance-validation | **Unverified** |
| PDF-PERF.2 | pdf-library `performance-requirements.md` | < 1 s p95 | not measured | — | performance-validation | **Unverified** |
| PDF-PERF.3 | pdf-library `performance-requirements.md` | < 1 s per call | not measured | — | performance-validation | **Unverified** |
| SUGG-PERF.1 | suggestion `performance-requirements.md` | < 2 s p95 | not measured | — | performance-validation | **Unverified** |
| SUGG-PERF.2 | suggestion `performance-requirements.md` | < 2 s p95 | not measured | — | performance-validation | **Unverified** |
| REM-PERF.1 | reminder `performance-requirements.md` | < 2 s p95 | not measured | — | performance-validation | **Unverified** |
| REM-PERF.2 | reminder `performance-requirements.md` | < 1 s p95 | not measured | — | performance-validation | **Unverified** |
| REM-PERF.3 | reminder `performance-requirements.md` | within 2 min | not measured | — | performance-validation | **Unverified** |
| APP-PERF.1 | flutter-app `performance-requirements.md` | < 3 s cold start | not measured | — | performance-validation | **Unverified** |
| APP-PERF.2 | flutter-app `performance-requirements.md` | < 300 ms transition | not measured | — | performance-validation | **Unverified** |
| DON-PERF.1 | donation `performance-requirements.md` | < 2 s p95 | not measured | flag-gated off | performance-validation | **Unverified** |
| DON-PERF.2 | donation `performance-requirements.md` | < 1 s p95 | not measured | flag-gated off | performance-validation | **Unverified** |
| NFR7-ACCESSIBILITY | `requirements.md` NFR7 | WCAG AA baseline | nothing implemented | 0 `Semantics`/`semanticLabel` in `lib/` | **unowned** | **Not Met** |
| NFR8-TESTABILITY | `requirements.md` NFR8 | test-after, floors as affirmed | as affirmed | 487 tests, floors met | build-and-test | **Met** |
| TRACE-FR | `cross-unit-traceability.md` | all FRs covered | 28/29 + 1 `N/A` | that file | build-and-test | **Met** |

### Matrix roll-up

- **Met: 15**
- **Not Met: 1** (NFR7 accessibility)
- **Unverified: 25** — all now have a scheduled owning stage. The ~17 latency
  targets were orphaned while Performance Validation (4.6) was SKIP; the human
  recomposed the scope to add it back (26 stages in scope), so they are
  legitimately deferred to 4.6 with the method recorded in
  `performance-test-instructions.md`. A deferred target still counts as
  `Unverified` for this stage's verdict.
- **NFR7 (accessibility) remains unowned.** It is `Not Met` rather than
  Unverified — nothing was built toward it, so there is nothing to measure. It
  needs either an implementation pass or a recorded deliberate deferral; no
  scheduled stage currently owns it.

## Readiness assessment

**Build-ready:** yes, to the limit of this machine. Type-check, lint, format and
analyze are all clean, and both suites are green.

**Test-ready:** yes for unit level, which is comprehensively covered. No for
integration, performance or security-at-runtime — all need a deployed sandbox and,
for the app, a device toolchain.

**Deployment-ready:** no. Nothing has been deployed, synthesised, built into an
artefact, or run on a device. The next real signal comes from the first
`ampx sandbox`.

## Known limitations and outstanding items

1. **~17 performance targets have no owning stage** (`test-results.md` F-1). The
   scope committed to measurable latency targets and skipped the stage that would
   measure them. This is the reason the stage verdict is FAILED, and it needs a
   human decision.
2. **NFR7 accessibility is unaddressed** (`cross-unit-traceability.md` X-2). Not a
   test gap — nothing was built toward it, and no unit owned it.
3. **The CI workflow has never run.** Its first execution is a real check.
4. **No device toolchain.** Android SDK, Xcode and CocoaPods are all absent, so
   `flutter build` and `integration_test/` are untouched.
5. **Open findings from Code Generation ride along**: 5 major, ~30 minor across
   the seven units, recorded under `.aidlc-reviews/code-generation/units/`. The two
   donation majors and the reminder late-sync major are the ones that matter before
   those features go live.
6. **~10 deferred documentation corrections** across the units' plan and
   test-instruction files, listed in each unit's `code-summary.md` under
   `## Deferred doc corrections`.
7. **FR6.3 is an orphan ID** in one unit's upstream list.
