# NFR Requirements — Questions (feed-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/feed-unit/functional-design/functional-spec.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/construction/feed-unit/functional-design/rules.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md` (NFR1-NFR8; NFR1 is specifically about this Unit's `listPosts` path)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contracts 2, 3, 8)

## Q1. NFR1 says "the feed shows content within 2 seconds on a typical mobile connection" but doesn't pin down what load or data-volume assumption that holds under. What should "typical mobile connection" and the request's data-volume assumption concretely mean for this Unit's `listPosts` query?

- A. A 4G/LTE-equivalent connection (roughly 5-10 Mbps, 50-150ms latency), with the feed holding up to ~200 non-aged-out posts at any time (a generous ceiling for a single temple's admin-posted content) — the 2-second budget covers the full round trip: query, BR2.4's filter, and render. (Recommended)
- B. A different connection/volume assumption — specify
- X. Other (please specify)

[Answer]: A. 4G/LTE-equivalent, up to ~200 posts.

## Q2. Contract 8's DynamoDB Streams event source (feeding ReminderUnit) has a fixed 24-hour retention window by default before AWS drops undelivered records. Does this Unit need to do anything about that at the NFR-requirements level, or is it purely an Infrastructure Design concern?

- A. Purely Infrastructure Design's concern — this Unit's NFR posture is simply "emit the change; the stream's own retention/retry behavior is a deployment-time configuration, not a FeedUnit business requirement." Note it here as an awareness flag for Infrastructure Design, not a target this Unit's own NFRs need to satisfy. (Recommended)
- B. Something different — specify
- X. Other (please specify)

[Answer]: A. Purely Infrastructure Design's concern.

## Q3. Observability for admin content mutations (create/edit/delete a post): given these are public-facing content changes (unlike auth-unit's low-stakes sign-in events), should they get any special logging/alerting treatment beyond this project's standard best-effort posture?

- A. Standard logging only (who/when/what changed, at INFO level) — no special alerting. A wrong or embarrassing post is not the kind of failure an automated alert should page for; the admin (the builder) notices immediately since they're the one posting it. (Recommended)
- B. Add alerting for admin mutation failures too, similar to donation-unit's reconciliation alert.
- X. Other (please specify)

[Answer]: A. Standard logging only.

## Consolidated Summary Confirmation

- NFR1's "typical mobile connection" is defined as 4G/LTE-equivalent (~5-10 Mbps, 50-150ms latency), with the feed holding up to ~200 non-aged-out posts; the 2-second budget covers the full listPosts round trip including BR2.4's filter.
- Contract 8's DynamoDB Streams 24-hour retention window is flagged as an Infrastructure Design awareness item, not a FeedUnit-owned NFR target.
- Admin content mutations get standard logging (who/when/what), no special alerting — unlike donation-unit, a bad post is not a financial-severity failure.
- Scalability/reliability targets otherwise follow guide defaults appropriate to this app's low-traffic, best-effort posture, consistent with auth-unit's and donation-unit's NFR passes.

Does this all look correct before I generate the artifacts?

- Looks correct
- Request changes

[Answer]: Looks correct
