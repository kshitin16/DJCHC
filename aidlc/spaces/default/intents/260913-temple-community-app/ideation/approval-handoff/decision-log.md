# Decision Log — Ideation Phase

Compiled record of decisions made across every Ideation stage, in the order they were made.

## Intent Capture & Framing

| Decision | Chosen | Source |
|---|---|---|
| Core problem | Both the information gap (no reliable place for temple happenings) and the donation gap (no digital channel) | Q1 |
| Primary audience | Broader public beyond the existing community, not just members | Q2 |
| Success metric | ~25% of a 300-1000 person community using the app in the first year | Q3, Q3a |
| Initiative trigger | Personal initiative by the builder, as a contribution to the temple | Q4 |
| Access model | Public: feed, PDF library. Signed-in required: admin, donations, suggestions | Q4a |
| Stakeholders | The builder (decision-maker) and trustees (informal influencers) | Q5, Q6 |
| Communication cadence | Informal — shown to trustees when ready, no set schedule | Q7 |
| Scope confirmation | The 25-step plan as proposed | Q8 |

## Feasibility & Constraints

| Decision | Chosen | Source |
|---|---|---|
| Existing systems | None — greenfield, nothing to migrate | Q1 |
| Legal entity | Registered trust/society, tax-exemption status unclear | Q2 |
| Donor geography | Domestic only — no FCRA exposure for this version | Q3 |
| Builder's stack familiarity | New to both Flutter and AWS Amplify Gen2 | Q4 |
| Budget/timeline | No fixed budget or deadline — self-funded, own pace | Q5 |
| Account ownership | Mixed — AWS likely personal, Razorpay likely entity-owned | Q6 |
| Overall verdict | Feasible — risk sits in organizational preconditions, not the stack | feasibility-assessment.md |

## Scope Definition & Prioritization

| Decision | Chosen | Source |
|---|---|---|
| Donation timing | Donations can wait — ship other capabilities first | Q1 |
| Donation sub-scope | One-time UPI first; recurring/Autopay follows | Q2 |
| Must-have vs. deferred | Content feed + suggestion box must-have; donations + PDF library deferred; a RAG-based AI chat idea noted for a future release, not built now | Q3 |
| Build-order heuristic | Walking-skeleton-first (no fixed deadline; reduces integration risk given the builder is new to the stack) | Q4 |
| Feed sub-scope | Donation call-outs wait for the donation feature itself | Q5 |
| PDF category structure | Fixed initial list for the later release; admin-editable categories deferred further | Q6 |

## Rough Mockups & Concept Visualization

| Decision | Chosen | Source |
|---|---|---|
| Key screens | Feed, Sign In, Submit Suggestion, My Suggestions, Account, Admin Post List (all three option sets combined) | Q1 |
| First-visit flow | Straight to the feed, no sign-in prompt | Q2 |
| Visual identity | Existing identity to use | Q3 |
| Brand specifics | Temple name Sarovar Jinalaya; theme from the temple building photo (mustard/gold-ochre, white trim, Ahimsa hand symbol); Jain Pancharangi flag's five colors as accents | Q3a |
| Accessibility approach | Standard WCAG AA baseline, no special large-text treatment | Q4 |
| Admin UI depth | Full edit and delete of existing posts, not just create | Q5 |
| Form factor | Phone-only for the first release | Q6 |

## Approval & Handoff

| Decision | Chosen | Source |
|---|---|---|
| Plan re-confirmation | Yes, still matches | Q1 |
| Risk posture | Both tracked risks (tax status, stack unfamiliarity) acceptable to carry forward | Q2 |
| Mockup sign-off | Reflects what was pictured | Q3 |
| Builder readiness | Ready to proceed into Inception | Q4 |
| Go/no-go | Go — proceed into Inception (confirmed after a full recap of all Ideation-phase decisions was reviewed on request) | Q5 |

## Assumptions & Open Questions

None beyond what is already tracked in `raid-log.md` and `constraint-register.md` from Feasibility.
