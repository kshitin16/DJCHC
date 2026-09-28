# Business Rules — pdf-library-unit

```yaml
rules:
  - id: BR6.1
    statement: A document's category must be one of the three fixed values (DAILY_POOJAN, VARIOUS_VIDHAANS, BHAKTAMAR).
    category: validation
    applies_to: Upload Document workflow
    trigger: A document is uploaded
    logic: IF category is not one of the declared values THEN reject.
    violation_behaviour: An unrecognized category value is rejected before the document is saved.
    source: FR6.2, Functional Design Q1

  - id: BR6.2
    statement: >
      An uploaded file must be a PDF; there is no file-size limit beyond
      what S3/Amplify naturally supports. Because the file transits
      directly to S3 via a pre-signed URL (not through this Unit's API),
      the PDF check happens at confirmDocumentUpload time, once the bytes
      already exist in S3 — not earlier.
    category: validation
    applies_to: Upload Document workflow (confirmDocumentUpload step)
    trigger: An admin calls confirmDocumentUpload after their client has finished uploading to the pre-signed URL
    logic: IF the uploaded S3 object's content type is PDF THEN create the Document record; ELSE reject and delete the non-PDF object from S3.
    violation_behaviour: A non-PDF object is removed from S3 and no Document record is created.
    source: Functional Design Q2

  - id: BR6.3
    statement: Only an identity in the Admin group (Contract 2) may upload or delete a document.
    category: authorization
    applies_to: Upload/delete Document workflow
    trigger: An upload or delete operation is attempted
    logic: IF the caller's cognito:groups claim contains "Admin" THEN allow; ELSE refuse.
    violation_behaviour: A non-admin attempting either operation is refused.
    source: FR6.2 ("admins add documents within those categories" — the requirement that actually states admin-only upload; FR6.1 covers public browsing only)

  - id: BR6.4
    statement: >
      Deleting a document is a hard delete — both the Document record and
      its S3 file are removed; nothing is retained. The S3 file is removed
      FIRST; the Document record is removed only after the S3 removal
      succeeds. If the record-removal step then fails, the (now file-less)
      record is retried on a later attempt rather than left as a
      permanently orphaned reference to a file that no longer exists.
    category: policy
    applies_to: Delete Document workflow
    trigger: An admin deletes a document
    logic: >
      IF an admin deletes a document THEN remove the S3 object; IF that
      succeeds THEN remove the Document record; IF the record removal
      fails THEN the record remains (now pointing at a nonexistent S3
      object) and is retried, not silently abandoned.
    violation_behaviour: >
      N/A — this rule defines delete semantics. The only failure state
      this ordering can produce is a record with no file, which is a
      known, retryable state — never a file with no record (the reverse,
      undetectable orphan) or a permanently stuck deletion.
    source: Functional Design Q3

  - id: BR6.5
    statement: The library is publicly browsable by category, and individual documents are publicly downloadable, without signing in.
    category: authorization
    applies_to: Browse/download Document workflow
    trigger: Any reader (signed in or not) browses or downloads
    logic: IF a document exists (has not been hard-deleted) THEN it is visible and downloadable to any reader.
    violation_behaviour: N/A — this rule states the public-read default; no violation condition applies to a read-only public operation.
    source: FR6.1, `intent-statement.md` (feed/PDF library public access model)
```

## Summary

| Rule | Category | What it governs |
|---|---|---|
| BR6.1 | Validation | Category must be one of the three fixed values |
| BR6.2 | Validation | Upload must be a PDF, no size limit |
| BR6.3 | Authorization | Only admins can upload/delete |
| BR6.4 | Policy | Delete is hard — record and S3 file both removed |
| BR6.5 | Authorization | Public browse/download, no sign-in required |
