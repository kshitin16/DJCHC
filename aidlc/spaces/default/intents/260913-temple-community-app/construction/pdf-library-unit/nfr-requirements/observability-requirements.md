# Observability Requirements — pdf-library-unit

> Unit-local IDs (`NFR-OBS.x`) — no inception-level observability NFR exists to derive these from; see traceability.json.

## NFR-OBS.1 — Metrics

- **Application metrics**: listDocuments/download-URL call count and latency, upload/delete success and failure counts
- **Business metric**: document count per category over time
- **Retention**: standard CloudWatch defaults

## NFR-OBS.2 — Logging

| Log Level | Event | Retention |
|---|---|---|
| INFO | Document uploaded/deleted (which admin, which document id/category) | 30 days |
| WARN | Non-admin attempting upload/delete (BR6.3 refusal); confirmDocumentUpload rejecting a non-PDF object | 30 days |
| ERROR | The recoverable BR6.4 failure state (S3 removed, record removal failed) — worth an ERROR-level line even without a paging alert, since it flags a state that needs a retry | 90 days |

No log line records a pre-signed URL itself (upload or download) — logging the URL would defeat its own short-expiration security posture (NFR-SEC.1) by creating a longer-lived, searchable copy of a time-limited credential.

> **Amended 2026-10-01 at Observability Setup.** CloudWatch Logs sets retention
> per log GROUP, not per log level, so the per-level split above cannot be
> configured as written. Resolved at that stage (Q2): **30 days on every log
> group except `donation-webhook` and `donation-reconciler`, which are 90 days.**
> ERROR lines outside the two donation functions are therefore retained 30 days
> rather than 90 — a deliberate narrowing chosen with the trade-off visible, and
> one that reduces how long personal data in log context survives
> (`environment-provisioning/validation-report.md` check C-5). The per-level
> table above remains the record of what was originally asked for. See
> `operation/observability-setup/log-queries.md`.

## NFR-OBS.3 — Tracing

Not applicable at this app's scale — each request path (browse, download-URL issuance, upload, delete) is a single hop to DynamoDB and/or S3.

## NFR-OBS.4 — Alerting

None configured (Q4, confirmed) — consistent with feed-unit's posture. The one deliberate exception in this project remains donation-unit's reconciliation-failure alert, which does not apply here.
