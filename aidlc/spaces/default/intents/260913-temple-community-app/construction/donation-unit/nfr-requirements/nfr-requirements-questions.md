# NFR Requirements — Questions (donation-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/donation-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/donation-unit/functional-design/rules.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md` (NFR1-NFR8)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 5, 7)

This is the one Unit in this project directly touching money, so its NFRs get more scrutiny than auth-unit's did — a reconciliation failure or a missed webhook has real financial consequences, unlike a stale admin-group claim.

## Q1. BR5.4 requires checking the aggregator's own record on a timeout rather than assuming an outcome. How long should a Donation sit in PENDING before this project considers it "timed out" and triggers that check?

- A. 5 minutes — long enough for a normal UPI confirmation round-trip (typically seconds to low minutes) without falsely triggering on a merely-slow-but-still-in-flight payment. (Recommended)
- B. A different window — specify
- X. Other (please specify)

[Answer]: A. 5 minutes.

## Q2. BR5.5's idempotent webhook handling: how should "already processed this payment_id" actually be enforced under concurrent/duplicate delivery?

- A. Atomic conditional write — the Lambda/resolver handling the webhook writes the Donation's status update with a DynamoDB conditional expression keyed on payment_id (e.g. "only apply if this payment_id hasn't been recorded yet"), so two near-simultaneous deliveries can't both apply the update. This project's own established practice (learned earlier this Construction phase) is to use an atomic conditional write rather than a separate read-then-write check for exactly this class of problem. (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Atomic conditional write.

## Q3. Alerting: since this Unit is the one place real money is at stake, should a reconciliation failure (aggregator record doesn't resolve to a clear SUCCEEDED/FAILED even after the timeout check) trigger an actual alert to the builder, rather than the no-alerting-at-all posture used for the lower-stakes auth-unit?

- A. Yes — a Donation stuck unresolved past the timeout check is unusual enough and financially relevant enough to warrant a real alert (e.g. an email/SNS notification to the builder), even though this is a solo-run app with no on-call rotation. (Recommended)
- B. No alerting — same best-effort posture as the rest of the app; the builder will notice via normal use.
- X. Other (please specify)

[Answer]: A. Yes, alert on reconciliation failure.

## Q4. PCI-DSS scope: BR5.1/NFR3 already establish that raw payment details never touch this app — everything routes through the aggregator's tokenized flow. Confirm this scope-reduction reasoning (per compliance guidance: if you never touch raw card/UPI credential data, most PCI-DSS requirements do not apply) as this Unit's compliance posture, with no additional PCI-specific control work beyond what BR5.1 already requires?

- A. Confirmed — tokenization-based scope reduction means no additional PCI-DSS control work is needed for this Unit beyond BR5.1's existing constraint; this project relies entirely on the aggregator's own PCI compliance for anything touching raw card/UPI data. (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Confirmed.

## Consolidated Summary Confirmation

- A Donation sitting in PENDING for 5 minutes triggers BR5.4's timeout-driven aggregator-record check.
- BR5.5's idempotent webhook handling is enforced via an atomic DynamoDB conditional write keyed on payment_id, not a read-then-write check.
- A reconciliation failure (unresolved past the timeout check) triggers a real alert to the builder — the one exception to this project's otherwise no-alerting posture, justified by this Unit being where real money is at stake.
- PCI-DSS scope is reduced to near-zero via tokenization (BR5.1); no additional compliance control work is added at this stage beyond what BR5.1 already requires.
- Performance/scalability/reliability targets otherwise follow guide defaults appropriate to this app's low-traffic, best-effort posture, consistent with auth-unit's NFR pass.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
