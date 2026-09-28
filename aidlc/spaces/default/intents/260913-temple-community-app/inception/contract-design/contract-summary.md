# Contract Summary — Digamber Jain Temple Community App

Every inter-unit boundary from `unit-of-work-dependency.md`'s DAG, plus the one external boundary this system exposes (the donation-aggregator webhook), specified as formal contracts. [Q1]

> **Amended** — Contracts 8 and 9 added via a redo pass (backward jump from `nfr-requirements`) for the new U7 (ReminderUnit) added at Units Generation. See `contract-design-questions.md` (Calendar & Reminders addition).

## Contracts Table

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| 1 | U1 (AuthUnit) | U2, U3, U4, U5, U6 | shared-schema (Cognito ID token claim) | U1 |
| 2 | U1 (AuthUnit) | U2, U5 | shared-schema (Cognito group claim) | U1 |
| 3 | U2 (FeedUnit) | U6 | GraphQL (AppSync) | U2 |
| 4 | U3 (SuggestionUnit) | U6 | GraphQL (AppSync) | U3 |
| 5 | U4 (DonationUnit) | U6 | GraphQL (AppSync) | U4 |
| 6 | U5 (PdfLibraryUnit) | U6 | GraphQL (AppSync) + S3 pre-signed URL | U5 |
| 7 | U4 (DonationUnit) | External: UPI payment aggregator webhook caller | REST/HTTP (OpenAPI) | U4 |
| 8 | U2 (FeedUnit) | U7 (ReminderUnit) | async event (DynamoDB Streams + Lambda) | U2 |
| 9 | U7 (ReminderUnit) | U6 | GraphQL (AppSync), IAM/guest auth | U7 |

All five original in-system data/auth contracts (1-6) live inside one shared Amplify Gen2 backend and are written as GraphQL schema shapes matching what Amplify actually generates, rather than a generic REST spec, per the confirmed decision. [Q1] Contract 9 follows the same GraphQL convention; Contract 8 is the project's first internal event contract, since it is the first boundary between two non-Auth Units.

## Contract 1 — Identity Resolution (shared-schema)

```yaml
shared-schema:
  name: IdentityClaim
  description: >
    The identity information every consuming Unit reads from the signed-in
    user's Cognito ID token after Amplify Auth (Cognito, Google federation)
    completes sign-in. Not a network call between separately deployed
    services — a token-claim shape shared across the single Amplify Gen2
    backend and read by every Unit that needs to attribute an action to a
    person.
  source: AWS Cognito ID token (JWT), issued by the user pool U1 configures
  fields:
    - name: sub
      type: string
      description: >
        Stable Cognito user identifier; stored by consumers as
        createdByGoogleId (U2), submittedByGoogleId (U3), donorGoogleId
        (U4), or uploadedByGoogleId (U5)
    - name: email
      type: string
      description: The signed-in user's Google account email, via Google federation
  consumers: [FeedUnit, SuggestionUnit, DonationUnit, PdfLibraryUnit, FlutterAppUnit]
```

## Contract 2 — Admin Authorization (shared-schema)

> **Amended** — `SuggestionUnit` added to `consumers`. This closes a gap
> the Contract Design review flagged at that stage's gate (`allSuggestions`
> below already required the Admin group, but this contract's consumer
> list omitted SuggestionUnit); the human accepted it as a known finding
> at the time, and it is corrected now that SuggestionUnit's Functional
> Design pass touches this contract directly.
>
> **Amended at Functional Design** (auth-unit): the description's
> "Backed by U1's `AdminAllowlistEntry` data" line is corrected —
> auth-unit's Functional Design (Q1) resolved admin authorization to
> native AWS Cognito Groups instead of a database-backed
> `AdminAllowlistEntry` table, superseding Domain Design ADR-001's
> original database-backed framing. This is the same claim shape either
> way (`cognito:groups` contains `"Admin"`), so no consumer-visible field
> changes — only the backing-mechanism description is corrected.

