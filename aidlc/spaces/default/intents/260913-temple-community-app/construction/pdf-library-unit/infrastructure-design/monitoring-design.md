# Monitoring Design — pdf-library-unit

Implements NFR Design's observability-design.md (standard AppSync CloudWatch metrics, custom document-count metric, structured logging) at the AWS platform level.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| AppSync resolver call count/latency/error rate (all five operations) | Standard AppSync CloudWatch metrics | None configured (no alerting, per NFR-OBS.4) | Baseline health of the Library API surface. |
| Document Lambda invocation count/duration/error rate (corrected at this stage's review, R-01/R-02 — this Unit's one Lambda, backing four of the five operations: `getDocumentDownloadUrl`, `createDocumentUploadUrl`, `confirmDocumentUpload`, `deleteDocument`) | Standard Lambda CloudWatch metrics | None configured | Baseline health of the signing/verification/deletion compute. Only `listDocuments` remains a plain direct resolver. |
| `document-count-by-category` | Custom CloudWatch metric, emitted from `confirmDocumentUpload` (increment)/`deleteDocument` (decrement), tagged by category | None | The business metric NFR Design established, distinct from resolver call-count metrics. |
| S3 bucket size / object count | S3's own CloudWatch storage metrics (daily) | None | Passive visibility into library growth; no capacity action needed since S3 is effectively unlimited. |

## Alerts

None configured — consistent with this project's default posture.

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| N/A | No formal SLO — best-effort, matching NFR Design's reliability-design.md | N/A |

## Logs & Tracing

**Logging**: Per NFR-OBS.2's existing spec — INFO for upload/delete, WARN for non-admin attempts and non-PDF rejections, ERROR for the BR6.4 recoverable failure state (S3 removed, record-removal retry needed) — via AppSync's CloudWatch Logs integration, no separate log shipping.

**Tracing**: Not applicable (NFR-OBS.3) — each request path is a single hop to DynamoDB and/or S3.

**Dashboards**: No dedicated dashboard for this Unit.
