# Performance Requirements — pdf-library-unit

## NFR-PERF.1 — Browse/List Documents latency (Unit-local ID; no inception-level performance NFR names this Unit's request path — see traceability.json)

| Field | Value |
|---|---|
| Metric | Time from opening the library (optionally filtered by category) to seeing the document list |
| Target | < 2 seconds |
| Percentile | p95 |
| Load condition | 4G/LTE-equivalent connection, consistent with feed-unit's NFR1.1 baseline; a modest document count (tens, not thousands, of religious texts across 3 fixed categories) |
| Measurement method | Client-side timer from `listDocuments()` call to first render |

## NFR-PERF.2 — Download URL issuance latency

| Field | Value |
|---|---|
| Metric | Time from requesting a download to receiving the pre-signed S3 URL |
| Target | < 1 second |
| Percentile | p95 |
| Load condition | Normal usage |
| Measurement method | Server-side timer around `getDocumentDownloadUrl` |

Note: this target covers URL *issuance* only, not the actual PDF download/transfer time, which depends entirely on the file size (up to 50MB, Q3) and the reader's own connection — a variable outside this Unit's control, not a target this Unit's NFRs can meaningfully set.

## NFR-PERF.3 — Upload latency (admin-facing)

| Field | Value |
|---|---|
| Metric | Time for `createDocumentUploadUrl` + `confirmDocumentUpload` to each respond (excluding the direct-to-S3 transfer itself, which the admin's client performs directly) |
| Target | < 1 second per call |
| Percentile | p95 |
| Load condition | Single admin, single upload at a time |
| Measurement method | Server-side timer around each AppSync resolver |

At a 50MB working ceiling (Q3), the direct-to-S3 transfer itself is not bounded by a 2-second-class target — a 50MB upload over even a mediocre connection can reasonably take tens of seconds to minutes, which is why BR6.2's design intentionally keeps the file transfer outside this Unit's own API entirely.
