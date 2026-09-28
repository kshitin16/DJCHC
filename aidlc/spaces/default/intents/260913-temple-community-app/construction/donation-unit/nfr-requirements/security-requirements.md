# Security Requirements — donation-unit

## NFR3.1 — Payment data handling (inherits inception NFR3)

```
NFR3.1: The app never stores or transmits raw payment credentials (card numbers, UPI PIN), even
temporarily (BR5.1). Only an aggregator-issued reference (aggregatorTransactionId) is persisted.
PCI-DSS scope: reduced to near-zero via tokenization (Q4, confirmed) — this Unit never holds
cardholder data, so the bulk of PCI-DSS's 12 requirement families do not apply to it; the
aggregator carries its own PCI compliance for anything touching raw card/UPI data.
No additional PCI-specific control (network segmentation, cardholder-data-environment scanning,
etc.) is added at this stage beyond BR5.1's existing constraint.
```

## NFR4.1 — Personal/financial data protection (inherits inception NFR4)

```
Classification: Donation records (amount, donorGoogleId, aggregatorTransactionId) are Confidential —
financial activity tied to a real identity.
Encryption at rest: AWS-managed DynamoDB encryption (AES-256), consistent with NFR4's blanket
requirement for personal data.
Encryption in transit: TLS 1.2+ for both the AppSync GraphQL boundary (Contract 5) and the
webhook boundary (Contract 7).
PII handling: donorGoogleId is the only personal identifier this Unit stores; amount and status
are financial activity data, not identity data on their own.
```

## NFR5.1 — Payment reconciliation (inherits inception NFR5; this Unit's core purpose)

```
NFR5.1: A payment outcome is never resolved from a timeout alone (BR5.4). A Donation left PENDING
for 5 minutes (Q1) triggers a direct check of the aggregator's own transaction record; status is
set from that record, never inferred from the absence of a webhook.
NFR5.2 (idempotency): the webhook handler enforces BR5.5 via an atomic DynamoDB conditional write
keyed on payment_id (Q2) — "apply this status update only if payment_id has not already been
recorded for this Donation" — rather than a separate read-then-write check, which would leave a
race window where two near-simultaneous webhook deliveries could both pass a stale read.
```

## NFR3.5 — Access-boundary and change-review process (inherits inception NFR6)

```
NFR-AUTHZ (process): only services/donation_service.dart may call package:amplify_* or generated
AppSync/GraphQL operations for this Unit; screens/widgets never call Amplify directly (inherited
firm rule, project.md Mandated).

Trigger: any change to donation_service.dart, the webhook handler, or the aggregator integration
requires a brief self-review before merging (project.md Mandated, Q14 option E) — this Unit is
explicitly named in that rule ("any change touching sign-in, permissions, or (later) payment
handling").
```

## Threat model (STRIDE)

| Threat | Applicable? | Mitigation |
|---|---|---|
| Spoofing | Yes — a forged webhook claiming a fake payment outcome | Contract 7's signature verification (401 on failure) is checked before any Donation status changes; the caller's identity for Initiate/Cancel is Contract 1's signed-in identity |
| Tampering | Yes — a tampered webhook payload, or a client-side attempt to set amount/status directly | Signature verification on the webhook; `status`/`aggregatorTransactionId` are never client-settable fields on the GraphQL mutations (Contract 5) |
| Repudiation | Yes — a donor disputing a charge | `aggregatorTransactionId` plus `createdAt`/`cancelledAt` timestamps give an audit trail tying every state change to the aggregator's own record |
| Information Disclosure | Yes — donation amount/history is sensitive | `myDonations` is owner-scoped (Contract 1); no query returns another donor's records; no raw payment credential exists to disclose (BR5.1) |
| Denial of Service | Low, but see NFR5.1 — a burst of duplicate webhook deliveries | The idempotent conditional write (NFR5.2) means duplicate deliveries are cheap no-ops, not a resource-exhaustion risk |
| Elevation of Privilege | Yes — one donor cancelling another's recurring donation | BR5.6's authorization check (donorGoogleId must equal caller's identity) enforced server-side on `cancelDonation` |

## Out of scope

No cardholder-data-environment (CDE) network segmentation, quarterly vulnerability scans, or annual penetration testing are adopted as this Unit's own obligations — those apply to the aggregator's PCI-DSS scope, not to a tokenization-only integrator (Q4).
