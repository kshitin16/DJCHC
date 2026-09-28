# Constraint Register — Digamber Jain Temple Community App

## Technical Constraints

| Constraint | Detail | Source |
|---|---|---|
| Single codebase for iOS and Android | Flutter | [desc] |
| Backend stack is fixed | AWS Amplify Gen2 — Cognito (Google federation), Amplify Data/AppSync + DynamoDB, S3, Lambda | [desc] |
| No existing systems to integrate with | Greenfield — nothing to migrate or reconcile against | [Q1] |
| Donation recurrence requires a UPI Autopay-capable aggregator | UPI (PhonePe/Google Pay) donations, including recurring/subscription donations, require a payment aggregator with UPI Autopay support (e.g. Razorpay); account not yet set up | [desc] |
| Single maintainer, no existing AWS footprint | The app is built and maintained by one person; there is no prior AWS account or infrastructure to build on | [intent-statement.md] |

## Organizational Constraints

| Constraint | Detail | Source |
|---|---|---|
| Informal governance | The project owner decides scope and priority, consulting temple trustees informally on major changes; no formal sign-off process | [intent-statement.md] |
| No fixed budget or deadline | Self-funded personal project, running at its own pace | [Q5] |
| Builder is new to the stack | The person building and maintaining this app is new to both Flutter and AWS Amplify Gen2 | [Q4] |
| Mixed account ownership | AWS and similar accounts likely personal; Razorpay (or equivalent) likely needs to be under the temple's legal entity | [Q6] |
| No structured reporting cadence | Trustees see the app when it's ready to use, not on a set schedule | [intent-statement.md] |

## Regulatory Constraints

| Constraint | Detail | Source |
|---|---|---|
| Payment aggregator requires entity KYC | The temple is a registered trust/society, but its tax-exemption (80G/12A) status is unclear — this is an open precondition for opening a UPI Autopay-capable merchant account | [Q2] |
| No FCRA exposure for this version | Donations are domestic-only for now; foreign/NRI donations would trigger FCRA registration requirements not currently in place | [Q3] |
| Personal data handling | The app collects personal data via Google sign-in, donation records, and suggestion-box submissions — general data-protection practice (purpose limitation, data minimization, defined retention) applies and should be addressed explicitly in Requirements Analysis | [desc] (inference — flagged, not yet a confirmed requirement) [assumption] |
| Payment-credential scope reduction | Routing donations through a third-party aggregator keeps the app itself out of direct card/payment-credential handling, provided no raw payment credentials are ever stored or transmitted by the app | [desc] (inference from the payment aggregator model) [assumption] |

## Assumptions & Open Questions

- Whether the temple's registered-trust status alone (without confirmed 80G/12A) is sufficient for the chosen payment aggregator's merchant KYC is not yet confirmed. [assumption]
- Whether donor identity/PII handling needs a formal privacy notice or specific retention rule is not yet defined; deferred to Requirements Analysis. [assumption]
