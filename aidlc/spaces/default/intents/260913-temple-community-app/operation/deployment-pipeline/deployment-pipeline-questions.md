# Deployment Pipeline — Questions

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: `construction/flutter-app-unit/infrastructure-design/cicd-pipeline.md`, every backend unit's `infrastructure-design/cicd-pipeline.md`, `construction/ci-pipeline/ci-config.md`, `construction/ci-pipeline/quality-gates.md`, `construction/build-and-test/build-and-test-summary.md`.
- Rules: org.md § Deployment and § Way of Working; team.md § Way of Working Q2 and § Deployment Q8.

Most of this stage's design already exists in Infrastructure Design and is **not
re-asked**:

- **Region** — `ap-south-1` (Mumbai), for proximity to the user base. Settled.
- **Backend deploy mechanism** — Amplify Hosting watches the branch and deploys itself; no AWS credentials in GitHub Actions. Settled, and it is why CI holds zero secrets.
- **Staging trigger** — automatic on merge, matching org.md § Deployment. Settled.
- **Production gate** — the team.md Q8 checklist (no secrets committed, Dependabot clear or triaged, AWS permission/auth changes double-checked), replacing org.md's "tech lead + product owner" which does not map to a solo builder. Settled.
- **App release** — built locally on the builder's machine, never in CI (no macOS runner, no signing secrets in Actions). Play Console internal testing → staged rollout; TestFlight → phased release. Settled.
- **App rollback** — halt the staged rollout / pause the phased release, then ship a higher build number. Neither store supports downgrading an updated device. Settled.
- **Backend rollback** — re-promote the last-known-good commit through the same manual gate; Amplify Hosting retains prior deployments per branch. Settled.

Two questions remain. Both are decisions the design made implicitly that deserve
to be explicit, because one costs money and the other sits in tension with an
affirmed rule.

## Q1. How many deployed backend environments?

Each Amplify branch environment provisions a full, separate set of AWS resources:
a Cognito User Pool, the DynamoDB tables with their indexes, the S3 bucket, every
Lambda, an AppSync API, and an EventBridge Scheduler group. The design assumes two
permanent ones (`staging` from `main`, `production`), plus ephemeral developer
sandboxes.

For a solo builder on a temple community app, the second permanent environment is
a real recurring cost with a real benefit — it is the only place a change can be
exercised against live AWS before users see it.

- A. Two permanent environments: `staging` (auto from `main`) and `production` (manual promotion) — as designed; costs roughly double the baseline AWS spend
- B. One permanent environment (`production`) plus ephemeral `ampx sandbox` per change — cheapest; every pre-release check happens in a sandbox that is torn down after
- C. Start with B and add staging later, when there are users whose experience a bad deploy would damage
- X. Other (please specify)

[Answer]: C

## Q2. A long-lived `production` branch contradicts your one-trunk rule. How should it be reconciled?

team.md § Way of Working, affirmed at practices discovery, says: *"One trunk even
as more environments are added later — gate releases via tags or
environment-specific deployment configs, not long-lived release branches."*

But the Infrastructure Design uses a permanent `production` git branch, because
that is how Amplify Hosting maps a branch to an environment.

Two honest readings. A `production` branch that only ever fast-forwards from `main`
accumulates no merge debt and is a pointer rather than a divergent line of work —
which is what the rule was actually guarding against. Or it is literally a
long-lived release branch and the rule means what it says.

- A. Keep the `production` branch, and record explicitly that it is a deploy pointer that only ever fast-forwards from `main` — never committed to directly, never merged back. The rule's intent is satisfied; its letter is given a documented exception
- B. Drop the branch and promote by tag or by Amplify's manual redeploy from a chosen `main` commit, keeping exactly one branch — closest to the affirmed rule, but a less conventional Amplify setup
- C. Amend the affirmed rule in `team.md` to allow a fast-forward-only deploy branch, so practice and rule agree going forward
- X. Other (please specify)

[Answer]: Superseded by Q1=C — with one environment there is no second branch, so no exception is needed. Recorded as reopening if staging is added later.

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
