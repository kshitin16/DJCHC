/// Contract 3 GraphQL documents, hand-written from `amplify/data/resource.ts`.
///
/// No model codegen is used (code-generation-plan.md rule 2), so these strings
/// ARE the contract. The selection set is exactly Contract 3's fields — the
/// model's `deletedAt` soft-delete marker is deliberately not selected (it is
/// null on every post any query returns).
///
/// The input type names are `CreatePost` / `UpdatePost`: those are the keys
/// `a.customType(...)` is declared under in the schema, and Amplify names the
/// generated GraphQL input types after them verbatim.
library;

/// Contract 3 `Post` selection set, shared by every operation that returns one.
const String postFields = '''
    id
    type
    title
    description
    dateTime
    createdByGoogleId
    createdAt
    updatedAt''';

/// `listPosts` — the public, age-out-filtered feed (BR2.4, BR2.6; FR1.3).
const String listPostsDocument =
    '''
query ListPosts {
  listPosts {
$postFields
  }
}''';

/// `listAllPostsForAdmin` — every non-deleted post including aged-out ones
/// (BR2.3, BR2.7). Admin-only, enforced by `allow.group('Admin')`.
const String listAllPostsForAdminDocument =
    '''
query ListAllPostsForAdmin {
  listAllPostsForAdmin {
$postFields
  }
}''';

/// `getPost(id)` — loads one post for the admin edit form, aged out or not.
/// Returns `Post` (nullable in the schema).
const String getPostDocument =
    '''
query GetPost(\$id: ID!) {
  getPost(id: \$id) {
$postFields
  }
}''';

/// `createPost(input: CreatePost!)`.
const String createPostDocument =
    '''
mutation CreatePost(\$input: CreatePost!) {
  createPost(input: \$input) {
$postFields
  }
}''';

/// `updatePost(id: ID!, input: UpdatePost!)` — every input field is optional;
/// only the ones the admin actually changed are sent.
const String updatePostDocument =
    '''
mutation UpdatePost(\$id: ID!, \$input: UpdatePost!) {
  updatePost(id: \$id, input: \$input) {
$postFields
  }
}''';

/// `deletePost(id)` — the soft delete (BR2.6); returns the deleted post.
const String deletePostDocument =
    '''
mutation DeletePost(\$id: ID!) {
  deletePost(id: \$id) {
$postFields
  }
}''';
