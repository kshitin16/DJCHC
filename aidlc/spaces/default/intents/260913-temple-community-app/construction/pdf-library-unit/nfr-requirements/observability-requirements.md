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

## NFR-OBS.3 — Tracing

Not applicable at this app's scale — each request path (browse, download-URL issuance, upload, delete) is a single hop to DynamoDB and/or S3.

## NFR-OBS.4 — Alerting

None configured (Q4, confirmed) — consistent with feed-unit's posture. The one deliberate exception in this project remains donation-unit's reconciliation-failure alert, which does not apply here.
