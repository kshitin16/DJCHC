# Security Design — feed-unit

## Authorization architecture (NFR4.1's public-read boundary, NFR6.1's process rule)

```
listPosts: no auth required — a public AppSync query (Contract 3), matching FR2.6/BR2.4.
listAllPostsForAdmin/getPost/createPost/updatePost/deletePost: resolver-level check against
  cognito:groups (Contract 2), same mechanism auth-unit's NFR Design already established —
  no new authorization mechanism designed here, this Unit consumes AuthUnit's existing one.
```

## Data protection (NFR4.1)

```
Post content (title, description, dateTime, type) is Public — no encryption-at-rest
  decision beyond DynamoDB's own managed default (AES-256), no field-level encryption
  needed for public data. createdByGoogleId is the one field with a personal-data
  character; it inherits the same DynamoDB-managed encryption, no separate design.
Encryption in transit: TLS 1.2+ on the AppSync endpoint, no custom configuration.
```

## Contract 8 event integrity (Streams-to-Lambda boundary)

```
FeedUnit's design responsibility for Contract 8 is enabling DynamoDB Streams on the Post
  table with StreamViewType: NEW_AND_OLD_IMAGES (Q2, corrected at this stage's review,
  R-02) — NOT the plain NEW_IMAGE default. This is load-bearing: Contract 8's own
  PostDeleted semantics (defined by FeedUnit's Functional Design, contract-summary.md's
  amendment) require detecting deletedAt transitioning from absent/null to a real
  timestamp inside a MODIFY record — a diff only possible when the stream carries the OLD
  image alongside the NEW one. Choosing the default NEW_IMAGE-only view type would make
  PostDeleted structurally undetectable by any consumer, since there would be no prior
  value to compare against. This is FeedUnit's own commitment to make (it owns the table
  and the Streams configuration), not a detail ReminderUnit's infrastructure can compensate
  for on the consuming side.

  Beyond the view-type setting, the stream itself is AWS-managed and encrypted at rest/in
  transit by default; no additional integrity mechanism (e.g. message signing) is needed
  since this is an internal, same-account, same-region AWS-to-AWS data flow, not a boundary
  crossing a trust domain.
```

## Process controls (NFR6.1)

```
Access-boundary rule: only services/feed_service.dart may call package:amplify_* for this
  Unit's client-side operations — a code-organization convention, not an infrastructure
  design decision.
Change-review trigger: any change to feed_service.dart or the Admin-group authorization
  check (BR2.3) gets a brief self-review before merging — a process control, not something
  this design stage architects further.
```
