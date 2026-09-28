# Infrastructure Design — Questions (donation-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/donation-unit/nfr-design/*.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/donation-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contract 5, Contract 7)

Region (`ap-south-1`) and the Amplify Hosting git-branch environment model are already fixed project-wide (auth-unit's Infrastructure Design) and carry forward unchanged — not re-asked here. NFR Design already chose the Lambda Function URL webhook receiver, the ~1-minute EventBridge Scheduler reconciliation poller, and the SNS+email alerting mechanism (Q1-Q3); this stage's job is the concrete AWS-resource specifics those decisions still leave open.

## Q1. Payment aggregator account and secrets: Contract 7's own payload shape is explicitly a placeholder "based on typical UPI aggregator webhook conventions (e.g. Razorpay); refine once the real aggregator account... exist[s]" — no real account has been set up yet. How should this design handle the not-yet-chosen aggregator, and how should its credentials be separated across environments?

- A. Design against a Razorpay-compatible shape (already Contract 7's own assumption) without committing to the final commercial account here — actual account creation/KYC is an Environment Provisioning concern, not a design-stage decision. Each environment (staging, production) gets its own Secrets Manager secret pair (API key + webhook signing secret) — staging using the aggregator's TEST-mode credentials, production using LIVE-mode credentials — so a staging deploy can never accidentally move real money or receive real webhooks. `ampx sandbox` local dev uses the same TEST-mode credentials as staging (shared, since local dev never goes live either). (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Razorpay-compatible placeholder, per-environment test/live secrets.

## Q2. Reconciliation-failure alert recipient: NFR Design chose an SNS topic + email subscription for reconciliation-failure alerts (a Donation stuck unresolved after the scheduled poller exhausts). What email address should the subscription point to?

- A. The builder's own primary email (the account used to manage this AWS project) — configured once via SNS subscription confirmation (a one-time "click to confirm" email), not something this design stage hardcodes into any committed file (the subscription is an Infrastructure Provisioning action, not a value baked into source). This document names WHO gets it, not the literal address, to avoid committing a personal email address to the repository.
- B. A different recipient — specify who (still described by role, not a literal address, for the same reason)
- X. Other (please specify)

[Answer]: A. The builder's own primary email.

## Consolidated Summary Confirmation

- Payment aggregator: designed against a Razorpay-compatible shape (Contract 7's own placeholder assumption); real account setup deferred to Environment Provisioning. Per-environment Secrets Manager credentials — TEST-mode for staging/local, LIVE-mode for production only.
- Reconciliation-failure alerts: SNS + email subscription, recipient named by role (the builder) in this design, not committed as a literal address anywhere.
- Region and environment strategy inherited unchanged from auth-unit's Infrastructure Design (ap-south-1, Amplify Hosting git-branch model).

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
