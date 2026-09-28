# NFR Requirements — Questions (suggestion-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/suggestion-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/suggestion-unit/functional-design/rules.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md` (NFR1-NFR8)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 1, 2, 4)

This Unit is unusual among this project's Units in that its core authorization rule (BR3.3) is enforced *declaratively* at the AppSync/Amplify Data layer (owner/group auth rules) rather than in application resolver code — a caller who fails the check never reaches any code this Unit's own logging could observe.

## Q1. Since BR3.3's authorization refusals happen at the AppSync gateway layer, before any resolver code runs, this Unit's own application-level logging cannot observe them directly. What should the observability posture be for unauthorized-access attempts (e.g. a non-admin trying `allSuggestions`)?

- A. Rely on AppSync's own CloudWatch access logs (enabled at the API level, not per-Unit) for visibility into declarative-auth refusals, rather than trying to add application-level logging for an event this Unit's own code never sees. This is a genuine architectural boundary, not a gap to work around. (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Rely on AppSync's CloudWatch access logs.

## Q2. Hitting BR3.5's 5-per-day submission limit: should this get any logging/alerting treatment, e.g. to spot a pattern of a single user repeatedly hitting the cap?

- A. Standard INFO-level logging only (who, when the cap was hit) — no alerting. Repeatedly hitting a 5-per-day cap on a community suggestion box is not a security or financial event; it's just eager engagement, and the builder doesn't need to be paged for it. (Recommended)
- B. Add alerting for repeated cap-hits by the same user.
- X. Other (please specify)

[Answer]: A. Standard INFO logging only.

## Q3. Scalability: since BR3.4 means suggestions are never deleted, the total count only grows. What's a realistic 12-month volume assumption for capacity planning?

- A. Up to ~1500 suggestions in 12 months (a quarter to full community × BR3.5's 5-per-day ceiling, in practice far lower since 5/day is a rare-abuse ceiling, not a typical-use rate — realistic typical use is closer to one suggestion per active user over months, not daily). This is a conservative upper bound, not an expected average. (Recommended)
- B. A different volume assumption — specify
- X. Other (please specify)

[Answer]: A. Up to ~1500.

## Consolidated Summary Confirmation

- Declarative AppSync auth refusals (BR3.3) are observed via AppSync's own CloudWatch access logs, not application-level logging — this Unit's own code never sees a refused request.
- Hitting the 5-per-day cap gets standard INFO logging only, no alerting.
- 12-month scalability assumption: up to ~1500 suggestions (a conservative ceiling, not an expected average, since BR3.5's 5/day cap is a rare-abuse guard rather than typical usage).
- Performance/reliability targets otherwise follow guide defaults appropriate to this app's low-traffic, best-effort posture, consistent with the other Units' NFR passes.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
