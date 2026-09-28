# Initiative Brief — Digamber Jain Temple Community App (Sarovar Jinalaya)

One-pager compiling the Ideation phase for handoff into Inception. [Q1]

## Intent & Problem Statement

Two gaps close together: there is no single reliable place for the temple community to learn about events, donation call-outs, and visiting dignitaries, and there is no digital donation channel at all — giving is cash and in-person only today. [intent-statement.md] The app serves a broader public audience beyond the existing community, including visitors and prospective donors, built and maintained by one volunteer as a personal contribution to the temple. [intent-statement.md]

## Market Validation

Not applicable to this initiative — market research was a skipped stage for this workflow, since this is a single-community, non-commercial app with one maintainer rather than a product entering a competitive market. [scope]

## Feasibility & Risk Highlights

**Feasible**, with the risk sitting in organizational preconditions rather than the technology choice. [feasibility-assessment.md] Two risks are carried forward as tracked, not blocking: [Q2] [raid-log.md]

| Risk | Status |
|---|---|
| The temple's tax-exemption (80G/12A) status is unclear, which may complicate the donation aggregator's merchant KYC when that later release starts | Tracked — to confirm directly with the aggregator before donation-feature work begins |
| The builder is new to both Flutter and AWS Amplify Gen2 | Tracked — mitigated by favoring conventional, well-documented patterns and a walking-skeleton-first build order |

No fixed budget or deadline applies, and donations are domestic-only for this version, so FCRA registration is not a current requirement. [constraint-register.md]

## Scope Boundary

**First release**: content feed (event dates/times, visiting-dignitary posts) and the suggestion box, on top of the Cognito Google-federation auth foundation with an allowlist-gated admin group. [scope-document.md]

**Later release**: donations (UPI, one-time first, then recurring/Autopay) and the PDF library (fixed initial categories). [scope-document.md]

**Documented for the future, not building now**: a RAG-based AI-assisted chat for Jain-religion questions. [scope-document.md]

## Concept Visuals

Six screens were wireframed for the first release — Feed, Sign In, Submit Suggestion, My Suggestions, Account, and Admin Post List — reflecting the Sarovar Jinalaya name and theme (mustard/gold-ochre with white trim, the Ahimsa hand symbol, and Jain Pancharangi flag accent colors). [wireframes.md] [Q3] Full detail is in `<record>/ideation/rough-mockups/`.

## Team Plan

Team formation was a skipped stage for this workflow. The initiative is built and maintained by a single volunteer, with temple trustees consulted informally on major decisions (admin definitions, donation account details) rather than through a formal team structure. [intent-statement.md] [Q4]

## Go/No-Go Recommendation

**Go.** The plan matches what was captured across Intent Capture, Feasibility, and Scope Definition; both tracked risks are acceptable to carry forward; the wireframes reflect the intended first release; and the builder confirmed readiness to proceed into Inception. [Q1] [Q2] [Q3] [Q4] [Q5]

## Assumptions & Open Questions

None.
