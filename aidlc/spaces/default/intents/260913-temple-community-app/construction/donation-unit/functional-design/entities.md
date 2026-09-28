# Entity Model — donation-unit

```yaml
entities:
  - name: Donation
    description: >
      A single donation transaction (one-time) or an active recurring/Autopay
      mandate. For RECURRING donations, this record represents the mandate
      itself — individual periodic charges are executed and tracked by the
      payment aggregator, not modeled as separate Donation records in this
      design pass (see Assumptions below).
    identifier: id
    attributes:
      - name: id
        type: UUID
        required: true
        unique: true
        description: Matches Contract 5's `id: ID!` field exactly (Amplify Data's default primary-key name); named `id`, not `donationId`, to avoid a silent rename against the shared GraphQL contract.
      - name: donorGoogleId
        type: string
        required: true
        description: The Cognito identity (sub) of the donor, from Contract 1 — not a reference to a modeled entity
      - name: amount
        type: decimal
        required: true
        min: 0.01
        description: >
          No business-rule minimum or maximum (Q1: "any positive amount is
          accepted") — the 0.01 floor here is a technical constraint (the
          smallest representable positive currency value, i.e. "greater
          than zero"), not a minimum donation threshold. See BR5.2.
      - name: donationType
        type: enum
        required: true
        allowed_values: [ONE_TIME, RECURRING]
      - name: frequency
        type: enum
        required: false
        allowed_values: [MONTHLY, QUARTERLY, YEARLY]
        constraints: required when donationType is RECURRING; must be absent when donationType is ONE_TIME (Q2)
      - name: status
        type: enum
        required: true
        allowed_values: [INITIATED, PENDING, SUCCEEDED, FAILED, CANCELLED]
        default: INITIATED
      - name: aggregatorTransactionId
        type: string
        required: false
        unique: true
        description: Populated once the aggregator assigns a transaction reference; absent while status is INITIATED
      - name: createdAt
        type: datetime
        required: true
      - name: cancelledAt
        type: datetime
        required: false
        constraints: set only when status transitions to CANCELLED (Q3); absent otherwise
    entity_constraints:
      - frequency is required if and only if donationType = RECURRING
      - cancelledAt is set if and only if status = CANCELLED
      - CANCELLED is reachable only from an active RECURRING mandate (SUCCEEDED status with donationType = RECURRING)
    relationships: []
```

## Summary

DonationUnit owns exactly one entity, `Donation`, which covers both one-time transactions and recurring/Autopay mandates through `donationType`. Its identifier is `id`, matching Contract 5's `id: ID!` exactly. It has no relationships to entities in other Units — `donorGoogleId` is a plain reference to the Cognito identity established by AuthUnit (Contract 1), not a cross-component entity reference, consistent with Domain Design ADR-002 (no separate User/Profile entity anywhere in this domain).

## Assumptions & Open Questions

- Individual periodic charges for a RECURRING mandate are not modeled as separate `Donation` records here — the app shows the donor their mandate's status (active/cancelled), and the aggregator's own systems execute and record each periodic charge. This simplification should be revisited once the real aggregator's recurring-payment API shape is known (Contract 7's open question in `contract-summary.md` already flags the webhook payload as provisional). [assumption]
