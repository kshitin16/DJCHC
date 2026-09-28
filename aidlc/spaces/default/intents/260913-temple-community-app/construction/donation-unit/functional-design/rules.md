# Business Rules — donation-unit

```yaml
rules:
  - id: BR5.1
    statement: >
      The app must never store or transmit raw payment details (card
      numbers, UPI PIN), even temporarily. All payment handling goes
      through the aggregator's own tokenized flow.
    category: constraint
    applies_to: Initiate Donation workflow
    trigger: A donation is initiated
    logic: >
      IF a donation is initiated THEN the app only ever holds an
      aggregator-issued reference (aggregatorTransactionId), never raw
      card/UPI credential data.
    violation_behaviour: >
      Any code path that would store or transmit raw payment credentials
      is a defect to be caught at code review, not a runtime state this
      Unit's data model can represent — the entity model has no field for
      raw payment credentials by design.
    source: discovered-rules.md § Forbidden

  - id: BR5.2
    statement: A donation amount must be a positive value; there is no minimum or maximum threshold.
    category: validation
    applies_to: Initiate Donation workflow
    trigger: A donation amount is submitted
    logic: IF amount > 0 THEN accept; ELSE reject with a validation error.
    violation_behaviour: A non-positive amount is rejected before the aggregator checkout is created.
    source: Functional Design Q1

  - id: BR5.3
    statement: >
      A RECURRING donation must specify a frequency (MONTHLY, QUARTERLY,
      or YEARLY); a ONE_TIME donation must not specify one.
    category: validation
    applies_to: Initiate Donation workflow
    trigger: A donation is submitted with donationType = RECURRING or ONE_TIME
    logic: >
      IF donationType = RECURRING THEN frequency must be one of
      {MONTHLY, QUARTERLY, YEARLY}; IF donationType = ONE_TIME THEN
      frequency must be absent.
    violation_behaviour: A RECURRING submission with no frequency, or a ONE_TIME submission with a frequency, is rejected.
    source: Functional Design Q2

  - id: BR5.4
    statement: >
      A payment outcome is never assumed from a timeout alone — the
      aggregator's own record of what actually happened is always checked
      before a Donation's status is resolved to SUCCEEDED or FAILED.
    category: policy
    applies_to: Payment Status Reconciliation workflow
    trigger: A donation remains in PENDING status past the expected confirmation window, or a timeout occurs waiting for the aggregator's response
    logic: >
      IF a timeout occurs THEN query the aggregator's own transaction
      record for this donation THEN resolve status from that record, never
      from the timeout itself.
    violation_behaviour: >
      Resolving a donation's status to SUCCEEDED or FAILED purely because
      a request timed out, without checking the aggregator's record, is a
      rule violation — this is the highest-severity rule in this Unit.
    source: discovered-rules.md § Mandated

  - id: BR5.5
    statement: >
      Processing the same aggregator payment notification twice (the same
      payment_id) has no additional effect on the corresponding Donation's
      status — the webhook handler is idempotent.
    category: constraint
    applies_to: Payment Status Reconciliation workflow
    trigger: The aggregator delivers a webhook notification, possibly more than once for the same payment_id
    logic: >
      IF a notification's payment_id has already been processed for this
      Donation THEN return success without reapplying the status change.
    violation_behaviour: A duplicate delivery that changes Donation.status a second time (e.g. double-crediting) is a defect.
    source: Contract 7 (contract-summary.md), Functional Design Q4 in Contract Design

  - id: BR5.6
    statement: >
      A donor may cancel their own active RECURRING donation from within
      the app; cancellation stops future charges and is only available to
      the donation's own donor, not any other user.
    category: authorization
    applies_to: Cancel Recurring Donation workflow
    trigger: A signed-in user requests to cancel a donation
    logic: >
      IF the requesting identity's Google ID (Contract 1) equals the
      donation's donorGoogleId AND the donation's status is SUCCEEDED with
      donationType RECURRING THEN allow cancellation; ELSE refuse.
    violation_behaviour: A cancellation request from anyone other than the donation's own donor is refused.
    source: Functional Design Q3
```

## Summary

| Rule | Category | What it governs |
|---|---|---|
| BR5.1 | Constraint | No raw payment credentials ever stored/transmitted |
| BR5.2 | Validation | Positive donation amount, no min/max |
| BR5.3 | Validation | Frequency required for RECURRING, absent for ONE_TIME |
| BR5.4 | Policy | Never resolve status from a timeout alone — check the aggregator's record |
| BR5.5 | Constraint | Webhook processing is idempotent |
| BR5.6 | Authorization | Only the donor may cancel their own recurring donation |
