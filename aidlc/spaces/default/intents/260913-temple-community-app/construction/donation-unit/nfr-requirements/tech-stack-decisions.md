# Tech Stack Decisions — donation-unit

| Choice | Selection | Rationale |
|---|---|---|
| Payment aggregator | UPI aggregator with Autopay support (e.g. Razorpay) — account not yet set up | Fixed project constraint (requirements.md FR5.1/FR5.2); exact aggregator remains an open item per contract-summary.md's Open Questions |
| Webhook idempotency mechanism | DynamoDB conditional write (Q2) | Enforces BR5.5 atomically; avoids the read-then-write race a separate existence-check would leave open |
| Alerting channel | AWS SNS (or equivalent email notification) for reconciliation failures (Q3) | Lightweight, no new infrastructure beyond what Amplify Gen2/Lambda already provides; matches this project's low-ops-overhead posture |
| Client SDK | `amplify_api` (GraphQL) via `services/donation_service.dart` | Matches team.md's firm layer-boundary rule; only this file may call Amplify directly for this Unit |

No new technology beyond what Domain Design/Contract Design already fixed — this stage sets concrete NFR targets and the idempotency/alerting mechanism against that already-chosen stack.
