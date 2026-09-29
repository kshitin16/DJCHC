# Code Generation — Questions (donation-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Consumed: `functional-spec.md`, `rules.md`, `entities.md`, `performance-design.md`, `security-design.md`, `infrastructure-specification.md` (all donation-unit), `contract-summary.md`, `unit-of-work.md`, `requirements.md`.

## Q1. donation-unit is a later-release Unit whose payment aggregator account does not yet exist (Contract 7 is a placeholder) and whose FR5.4 tax-exemption precondition is unconfirmed. How should its code be generated in this pass?

- A. Build it now against the placeholder contract — full build, feature-flagged off
- B. Skip it for now, come back later
- C. Thin, flagged-off build — data model, authorization, validation, idempotent webhook write, reconciliation logic and tests, with every aggregator call behind one adapter interface with a placeholder implementation; `DONATIONS_ENABLED = false` gates every entry point (offered after B proved infeasible: a single Unit cannot be skipped mid-stage without halting every other Unit or rewinding to Units Generation)
- D. Rewind to Units Generation and remove the Unit
- X. Other (please specify)

[Answer]: C

## Plan Approval

Approve this exact Code Generation plan? Covers `code-generation-plan.md` (including its embedded Testing Contract) and `unit-test-instructions.md`.

[Approval Fingerprint]: sha256:v3:d45fcc837acfd92168a15d3470d273b3632d8381620ddf6a9f6f16c52930091c
[Planned Source]: a377d97b70a0f90f486331021beef0cbbd8dbbe7d01234f84b6c169311d5b1d6

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
