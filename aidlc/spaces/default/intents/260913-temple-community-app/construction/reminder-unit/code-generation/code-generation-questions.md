# Code Generation — Questions (reminder-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Consumed: `functional-spec.md`, `rules.md`, `entities.md`, `performance-design.md`, `security-design.md`, `infrastructure-specification.md` (all reminder-unit, the last as amended for R-04), `contract-summary.md`, `unit-of-work.md`, `requirements.md`.

No design questions remain open for this Unit. The R-04 fix (the `ownerIndex` GSIs) was decided by the builder at the Infrastructure Design gate ("Fix at Code Generation") and is built into this plan. This re-presentation also corrects Step 3.2's text, which still described the pre-review `allow.resource(reminderApi).to(['query'])` schema-wide grant — review finding R-01 (Major) rejected that mechanism before the code was written, and the plan document was never updated to match; the actual, already-built `amplify/backend.ts` has always used the corrected single-field grant. See the plan's Known Deviations for the full amendment note. The only checkpoint is Plan Approval below.

## Plan Approval

Approve this exact Code Generation plan? Covers `code-generation-plan.md` (including its embedded Testing Contract) and `unit-test-instructions.md`.

[Approval Fingerprint]: sha256:v3:c58e0c598f2e43e1c02fc7d506b3bd6b04c7d027df810ffd66034524e6f631cc
[Planned Source]: 6b0061ae14f5dbeffd70a1b362725a10973fc53b11759c5de34db310fa5fc4cf

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
