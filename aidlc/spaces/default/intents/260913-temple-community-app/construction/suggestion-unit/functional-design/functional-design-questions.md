# Functional Design — Questions (suggestion-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work.md` (SuggestionUnit definition)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work-story-map.md` (FR3.1-FR3.5 assigned to this Unit)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md` (SuggestionComponent, Suggestion entity)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contract 4: Suggestion Data)

## Q1. Can an admin delete a suggestion (e.g. to remove spam or inappropriate content), or are suggestions permanent once submitted?

- A. Yes, admins can delete a suggestion
- B. No delete capability needed for this release — suggestions are permanent
- C. Not yet defined
- X. Other (please specify)

[Answer]: B. No delete capability needed for this release — suggestions are permanent

## Q2. Is there any limit on how many suggestions one person can submit (e.g. to prevent spam), or is submission unlimited?

- A. Unlimited — no rate limit
- B. A reasonable limit (e.g. a handful per day)
- C. Not yet defined
- X. Other (please specify)

[Answer]: B. A reasonable limit — 5 per day

## Q2a (follow-up). Confirmed: 5 suggestions per person per day.

[Answer]: Confirmed — 5 per day

## Consolidated Summary Confirmation

- No delete capability for suggestions in this release — they are permanent.
- A submission limit of 5 suggestions per person per day.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
