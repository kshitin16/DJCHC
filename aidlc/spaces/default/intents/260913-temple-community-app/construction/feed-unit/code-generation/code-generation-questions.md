# Code Generation — Questions (feed-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.
- Consumed: `functional-spec.md`, `rules.md`, `entities.md`, `performance-design.md`, `security-design.md`, `infrastructure-specification.md` (all feed-unit), `contract-summary.md`, `unit-of-work.md`, `requirements.md`.

No design questions remain open for this Unit — every decision the plan implements was made and approved at Functional Design, NFR Design, and Infrastructure Design. The only checkpoint is Plan Approval below.

## Q1. After the first build, the installed Amplify version turned out to refuse guest-identity authorization on the no-Lambda resolver style the design chose for the public `listPosts`; the developer fell back to an AppSync API key (expires within 365 days). How should the public feed read be authorized?

- A. Small Lambda + guest identity — make `listPosts` a Lambda-backed query with the guest-identity rule the design intended; no expiring key
- B. Keep the API key — accept as built; redeploy the backend at least yearly or anonymous feed access stops
- X. Other (please specify)

[Answer]: A

## Plan Approval

Approve this exact Code Generation plan? Covers `code-generation-plan.md` (Revision 2, including its embedded Testing Contract) and `unit-test-instructions.md`.

[Approval Fingerprint]: sha256:v3:0a9d01c6e0e6d7814261544765a85c46ec0df2254b8d8b388102bd83ba55fd44
[Planned Source]: a377d97b70a0f90f486331021beef0cbbd8dbbe7d01234f84b6c169311d5b1d6

- Approve Plan — proceed to code generation
- Request Changes — revise the plan

[Answer]: Approve Plan