```yaml
shared-schema:
  name: AdminGroupClaim
  description: >
    The Cognito group-membership claim FeedUnit, PdfLibraryUnit, and
    SuggestionUnit check to decide whether the signed-in identity may
    mutate/read admin-only data (create/edit/delete a post, upload a
    document, or read every submitted suggestion). Backed by native AWS
    Cognito Groups (an identity is added to or removed from the "Admin"
    group directly), not a separate database table — auth-unit's
    Functional Design superseded Domain Design's original
    AdminAllowlistEntry framing.
  source: AWS Cognito ID token (JWT) cognito:groups claim, issued by the user pool U1 configures
  fields:
    - name: cognito:groups
      type: array of string
      description: Contains "Admin" when the signed-in identity is a member of the Cognito "Admin" group
  consumers: [FeedUnit, PdfLibraryUnit, SuggestionUnit]
```

## Contract 3 — Feed Data (GraphQL)

> **Amended at Functional Design** (feed-unit): added `listAllPostsForAdmin`
> and `getPost`. Editing an aged-out post's `dateTime` (confirmed at
> Functional Design, Q2) requires an admin to be able to retrieve a post
> that `listPosts` no longer returns — the original contract had no such
> path. Both additions are Admin-group-only and additive; `listPosts`,
> `createPost`, `updatePost`, and `deletePost` are unchanged.
>
> **Amended at Functional Design** (reminder-unit): `ReminderUnit (U7)`
> added as a second consumer of `listPosts` — no schema change. ReminderUnit's
> lazy Reminder-creation mechanism (`myReminders` sync, Contract 9) needs to
> enumerate current Event-type Posts and their `dateTime` the first time a
> device becomes aware of them; `listPosts` already returns everything this
> needs (`id`, `type`, `dateTime`) as a public, unauthenticated read, so no
> new query or field was required — only the consumer list needed updating.
> This closes the gap the Functional Design review caught: Domain Design's
> component diagram and Units Generation's story-map both named "read Event
> post data" as a ReminderUnit dependency on FeedUnit distinct from Contract
> 8's change-notice stream, but no contract had actually granted it read
> access until now.

```graphql
# Provider: FeedUnit (U2)  |  Consumer: FlutterAppUnit (U6), ReminderUnit (U7, listPosts only)

type Post {
  id: ID!
  type: PostType!
  title: String!
  description: String!
  dateTime: AWSDateTime!
  createdByGoogleId: String!
  createdAt: AWSDateTime!
  updatedAt: AWSDateTime!
}

enum PostType {
  EVENT
  VISITING_DIGNITARY
  DONATION_CALL_OUT   # added once DonationUnit ships, per Domain Design ADR-003
}

type Query {
  listPosts: [Post!]!   # public read, most-recent-first; the 1-day post-event age-out rule is applied server-side to what this returns. Also called by ReminderUnit's Lambda (no auth token) during myReminders sync to enumerate current Event-type posts
  listAllPostsForAdmin: [Post!]!   # Admin group only; returns every non-deleted post regardless of age-out, so admins can find and edit a post that has aged out of listPosts
  getPost(id: ID!): Post   # Admin group only; returns the post even if aged out (never a deleted post — returns null); needed to edit a specific aged-out post
}

type Mutation {
  createPost(input: CreatePostInput!): Post!          # requires Admin group (Contract 2)
  updatePost(id: ID!, input: UpdatePostInput!): Post!  # requires Admin group (Contract 2)
  deletePost(id: ID!): Post!                           # requires Admin group (Contract 2)
}
```

## Contract 4 — Suggestion Data (GraphQL)

```graphql
# Provider: SuggestionUnit (U3)  |  Consumer: FlutterAppUnit (U6)

type Suggestion {
  id: ID!
  submittedByGoogleId: String!
  text: String!   # up to 300 words, enforced server-side
  submittedAt: AWSDateTime!
}

type Query {
  myPastSuggestions: [Suggestion!]!   # owner-only: submittedByGoogleId must equal the caller's identity (Contract 1)
  allSuggestions: [Suggestion!]!      # requires Admin group (Contract 2's group, checked here even though PdfLibrary/Feed are the group's primary consumers — any signed-in admin may read all suggestions)
}

type Mutation {
  submitSuggestion(text: String!): Suggestion!   # any signed-in user (Contract 1); no anonymous option
}
```

