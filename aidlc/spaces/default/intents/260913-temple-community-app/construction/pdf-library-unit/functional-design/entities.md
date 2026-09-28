# Entity Model — pdf-library-unit

```yaml
entities:
  - name: Document
    description: A single PDF religious text, browsable by category.
    identifier: id
    attributes:
      - name: id
        type: UUID
        required: true
        unique: true
        description: Matches Contract 6's `id: ID!` field exactly (Amplify Data's default primary-key name); named `id`, not `documentId`, to avoid a silent rename against the shared GraphQL contract.
      - name: title
        type: string
        required: true
      - name: category
        type: enum
        required: true
        allowed_values: [DAILY_POOJAN, VARIOUS_VIDHAANS, BHAKTAMAR]
        description: Fixed initial category list (Q1); not admin-editable in this release (FR6.2)
      - name: s3Key
        type: string
        required: true
        description: Reference to the PDF file in S3; the file itself, not modeled as a separate entity
      - name: uploadedByGoogleId
        type: string
        required: true
        description: The Cognito identity (sub) of the uploading admin, from Contract 1
      - name: uploadedAt
        type: datetime
        required: true
    entity_constraints:
      - >
        The uploaded file must be a PDF, validated once the bytes exist
        in S3 (at confirmDocumentUpload time), since the file transits
        directly to S3 via a pre-signed URL and never through this
        Unit's own API — not expressible in the entity shape itself
      - No file-size limit beyond what S3/Amplify naturally supports (Q2), since the file never transits this Unit's API payload
    relationships: []
```

## Summary

PdfLibraryUnit owns exactly one entity, `Document`. Its identifier is `id`, matching Contract 6's `id: ID!` exactly. `category` is modeled as an enum with the three confirmed starting values (Q1) rather than free text, since the category list is fixed for this release (FR6.2) — this refines Contract 6's original free-text `category: String!` into a proper `DocumentCategory` enum, amended in `contract-summary.md` alongside this design pass.

Unlike FeedUnit's soft-delete approach, deletion here is a hard delete (Q3) — there is no `deletedAt` field; a deleted `Document` record and its S3 file are both removed.
