# Environment Provisioning — Questions

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`; Depth: Standard.
- Consumed: every unit's `infrastructure-design/infrastructure-specification.md`; `operation/deployment-pipeline/cd-config.md`; `operation/deployment-pipeline/deployment-strategy.md`; `construction/*/nfr-requirements/`.
- [Q1 of deployment-pipeline] One permanent environment. [Q2 of deployment-pipeline] No deploy branch.
- Rules: project.md § Mandated (encryption of personal data at rest and in transit); org.md § Deployment; team.md § Deployment Q8.

## Provisioning status

**No AWS credentials are available on this machine** — there is no `~/.aws`
directory, no `AWS_ACCESS_KEY_ID` or `AWS_PROFILE` in the environment, and the AWS
CLI is not installed. Step 3 of this stage (provision and validate) therefore
cannot execute here.

What this stage delivers instead: the full inventory of what must exist, every
validation check written out with the command that settles it, and the decisions
below recorded so that provisioning is a matter of running the steps rather than
re-deciding. Every check is marked `Not provisioned`, never `Pass`.

## Q1. Data protection — point-in-time recovery and object versioning?

Flagged at Deployment Pipeline as a gap owned by no stage. This is that stage.

Nothing in this project currently protects data from deletion or corruption. The
rollback runbook reverts code and configuration; it cannot bring back a deleted
row. The data at stake is donation records, suggestion-box submissions, and the
user profiles behind both.

- **DynamoDB point-in-time recovery**: continuous backup, restore to any second in the last 35 days. Costs roughly the same again as table storage — on a dataset this size, cents per month.
- **S3 versioning**: keeps overwritten and deleted objects. For the PDF library this means a replaced or deleted document is recoverable. Costs storage for the old versions; a lifecycle rule expiring noncurrent versions after 30-90 days bounds it.

- A. Both — PITR on every table, versioning on the bucket with a lifecycle rule expiring noncurrent versions after 90 days
- B. PITR only — the tables hold the irreplaceable data; a PDF can be re-uploaded from the original
- C. Neither for now — accept that deleted or corrupted data is gone, and revisit before real donation records exist
- X. Other (please specify)

[Answer]: A

## Q2. Encryption keys — AWS-managed or customer-managed?

`project.md` Mandates: *"ALWAYS encrypt personal data collected by the app (names,
emails, donation records, suggestion-box submissions) both at rest and in
transit."*

In transit is settled: everything is HTTPS/TLS, nothing optional about it. At rest
is the open question, and both options below do encrypt at rest — the difference is
who controls the key.

- **AWS-managed keys** (the default): DynamoDB, S3 and Secrets Manager all encrypt at rest with AWS-owned or AWS-managed keys automatically, at no cost. The data is encrypted; AWS manages rotation; key use does not appear separately in CloudTrail.
- **Customer-managed KMS key**: you control rotation and can revoke it, and every use is logged in CloudTrail. Costs about $1 per key per month plus request charges, and a key deleted by mistake makes the data permanently unreadable.

For a community temple app with no regulatory audit obligation, AWS-managed keys
satisfy the Mandate as written. A customer-managed key buys key-level audit and
control that nothing currently asks for.

- A. AWS-managed keys — free, satisfies the Mandate, nothing to operate
- B. Customer-managed KMS key for the tables and bucket — key rotation control and CloudTrail key-use audit, ~$1/month/key plus requests
- X. Other (please specify)

[Answer]: A

## Q3. Cost guardrail — a billing alarm?

There is currently nothing that would tell you if AWS spend rose unexpectedly. The
realistic causes here are not attacks: a Lambda retry loop, a DynamoDB scan over a
grown table, or an EventBridge schedule firing more often than intended. Any of
those can run for a month before a bill arrives.

AWS Budgets gives one free budget with email alerts.

- A. A monthly budget with alerts at 80% and 100% of a threshold you name
- B. A budget at a low fixed threshold (for example $20/month) that should never be reached in normal operation, purely as a tripwire
- C. No budget — check the console periodically instead
- X. Other (please specify)

[Answer]: A and B both — the builder funds this personally as philanthropy and is not asking the temple committee to pay, so additional cost guardrails are wanted. Union: a low fixed tripwire AND a monthly budget at 80%/100%, plus Cost Anomaly Detection. Alert-only budgets are free of charge. Follow-up Q3b: an action-enabled budget is also wanted (free for the first two) — a deny policy applied automatically at a threshold, so spend is capped rather than only reported.

## Consolidated Summary Confirmation

- Looks correct
- Request changes

[Answer]: Looks correct