## Contract 5 — Donation Data (GraphQL)

> **Amended at Functional Design** (donation-unit): added `frequency`,
> `cancelledAt`, the `CANCELLED` status value, and `cancelDonation` below.
> Contract Design's original pass predates the frequency and in-app
> cancellation decisions made during donation-unit's Functional Design
> interview (Q2, Q3); this is an additive amendment, not a breaking one —
> existing fields, the two original status values' meaning, and
> `initiateDonation`'s shape are unchanged. Per the project's "no formal
> versioning policy — update both sides together" practice, both this
> contract and donation-unit's `entities.md`/`rules.md` are updated together
> in the same change.
>
> **Amended at Functional Design** (donation-unit, review fix): `DonationInitiation`
> was referenced as `initiateDonation`'s return type but never formally
> defined — the same class of gap pdf-library-unit's `DocumentUploadTarget`
> hit earlier in this project. Defined below.

```graphql
# Provider: DonationUnit (U4)  |  Consumer: FlutterAppUnit (U6)

type Donation {
  id: ID!
  donorGoogleId: String!
  amount: Float!
  donationType: DonationType!
  frequency: DonationFrequency   # required iff donationType = RECURRING; absent for ONE_TIME
  status: DonationStatus!
  aggregatorTransactionId: String
  createdAt: AWSDateTime!
  cancelledAt: AWSDateTime        # set only when status = CANCELLED
}

enum DonationType { ONE_TIME RECURRING }
enum DonationFrequency { MONTHLY QUARTERLY YEARLY }
enum DonationStatus { INITIATED PENDING SUCCEEDED FAILED CANCELLED }

type DonationInitiation {
  donationId: ID!            # the newly-created Donation's id, so the client can poll myDonations for it
  checkoutUrl: AWSURL!        # the aggregator's own checkout page/session the client redirects the user to
  checkoutReference: String!  # the aggregator's own session/order reference, echoed for client-side correlation/logging
}

type Query {
  myDonations: [Donation!]!   # owner-only (Contract 1)
}

type Mutation {
  initiateDonation(amount: Float!, donationType: DonationType!, frequency: DonationFrequency): DonationInitiation!
  # any signed-in user (Contract 1); frequency required iff donationType = RECURRING;
  # returns an aggregator checkout reference, not a completed donation —
  # the actual outcome arrives via Contract 7

  cancelDonation(id: ID!): Donation!
  # owner-only (Contract 1) and only for an active RECURRING donation
  # (status = SUCCEEDED, donationType = RECURRING); refused otherwise
}
```

## Contract 6 — PDF Library Data (GraphQL + S3)

> **Amended at Functional Design** (pdf-library-unit): `category` changed
> from a free-text `String!` to a `DocumentCategory` enum, now that the
> fixed initial category list is confirmed (Daily Poojan, Various
> Vidhaans, Bhaktamar — Q1); added `deleteDocument`, since Q3 confirmed
> admins can delete documents (hard delete); added `createDocumentUploadUrl`
> and `confirmDocumentUpload`, since a large PDF cannot transit a single
> AppSync mutation payload without contradicting Q2's "no file-size limit
> beyond what S3/Amplify naturally supports" — the upload must go directly
> to S3 via a pre-signed URL, symmetric to `getDocumentDownloadUrl`'s
> pre-signed download. No prior consumer exists yet (Code Generation has
> not started), so this refinement carries no migration cost.

