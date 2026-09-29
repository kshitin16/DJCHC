# Code Generation — Questions (reminder-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Consumed: `functional-spec.md`, `rules.md`, `entities.md`, `performance-design.md`, `security-design.md`, `infrastructure-specification.md` (all reminder-unit, the last as amended for R-04), `contract-summary.md`, `unit-of-work.md`, `requirements.md`.

No design questions remain open for this Unit. The R-04 fix (the `ownerIndex` GSIs) was decided by the builder at the Infrastructure Design gate ("Fix at Code Generation") and is built into this plan. This re-presentation also corrects Step 3.2's text, which still described the pre-review `allow.resource(reminderApi).to(['query'])` schema-wide grant — review finding R-01 (Major) rejected that mechanism before the code was written, and the plan document was never updated to match; the actual, already-built `amplify/backend.ts` has always used the corrected single-field grant. See the plan's Known Deviations for the full amendment note. The only checkpoint is Plan Approval below.

## Plan Approval

Approve this exact Code Generation plan? Covers `code-generation-plan.md` (including its embedded Testing Contract) and `unit-test-instructions.md`.

[Approval Fingerprint]: sha256:v3:a7c9657f190176cb83522c3d878127c09f0a27e4bee5f0942d54a9e168f89ca7
[Planned Source]: a377d97b70a0f90f486331021beef0cbbd8dbbe7d01234f84b6c169311d5b1d6

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
