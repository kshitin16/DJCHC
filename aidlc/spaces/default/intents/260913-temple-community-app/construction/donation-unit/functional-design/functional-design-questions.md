# Functional Design — Questions (donation-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work.md` (DonationUnit definition)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work-story-map.md` (FR5.1, FR5.2 assigned to this Unit)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md` (DonationComponent, Donation entity)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contract 5: Donation Data, Contract 7: Aggregator Webhook)

This Unit is a later release, blocked on the temple's tax-exemption confirmation (FR5.4). It is being designed in full now per the earlier confirmed decision to map the whole domain upfront.

## Q1. Is there a minimum donation amount, a maximum, or no limit either way?

- A. No minimum or maximum — any positive amount is accepted
- B. A minimum only (e.g. a small amount like ₹10 or ₹50, to avoid negligible transactions)
- C. Both a minimum and a maximum
- D. Not yet defined
- X. Other (please specify)

[Answer]: A. No minimum or maximum — any positive amount is accepted

## Q2. For recurring/Autopay donations, should the donor be able to choose a frequency (e.g. monthly, quarterly, yearly), or is monthly the only option?

- A. Monthly only
- B. Donor chooses from a few standard frequencies (e.g. monthly, quarterly, yearly)
- C. Not yet defined
- X. Other (please specify)

[Answer]: B. Donor chooses from a few standard frequencies (e.g. monthly, quarterly, yearly)

## Q3. Can a donor cancel their own recurring/Autopay donation from within the app, or does cancellation happen some other way (e.g. through the aggregator directly, or by contacting the temple)?

- A. Yes — cancellation is a feature within the app
- B. No — cancellation happens outside the app (aggregator's own portal, or contacting the temple)
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. Yes — cancellation is a feature within the app

## Consolidated Summary Confirmation

- No minimum or maximum donation amount.
- Recurring/Autopay donors choose a frequency (monthly, quarterly, or yearly).
- Donors can cancel their own recurring donation from within the app.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
