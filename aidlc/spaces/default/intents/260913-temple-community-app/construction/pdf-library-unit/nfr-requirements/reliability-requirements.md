# Reliability Requirements — pdf-library-unit

## NFR2.1 — Availability (inherits inception NFR2)

```
SLI: successful browse/download/upload/delete operations / total attempts
SLO: best-effort, matching Amplify/AWS managed-service availability (S3, DynamoDB, AppSync) — no
independent SLA (NFR2), consistent with the rest of this project's posture.
```

## NFR2.2 — Fault tolerance

| Failure | Behavior |
|---|---|
| listDocuments/getDocumentDownloadUrl fails | Plain-language error with retry (existing error path) |
| Direct-to-S3 upload fails mid-transfer | Admin's client retries against the same pre-signed URL, or requests a new one if the 15-minute window (NFR-SEC.1.1) expired; no Document record exists yet, so nothing is left partially created |
| confirmDocumentUpload finds a non-PDF object | Object deleted from S3, no Document record created (BR6.2) — a clean, complete rejection, not a partial state |
| Delete: S3 removal fails | Document record untouched, operation reported failed, retry from the start (existing error path) |
| Delete: S3 removal succeeds but record removal fails | The one accepted recoverable failure state (BR6.4) — record remains pointing at a now-missing file; retrying the delete resolves it (the S3 removal step becomes a no-op, then the record is removed) |

## NFR2.3 — Data durability

S3 provides 99.999999999% (11 nines) object durability by default — well beyond anything this Unit's own design needs to add. DynamoDB (Document metadata) uses AWS's standard managed replication plus NFR4's encryption-at-rest. No Unit-specific backup procedure is needed beyond these managed defaults at this project's scale.

## NFR2.4 — Disaster recovery

No RTO/RPO target beyond the project-wide posture (deferred to Infrastructure Design's region choice). Since BR6.4's hard delete is irreversible by design (no soft-delete, no recycle bin), S3 Versioning is worth considering at Infrastructure Design time as a safety net against an accidental admin delete — noted here as a recommendation for that stage, not decided now.
