# Environment Provisioning — stage diary

## Interpretations

- 2026-10-01T04:10:00Z — Read Q3's answer ("Can I do #1 and #2 both") as a union of the two budget options rather than forcing a single pick, per the project's recorded practice for multi-option answers. The human's stated reason — personally funding the project as philanthropy, with no expectation that the temple committee pays — was treated as a requirement that reshapes the section, not as background: the cost-guardrail specification was expanded beyond what the question offered (anomaly detection, an action-enabled budget, log retention, a named list of realistic runaway causes).
- 2026-10-01T04:10:00Z — Adopted the DevSecOps and compliance perspectives inline rather than dispatching them, per the project's recorded practice for inline stages with support agents.

## Deviations

- 2026-10-01T04:10:00Z — Could not execute Step 3 (provision and validate): no AWS credentials exist on the machine (no `~/.aws`, no `AWS_ACCESS_KEY_ID`/`AWS_PROFILE`, no AWS CLI). Delivered the inventory and the full validation checklist with every row marked `Not run` and the command that settles it, rather than deferring the stage or marking unexecuted checks as passing.
- 2026-10-01T04:10:00Z — Asked one follow-up question not in the original batch (an action-enabled budget), after the human disclosed they fund the project personally. The original options offered alert-only guardrails; a free hard cap was materially better for their situation and withholding it because it was not in the pre-written batch would have served the batch rather than the human.

## Tradeoffs

- 2026-10-01T04:10:00Z — Specified the action-enabled budget as scoped to block new resource creation only, never to cut off AppSync or DynamoDB, and recorded a check (B-5) requiring the policy scope to be verified before arming it. A cost guardrail that takes the temple's app offline to save a small sum inverts the priority it exists to protect.
- 2026-10-01T04:10:00Z — Verified the inventory against `amplify/**/resource.ts` rather than trusting the upstream infrastructure-design documents, which turned up four corrections, three of them a cost claim in the builder's favour.

## Open questions

- 2026-10-01T04:10:00Z — No personal-data deletion path exists anywhere in the system (validation-report C-6). India's DPDP Act 2023 gives data principals a right to erasure, and personal data sits across `Donation`, `Reminder`, `DeviceToken`, `Suggestion` and `SuggestionDailyCount`. This is an unbuilt feature, not a provisioning setting, and donation records may carry a retention obligation that conflicts with a deletion request. Recorded as an open gap owned by no stage.
- 2026-10-01T04:10:00Z — The `Admin` group boundary (validation-report S-7) has still never been proven. `team.md` records the deliberate choice to hold the walking skeleton to a smoke-level check here; a live environment is the first place a real pass/fail assertion is possible.
