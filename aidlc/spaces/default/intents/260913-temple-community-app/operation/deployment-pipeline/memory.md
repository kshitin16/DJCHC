# Deployment Pipeline — stage diary

## Interpretations

- 2026-10-01T03:05:00Z — Did not re-ask the stage's usual questions (CI tool, environments, deploy mechanism, gates, rollback). Infrastructure Design had already decided region `ap-south-1`, Amplify Hosting branch deploys, the team.md Q8 production checklist, local app builds, Play/TestFlight distribution and the app rollback procedure. Asked only the two decisions the design had made implicitly: how many permanent environments, and how the `production` branch squares with the affirmed one-trunk rule.
- 2026-10-01T03:05:00Z — Read the Q1 and Q2 answers as interacting rather than independent. Choosing one permanent environment removes the second branch, so the one-trunk tension dissolves rather than needing a documented exception. Surfaced that interaction to the human instead of recording two separate answers that would have left a contradiction on disk.

## Deviations

- 2026-10-01T03:05:00Z — Rewrote the Infrastructure Design's `--branch production` commands as `--branch main` and its "promote to production" step as "merge to `main`" throughout the generated artefacts. The upstream design assumed two environments; the human chose one. Left the upstream file unamended — a note there would be the cleaner record, and it is listed as a deferred correction rather than silently diverging.

## Tradeoffs

- 2026-10-01T03:05:00Z — Recorded one environment as an explicitly temporary posture with a named trigger (the arrival of real users) rather than as a settled decision. The cheaper choice is right while nobody is affected by a bad deploy and wrong once somebody is, and a decision recorded without its expiry condition tends to outlive its justification.
- 2026-10-01T03:05:00Z — Stated plainly in `deployment-strategy.md` that with one environment a merge to `main` is a production deploy, and that the pre-release checklist therefore gates every merge rather than a separate promotion. That is a heavier obligation than the two-environment design assumed and is the real cost of the Q1 choice; burying it would have made the cheaper option look free.

## Open questions

- 2026-10-01T03:05:00Z — No data recovery strategy exists anywhere in the project. No DynamoDB point-in-time recovery, no S3 versioning posture, no backup. Infrastructure Design did not specify one and no stage has owned it since. For an app holding donation records and suggestion submissions this is a real gap; the natural owner is Environment Provisioning (4.2). Recorded in the rollback runbook under what it cannot do.
- 2026-10-01T03:05:00Z — Branch protection on `main` is unverified and now carries more weight than it did under the two-environment design: without it, an unblocked merge over a red CI run deploys straight to production. It is a GitHub repository setting, not assertable from the workflow file.