```graphql
# Provider: PdfLibraryUnit (U5)  |  Consumer: FlutterAppUnit (U6)

type Document {
  id: ID!
  title: String!
  category: DocumentCategory!
  s3Key: String!
  uploadedByGoogleId: String!
  uploadedAt: AWSDateTime!
}

enum DocumentCategory {
  DAILY_POOJAN
  VARIOUS_VIDHAANS
  BHAKTAMAR
}

type Query {
  listDocuments(category: DocumentCategory): [Document!]!   # public read
  getDocumentDownloadUrl(id: ID!): AWSURL!                   # public read; returns a time-limited pre-signed S3 URL
}

type DocumentUploadTarget {
  uploadUrl: AWSURL!   # the pre-signed S3 PUT URL the admin's client uploads the PDF bytes to directly
  s3Key: String!        # echoed back so the client can pass it unchanged to confirmDocumentUpload
}

type Mutation {
  createDocumentUploadUrl(title: String!, category: DocumentCategory!): DocumentUploadTarget!
  # requires Admin group (Contract 2); category must be one of DocumentCategory's
  # values; returns a time-limited pre-signed S3 upload URL and an s3Key —
  # the admin's client uploads the PDF bytes directly to S3, not through this API

  confirmDocumentUpload(s3Key: String!, title: String!, category: DocumentCategory!): Document!
  # requires Admin group; called after the direct-to-S3 upload succeeds;
  # verifies the uploaded object is a PDF and creates the Document record
  # (the file's PDF-ness is checked here, once the bytes exist in S3 — not
  # earlier, since this API never sees the file content itself). title/category
  # are re-supplied here (amended at Infrastructure Design, review fix) —
  # createDocumentUploadUrl's own title/category args were never carried
  # forward to this call, and this API holds no server-side "pending upload"
  # state to remember them from the first call; the admin's client already
  # has both values from its own createDocumentUploadUrl request, so passing
  # them again is the simplest fix, needing no new stored state.

  deleteDocument(id: ID!): ID!
  # requires Admin group (Contract 2); hard delete — removes the S3 file
  # FIRST, then the Document record only after the S3 removal succeeds
  # (see rules.md BR6.4's ordering); if the record-delete step then fails,
  # the record is retried on the next attempt rather than left orphaned
  # with no file
}
```

## Contract 7 — Donation-Aggregator Webhook (OpenAPI)

Specified in full now, using a placeholder shape typical of UPI aggregators like Razorpay, rather than waiting for the real aggregator account. [Q3] Idempotent handling is a hard requirement of this contract. [Q4]

```yaml
openapi: 3.0.3
info:
  title: Donation Aggregator Webhook (DonationUnit)
  version: "1.0"
  description: >
    Provider: DonationUnit (U4). Consumer: External — the UPI payment
    aggregator's webhook caller. Placeholder payload shape based on typical
    UPI aggregator webhook conventions (e.g. Razorpay); refine once the
    real aggregator account and its exact webhook format exist.
paths:
  /webhooks/donations/payment-status:
    post:
      summary: Payment status notification from the aggregator
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [event, payload]
              properties:
                event:
                  type: string
                  enum: [payment.captured, payment.failed]
                payload:
                  type: object
                  properties:
                    payment_id:
                      type: string
                      description: The aggregator's own transaction identifier
                    order_id:
                      type: string
                      description: Correlates to a Donation.id in Contract 5
                    amount:
                      type: number
                    status:
                      type: string
      responses:
        "200":
          description: >
            Notification processed. This endpoint is idempotent: a duplicate
            delivery for the same payment_id has no additional effect on the
            corresponding Donation's status — a hard requirement of this
            contract, since the aggregator may retry a webhook delivery and
            the Mandated reconciliation rule (never assume an outcome on
            timeout) depends on being able to safely re-check.
        "401":
          description: Signature verification failed. The aggregator signs its webhook payloads; DonationUnit verifies the signature before processing any notification.
security:
  - aggregatorSignature: []
```

## Contract 8 — Post Change Notification (async event)

Provider: U2 (FeedUnit). Consumer: U7 (ReminderUnit). The first internal event contract in this project — a boundary between two non-Auth Units, carrying no user-facing payload, only enough to let U7 reschedule or cancel a Reminder in response to a Post change. [Contract Design Q1, Q2]

