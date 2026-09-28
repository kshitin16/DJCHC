# Observability Design — pdf-library-unit

## Metrics/logging architecture (NFR-OBS.1-2)

```
CloudWatch metrics: standard AppSync resolver built-ins (call count/latency) for
  listDocuments/getDocumentDownloadUrl/createDocumentUploadUrl/confirmDocumentUpload/
  deleteDocument.
Business metric (document count per category, per NFR-OBS.1): a custom CloudWatch metric
  emitted from confirmDocumentUpload (increment) and deleteDocument (decrement), tagged by
  category — the same "derive a real running total from the mutation resolvers, not from
  call-count built-ins" pattern feed-unit's NFR Design established for its own post-count
  metric.
Structured logging: per NFR-OBS.2's existing spec (INFO for upload/delete, WARN for
  non-admin attempts and non-PDF rejections, ERROR for the BR6.4 recoverable failure
  state) — via AppSync's CloudWatch Logs integration, no separate log shipping.
```

## Alerting (NFR-OBS.4)

None configured — consistent with this project's default posture.

## Tracing (NFR-OBS.3)

Not applicable — each request path is a single hop to DynamoDB and/or S3.
