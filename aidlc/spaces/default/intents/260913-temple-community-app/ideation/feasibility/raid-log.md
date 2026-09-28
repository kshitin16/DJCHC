# RAID Log — Digamber Jain Temple Community App

RAID = Risks, Assumptions, Issues, Dependencies. This log is a living record; entries are added, escalated, or closed as the project moves through later stages.

## Risks

| ID | Risk | Likelihood | Impact | Mitigation | Source |
|---|---|---|---|---|---|
| R1 | Builder is new to both Flutter and AWS Amplify Gen2, which risks slower delivery or rework as unfamiliar patterns are learned | High | Medium (pace, not viability) | Favor conventional, well-documented patterns over custom or clever approaches in later design stages; deliver incrementally rather than attempting the full feature set at once | [Q4] |
| R2 | The temple's tax-exemption (80G/12A) status is unclear, which may block or complicate opening a UPI Autopay-capable merchant account | Medium | High (blocks the donation feature specifically) | Confirm directly with the chosen payment aggregator whether registered-trust status alone is sufficient before donation design work begins; escalate to trustees if a KYC gap is found | [Q2] |
| R3 | No external deadline or budget pressure exists, which can let a volunteer-run project stall rather than ship | Medium | Medium | Track progress through the workflow's own approval gates rather than relying on an external date | [Q5] |

## Assumptions

| ID | Assumption | Validation Needed | Source |
|---|---|---|---|
| A1 | The donor base will remain domestic-only for the life of this version of the app | Re-assess if the temple ever wants to accept donations from overseas or NRI donors — that would trigger FCRA registration requirements not currently in place | [Q3] |
| A2 | AWS costs will stay near the free tier at the community's expected scale (300-1000 people, intermittent usage) | Revisit once real usage data exists, ideally during Infrastructure Design or after initial launch | feasibility-assessment.md |
| A3 | The temple's registered-trust status is sufficient for the payment aggregator's merchant KYC, even without confirmed tax-exemption | Confirm directly with the chosen aggregator (e.g. Razorpay) before donation-feature design begins | [Q2] |

## Issues

None yet — this is a pre-build assessment; no issues have materialized.

## Dependencies

| ID | Dependency | Owner | Status | Source |
|---|---|---|---|---|
| D1 | Payment aggregator (e.g. Razorpay) merchant account with UPI Autopay support | Temple entity / trustees | Not started — account setup was called out as still to be done | [desc] |
| D2 | Apple Developer Program and Google Play Developer accounts for app-store publishing | Mixed (per Q6) | Not started | [Q6] |
| D3 | Google Cloud OAuth app verification, needed for Cognito Google federation sign-in on both platforms | Builder (personal, per Q6) | Not started | [desc] |
| D4 | Trustee confirmation of the temple's tax-exemption status, relevant to the payment aggregator's KYC | Temple trustees | Open — flagged in Q2 as unclear | [Q2] |

## Assumptions & Open Questions

None beyond what is already tracked in the Assumptions section above.
