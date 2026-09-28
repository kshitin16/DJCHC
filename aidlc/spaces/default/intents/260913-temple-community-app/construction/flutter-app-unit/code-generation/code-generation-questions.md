# Code Generation — Questions (flutter-app-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Consumed: `functional-spec.md`, `frontend-components.md`, `tech-stack-decisions.md`, `performance-design.md`, `security-design.md`, `infrastructure-specification.md`, `cicd-pipeline.md` (all flutter-app-unit), `contract-summary.md`, `unit-of-work.md`, `requirements.md`, and the built backend schema `amplify/data/resource.ts`.

No design questions remain open for this Unit. Three routine decisions the plan makes visible rather than asks: the Flutter project lives at the workspace root; the application/bundle ID is `in.sarovarjinalaya.app`; Screens 8–11 are built behind compile-time flags. The identity-switch behaviour of reminders across sign-in/out is disclosed in the plan (rule 4) as a sandbox-integration finding, not decided here. The only checkpoint is Plan Approval below.

## Plan Approval

Approve this exact Code Generation plan? Covers `code-generation-plan.md` (including its embedded Testing Contract) and `unit-test-instructions.md`.

[Approval Fingerprint]: sha256:v3:77d07c85137bf7b3bce81dc12d6aa36a31b7783f2aca190501c3dce4094337ce
[Planned Source]: aadb09b9e33b5ed4d0b0b139b52d53575a599fe6ebb0a3bab7e2c48a7f2543a1

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
