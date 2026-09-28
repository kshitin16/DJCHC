# Functional Design — Questions (pdf-library-unit)

## Sources

- [scope] Workflow-selected scope: `temple-mobile-app`.

Consumed upstream artifacts:
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work.md` (PdfLibraryUnit definition)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/units-generation/unit-of-work-story-map.md` (FR6.1, FR6.2 assigned to this Unit)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/requirements-analysis/requirements.md`
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/domain-design/components.md` (PdfLibraryComponent, Document entity)
- `aidlc/spaces/default/intents/260913-temple-community-app/inception/contract-design/contract-summary.md` (Contract 6)

This Unit is a later release. Requirements confirmed the category list is fixed at this release's launch (not admin-editable), but the actual category names were never specified.

## Q1. What should the fixed initial set of categories actually be? The original description mentioned examples like daily poojan, vidhaans, bhaktamar, and meri bhavna — are these meant to be the categories themselves, or example documents within broader categories?

- A. Those are the categories themselves — Daily Poojan, Vidhaans, Bhaktamar, Meri Bhavna (and I'll confirm the exact final list separately if needed)
- B. Those are example documents, not categories — use broader categories instead (e.g. "Daily Prayers", "Festival Texts", "Reference") and documents are filed under them
- C. Not yet defined — pick a reasonable starting set and I'll adjust it later
- X. Other (please specify)

[Answer]: X. Other — Daily Poojan, Various Vidhaans, and Bhaktamar are the three categories to start with

## Q2. Are there any constraints on what can be uploaded — must it be a PDF specifically, and is there a file size limit?

- A. PDF only, no specific size limit beyond what S3/Amplify naturally supports
- B. PDF only, with a specific size limit (e.g. 10 MB per file)
- C. Not yet defined
- X. Other (please specify)

[Answer]: A. PDF only, no specific size limit beyond what S3/Amplify naturally supports

## Q3. Can an admin delete or replace a document once uploaded, and if deleted, should it be a hard delete or a soft delete (consistent with how FeedUnit handles post deletion)?

- A. Yes, admins can delete documents; soft delete (kept but hidden), consistent with FeedUnit
- B. Yes, admins can delete documents; hard delete (gone completely, including the S3 file)
- C. No delete capability needed for this release — documents are permanent once uploaded
- D. Not yet defined
- X. Other (please specify)

[Answer]: B. Yes, admins can delete documents; hard delete (gone completely, including the S3 file)

## Consolidated Summary Confirmation

- Fixed starting categories: Daily Poojan, Various Vidhaans, Bhaktamar.
- PDF only, no specific file size limit.
- Admins can hard-delete a document, including its S3 file.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
