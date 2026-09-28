# Functional Design — Questions (feed-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work.md` (FeedUnit definition)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work-story-map.md` (FR2.1-FR2.6, FR5.3 assigned to this Unit)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md` (FeedComponent, Post entity, ADR-003 shared Post shape)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contract 3: Feed Data)

## Q1. Should a post's title and description have a maximum length, or is there no limit?

- A. No limit — any length is accepted
- B. A reasonable limit for a title (e.g. ~100 characters) and a longer one for the description (e.g. ~1000 characters), to keep the feed readable
- C. Not yet defined
- X. Other (please specify)

[Answer]: B. A reasonable limit for a title (e.g. ~100 characters) and a longer one for the description (e.g. ~1000 characters), to keep the feed readable

## Q2. Can an admin edit a post's date/time after it's created (e.g. an event gets rescheduled)? If a post had already aged out of the main view (per the 1-day-after-event-date rule) and its date is edited to a future date, should it come back into the main view?

- A. Yes, admins can edit the date, and editing to a future date brings the post back into the main view (the age-out rule re-evaluates from the current data)
- B. Admins can edit other fields, but the date/time is fixed once created — no rescheduling
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Yes, admins can edit the date, and editing to a future date brings the post back into the main view (the age-out rule re-evaluates from the current data)

## Q3. When an admin deletes a post, should it be a hard delete (gone completely, no trace), or a soft delete (marked deleted but kept for reference)?

- A. Hard delete — gone completely
- B. Soft delete — kept but marked deleted, not shown to anyone
- C. Not yet defined
- X. Other (please specify)

[Answer]: B. Soft delete — kept but marked deleted, not shown to anyone

## Consolidated Summary Confirmation

- Title limited to ~100 characters, description to ~1000 characters.
- Admins can edit a post's date/time; editing to a future date brings an aged-out post back into the main view.
- Deleting a post is a soft delete — kept but marked deleted, not shown to anyone.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
