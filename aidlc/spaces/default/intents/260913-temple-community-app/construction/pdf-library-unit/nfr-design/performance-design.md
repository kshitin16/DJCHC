# Performance Design — pdf-library-unit

## Design for NFR-PERF.1 (Browse/List Documents, <2s p95)

```
Path: AppSync query (listDocuments) -> DynamoDB query, optionally filtered by category ->
  return. No caching layer (consistent with feed-unit's own no-caching decision at this
  app's scale) — direct query meets the target at this Unit's low document count
  (~20-75 documents projected).
```

## Design for NFR-PERF.2 (Download URL issuance, <1s p95)

```
Path: AppSync query (getDocumentDownloadUrl) -> S3 SDK call to generate a pre-signed GET
  URL (no network round-trip to S3 itself, just local SDK signing) -> return. This is a
  fast, local cryptographic operation, not a call to S3 — no further design needed.
```

## Design for NFR-PERF.3 (Upload latency, <1s per call for createDocumentUploadUrl/confirmDocumentUpload)

```
createDocumentUploadUrl: same local SDK pre-signed-URL-generation pattern as downloads —
  fast, no S3 round trip.
confirmDocumentUpload: one S3 HeadObject/GetObject call (to verify PDF content-type) plus
  one DynamoDB write — the dominant cost is the S3 metadata check, still well under 1s for
  a single object.
The actual file transfer (up to 50MB) happens directly between the admin's client and S3,
  entirely outside this Unit's own API latency budget (per BR6.2's design).
```

## CDN decision (Q2)

No CloudFront — direct S3 pre-signed URLs are sufficient at this app's download volume; a CDN would add cache-invalidation complexity for a pre-signed-URL origin (the signature itself expires, so caching the URL response has limited value) without a corresponding performance benefit at this scale.
