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

[Approval Fingerprint]: sha256:v3:261ca2c05ae952d38dde5a1164db06077909fbc34d0520ef3f3e277b7afa5a1c
[Planned Source]: 034d0c3a01340e3c07dc3fe6530edc9caeb741b8846dd5c645e8bbd5f0dbd999

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