> **Amended** — `PostDeleted` corrected to match FeedUnit's actual delete
> semantics. FeedUnit performs a SOFT delete (`deletedAt` is set; the
> DynamoDB item is never removed — see feed-unit's `entities.md`/BR2.x), so
> there is no native DynamoDB Streams `REMOVE` record to key this event off
> of. `PostDeleted` is instead emitted from the same stream's `MODIFY`
> record, specifically when `deletedAt` transitions from absent/null to a
> real timestamp — not from a `REMOVE` event, which never occurs for a Post.
> This correction was caught while confirming feed-unit's Functional Design
> during the redo pass, before feed-unit's own artifacts were touched.
>
> **Amended at Functional Design** (reminder-unit): closes the remaining
> gaps the Contract Design review disclosed. (1) The Lambda handler is
> idempotent — it treats redelivery of the same stream record as a no-op,
> keyed on `postId` plus that record's own `updatedAt`/sequence position, so
> a Lambda retry or an out-of-order redelivery never double-applies a
> reschedule or cascade. (2) Both `PostDeleted`'s cascade and Contract 9's
> `cancelReminder` (see below) are idempotent no-ops against a Reminder
> already in a terminal status (`FIRED`, `CLEARED`, or `CANCELLED`) — only a
> `SCHEDULED`/`SNOOZED` Reminder actually transitions. (3) The AsyncAPI shape
> below is a notational approximation of a DynamoDB Streams + Lambda
> event-source mapping, not a literal pub/sub broker — the two domain
> messages are synthesized by ReminderUnit's Lambda from the stream's raw
> `MODIFY` records (old/new item images), not emitted natively in this
> shape.

```yaml
asyncapi: 2.6.0
info:
  title: Post Change Notification (FeedUnit -> ReminderUnit)
  version: "1.0"
  description: >
    Provider: FeedUnit (U2). Consumer: ReminderUnit (U7). Carried by DynamoDB
    Streams on the Post table (Amplify Data enables this per-model), processed
    by a Lambda function owned by U7. Not a GraphQL/AppSync boundary — this is
    an internal, same-backend event stream, not a client-facing API. This
    AsyncAPI document is a notational approximation of that Streams + Lambda
    event-source mapping, not a literal pub/sub broker.
channels:
  post-change-stream:
    subscribe:
      message:
        oneOf:
          - name: PostDateTimeChanged
            payload:
              type: object
              required: [postId, type, newDateTime]
              properties:
                postId:
                  type: string
                type:
                  type: string
                  enum: [EVENT, VISITING_DIGNITARY, DONATION_CALL_OUT]
                newDateTime:
                  type: string
                  format: date-time
            description: >
              Emitted whenever an existing Post's dateTime field changes.
              ReminderUnit reacts only when a Reminder already exists for this
              postId; a changed VISITING_DIGNITARY/DONATION_CALL_OUT post is
              ignored (no Reminder was ever created for it, per FR7.1).
          - name: PostDeleted
            payload:
              type: object
              required: [postId]
              properties:
                postId:
                  type: string
            description: >
              Emitted when an admin deletes a Post (FR2.5) — derived from a
              DynamoDB Streams MODIFY record where deletedAt transitions from
              absent/null to a timestamp (FeedUnit's soft-delete model; see
              the Amendment note above), NOT a REMOVE record, which never
              occurs for a Post. ReminderUnit auto-cancels any Reminder
              referencing this postId — the same cleanup outcome as a
              user-initiated cancel (FR7.7), just system-triggered. Closes
              the gap disclosed at Domain Design and Units Generation
              (Contract Design Q2).
```

## Contract 9 — Reminder Data (GraphQL)

Provider: U7 (ReminderUnit). Consumer: U6 (FlutterAppUnit). Authorization mode is IAM/guest (Amplify Data's `allow.guest()`), not the Cognito User Pool group/owner auth Contracts 1-6 use — there is no signed-in identity involved anywhere in this contract, per Domain Design ADR-005 and FR7.8. [Contract Design Q2, Q3]

```graphql
# Provider: ReminderUnit (U7)  |  Consumer: FlutterAppUnit (U6)
# Authorization: Cognito Identity Pool guest (unauthenticated) identity only —
# no Cognito User Pool token is ever presented on this contract.

type Reminder {
  id: ID!
  postId: ID!               # references FeedUnit's Post.id (Contract 3) — plain reference, not a GraphQL relation
  ownerIdentityId: String!  # the caller's guest identity id
  status: ReminderStatus!
  initialFireAt: AWSDateTime!
  snoozeFireAt: AWSDateTime
  createdAt: AWSDateTime!
}

enum ReminderStatus { SCHEDULED SNOOZED FIRED CLEARED CANCELLED }

type DeviceToken {
  id: ID!
  ownerIdentityId: String!
  pushToken: String!
  platform: DevicePlatform!
  remindersEnabled: Boolean!   # app-wide reminders toggle (FR7.2); closes the gap disclosed at Domain Design and Units Generation (Contract Design Q2)
  registeredAt: AWSDateTime!
}

enum DevicePlatform { IOS ANDROID }

type Query {
  myReminders: [Reminder!]!   # guest-identity-scoped: only the caller's own device's reminders
}

type Mutation {
  registerDeviceToken(pushToken: String!, platform: DevicePlatform!): DeviceToken!
  # idempotent per (ownerIdentityId, pushToken) — re-registering the same token updates registeredAt rather than duplicating

  setRemindersEnabled(enabled: Boolean!): DeviceToken!
  # the app-wide toggle (FR7.2); setting false does not delete existing SCHEDULED/SNOOZED reminders,
  # it only suppresses future auto-creation for this device — an explicit behavioural choice made here
  # to close the ambiguity the earlier stages' reviews flagged

  snoozeReminder(id: ID!): Reminder!
  # requires ownerIdentityId = caller's identity; sets snoozeFireAt to 9:00 PM IST the same day (FR7.5);
  # refused if that time has already passed

  cancelReminder(id: ID!): Reminder!
  # requires ownerIdentityId = caller's identity; user-initiated cancel (FR7.7), distinct from the
  # system-triggered auto-cancel Contract 8's PostDeleted event causes
}
```

## Contract Ownership Rules

- Each contract's Owner (per the table above) is the Unit that provides it — the same solo builder maintains every Unit, so ownership here identifies which Unit's schema changes drive a contract change, not a separate team.
- No formal versioning or deprecation-window policy is adopted. Breaking changes to any GraphQL schema or the webhook payload are avoided; when a schema does need to change, both the provider Unit and every consumer are updated together in the same change, since one person maintains both sides. [Q2]
- Additive changes (a new optional field, a new enum value) are always safe — consumers read only the fields they declare and must not fail on an unrecognized field or enum value.
- Contract 7 (the external webhook) is the one boundary with a consumer outside this system's control — it cannot assume the aggregator will coordinate a breaking change, so its payload shape should be treated as more durable than the in-system contracts once real integration begins.

## Open Questions

| Contract | Question | Blocks |
|---|---|---|
| Contract 7 (Donation Webhook) | The exact payload shape and signature-verification mechanism depend on which aggregator account is actually set up (Razorpay or otherwise) — the shape here is a reasonable placeholder, not a confirmed spec. | U4 (DonationUnit) detailed design and Code Generation |
| Contracts 1, 2 | The precise Cognito ID-token claim names (`sub`, `email`, `cognito:groups`) are standard Amplify/Cognito defaults but should be verified once Amplify's auth resource is actually generated in Functional Design. | U2, U3, U4, U5, U6 |
| Contract 9 | The exact scheduled-compute mechanism that turns `initialFireAt`/`snoozeFireAt` into an actual push delivery at the right moment (EventBridge Scheduler vs. DynamoDB TTL+Streams vs. polling Lambda) remains deferred to Infrastructure Design, per Domain Design's own disclosed deferral — this contract only defines the data shape, not the firing mechanism. **Resolved at Functional Design** (reminder-unit): FR7.6's auto-clear is an explicit write (not a computed read-time status), performed by that same scheduled-compute mechanism, and applies from SCHEDULED, SNOOZED, or FIRED (confirmed at the redo pass) — only the exact trigger cadence/mechanism remains an Infrastructure Design decision. | U7 (ReminderUnit) detailed design, Infrastructure Design |
| Contract 8 | The behavioral contract (idempotent, keyed on postId + updatedAt) is now pinned, but the exact Lambda-level retry/dedup implementation mechanics (e.g. a DynamoDB conditional write guarding the cascade, vs. relying on the Streams event-source mapping's own at-least-once redelivery window) are left to Infrastructure Design/Code Generation. | U7 (ReminderUnit) detailed design, Infrastructure Design |
