/// Contract 6 GraphQL documents, hand-written from `amplify/data/resource.ts`.
library;

/// Contract 6 `Document` selection set.
const String documentFields = '''
    id
    title
    category
    s3Key
    uploadedByGoogleId
    uploadedAt''';

/// `listDocuments(category)` — public read (BR6.5); `category` is optional and
/// omitting it lists every category.
const String listDocumentsDocument =
    '''
query ListDocuments(\$category: DocumentCategory) {
  listDocuments(category: \$category) {
$documentFields
  }
}''';

/// `getDocumentDownloadUrl(id)` — public read returning a pre-signed URL
/// STRING (`AWSURL!`), not an object. Opened externally by the device's
/// browser/PDF viewer.
const String getDocumentDownloadUrlDocument = '''
query GetDocumentDownloadUrl(\$id: ID!) {
  getDocumentDownloadUrl(id: \$id)
}''';

/// `createDocumentUploadUrl(title, category)` — admin-only; step 1 of BR6.2's
/// two-step upload. Returns the pre-signed PUT target.
const String createDocumentUploadUrlDocument = '''
mutation CreateDocumentUploadUrl(
  \$title: String!
  \$category: DocumentCategory!
) {
  createDocumentUploadUrl(title: \$title, category: \$category) {
    uploadUrl
    s3Key
  }
}''';

/// `confirmDocumentUpload(s3Key, title, category)` — admin-only; step 2 of
/// BR6.2, run after the bytes are PUT to the pre-signed URL. The server
/// verifies the object really is a PDF and removes it if not.
///
/// NOTE: `functional-spec.md` writes this as `confirmDocumentUpload(s3Key)`,
/// but the built schema takes all three arguments, so the client re-supplies
/// `title` and `category` here. The built schema is authoritative.
const String confirmDocumentUploadDocument =
    '''
mutation ConfirmDocumentUpload(
  \$s3Key: String!
  \$title: String!
  \$category: DocumentCategory!
) {
  confirmDocumentUpload(s3Key: \$s3Key, title: \$title, category: \$category) {
$documentFields
  }
}''';

/// `deleteDocument(id)` — admin-only; returns the deleted document's `ID!`
/// (a bare string), not a Document object.
const String deleteDocumentDocument = '''
mutation DeleteDocument(\$id: ID!) {
  deleteDocument(id: \$id)
}''';
