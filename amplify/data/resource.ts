/**
 * Shared Amplify Data schema for the Sarovar Jinalaya backend.
 *
 * donation-unit (U4) introduces this file with the `Donation` model and the
 * Contract 5 operations; feed-, suggestion-, pdf-library- and reminder-unit add
 * their own models alongside it. `defaultAuthorizationMode: 'userPool'` means
 * every operation requires a Cognito User Pool JWT (Contract 1) unless a rule
 * says otherwise — nothing in this Unit is reachable unauthenticated.
 *
 * feed-unit (U2) adds the `Post` model, the `CreatePost`/`UpdatePost` input
 * shapes and the six Contract 3 operations (see "feed-unit (U2)" below); the
 * public `listPosts` read is the one operation reachable unauthenticated, via
 * the Cognito Identity Pool's unauthenticated (guest) role.
 *
 * pdf-library-unit (U5) adds the `Document` model, the `DocumentUploadTarget`
 * custom type and the five Contract 6 operations (see "pdf-library-unit (U5)"
 * below); `listDocuments` and `getDocumentDownloadUrl` are public reads in
 * the same guest mode as `listPosts`.
 *
 * suggestion-unit (U3) adds the `Suggestion` model, the internal
 * `SuggestionDailyCount` rate-limit counter and the three Contract 4
 * operations (see "suggestion-unit (U3)" below); nothing in it is reachable
 * unauthenticated.
 *
 * reminder-unit (U7) adds the `Reminder` and `DeviceToken` models and the
 * five Contract 9 operations (see "reminder-unit (U7)" below); every one of
 * them is reachable by a GUEST identity — no sign-in is ever required (BR7.6)
 * — and `backend.ts` grants that Unit's Lambda `appsync:GraphQL` on the
 * single `Query.listPosts` field (Contract 3, second consumer) rather than a
 * schema-wide `allow.resource(...)`, which would cover admin queries too.
 *
 * ## Donation — who enforces what (project.md Correction: never leave implicit)
 *
 * - **Model authorization (declarative, server-side, AppSync):** the only rule
 *   on `Donation` is owner-READ, matched on `donorGoogleId` against the JWT's
 *   `sub` claim. A donor can read only their own rows through the generated
 *   `get`/`list` queries; NOBODY may create/update/delete a Donation through
 *   the generated model mutations — no rule grants those operations, so
 *   AppSync rejects them. This is the layer that actually enforces read
 *   privacy of donation records.
 * - **Lambda `donation-api` (server-side, `functions/donation-api/handler.ts`):**
 *   the layer that actually enforces BR5.2/BR5.3 (validation), BR5.6
 *   (donor-only cancel, checked against the verified JWT `sub`) and the
 *   `myDonations` owner scoping. All writes go through the Lambdas with IAM
 *   access to the table, never through the model API.
 * - **Flutter screens (flutter-app-unit):** only UX convenience (hiding a
 *   Cancel button, etc.) — never relied on for security.
 *
 * ## Fields
 *
 * Exactly `entities.md` plus one internal attribute: `processedPaymentId`
 * (security-design.md, Idempotent write design / NFR5.2). It is the
 * persistence-layer idempotency marker written by the settlement `UpdateItem`.
 *
 * Exposure, stated precisely (revision 1, review F-7 — the earlier blanket
 * "never exposed" claim was wrong): Contract 5's three custom operations never
 * return it (`toPublicDonation` strips it), but declaring it on the model also
 * puts it in the generated `getDonation` / `listDonations` selection set, where
 * the owner-read rule below lets a donor read it on THEIR OWN rows. That is
 * accepted rather than removed: the value is an aggregator-issued settlement
 * reference, not a payment credential — BR5.1 (never hold a card number or UPI
 * PIN) is not implicated — and the exposure is owner-scoped, to the same person
 * who made the payment. Keeping the field declared is also what makes the
 * attribute part of the model's schema at all. If a future release wants it
 * hidden, the change is to drop it from `a.model({...})` and let the Lambdas
 * write the attribute directly to DynamoDB.
 *
 * `createdAt` is declared explicitly (rather than relying on Amplify's
 * auto-timestamp) so it can be a secondary-index sort key; the repository sets
 * it on every create.
 *
 * ## Secondary indexes
 *
 * - `statusIndex` (`status`, sorted by `createdAt`): infrastructure-specification.md
 *   — the reconciler's "PENDING older than the confirmation window" Query (NFR5.1).
 * - `donorIndex` (`donorGoogleId`, sorted by `createdAt`): added at Code
 *   Generation so `myDonations` is a Query rather than a Scan (the same class
 *   of gap reminder-unit's R-04 found); the infra spec carries an amendment note.
 *
 * ## Rules this file carries
 *
 * BR5.1: no field exists that could hold a card number or UPI PIN — the model
 * holds only the aggregator-issued `aggregatorTransactionId` and the internal
 * `processedPaymentId` reference. NFR4.1: DynamoDB tables created by Amplify
 * Data use AWS-managed encryption at rest; AppSync is HTTPS-only.
 */
import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { documentApi } from '../functions/document-api/resource';
import { donationApi } from '../functions/donation-api/resource';
import { feedApi } from '../functions/feed-api/resource';
import { reminderApi } from '../functions/reminder-api/resource';
import { allSuggestions } from '../functions/all-suggestions/resource';
import { submitSuggestion } from '../functions/submit-suggestion/resource';

import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_INDEX,
} from '../functions/document-shared/constants';
import {
  DONATION_DONOR_INDEX,
  DONATION_FREQUENCIES,
  DONATION_STATUSES,
  DONATION_STATUS_INDEX,
  DONATION_TYPES,
} from '../functions/donation-shared/types';
import {
  DEVICE_TOKEN_OWNER_INDEX,
  REMINDER_OWNER_INDEX,
  REMINDER_POST_INDEX,
} from '../functions/reminder-shared/constants';
import { DEVICE_PLATFORMS, REMINDER_STATUSES } from '../functions/reminder-shared/types';
import { SUGGESTION_SUBMITTER_INDEX } from '../functions/suggestion-shared/types';
import { POST_TYPES } from './post-shared/post-rules';

/**
 * Contract 5 enum values and index names are defined once in
 * `functions/donation-shared/types.ts` (Lambda code must not import this file)
 * and re-exported here for schema consumers and tests.
 */
export {
  DONATION_DONOR_INDEX,
  DONATION_FREQUENCIES,
  DONATION_STATUSES,
  DONATION_STATUS_INDEX,
  DONATION_TYPES,
};

/** Contract 3 enum values, defined once in `post-shared/post-rules.ts` (BR2.1). */
export { POST_TYPES };

/** Contract 6 enum values and index name, defined once in `functions/document-shared/constants.ts` (BR6.1). */
export { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_INDEX };

/** Contract 4 index name, defined once in `functions/suggestion-shared/types.ts`. */
export { SUGGESTION_SUBMITTER_INDEX };

/** Contract 9 enum values and index names, defined once under `functions/reminder-shared/`. */
export {
  DEVICE_PLATFORMS,
  DEVICE_TOKEN_OWNER_INDEX,
  REMINDER_OWNER_INDEX,
  REMINDER_POST_INDEX,
  REMINDER_STATUSES,
};

const schemaDefinitions = {
  DonationType: a.enum([...DONATION_TYPES]),
  DonationFrequency: a.enum([...DONATION_FREQUENCIES]),
  DonationStatus: a.enum([...DONATION_STATUSES]),

  Donation: a
    .model({
      donorGoogleId: a.string().required(),
      amount: a.float().required(),
      donationType: a.ref('DonationType').required(),
      frequency: a.ref('DonationFrequency'),
      status: a.ref('DonationStatus').required(),
      aggregatorTransactionId: a.string(),
      createdAt: a.datetime().required(),
      cancelledAt: a.datetime(),
      // Internal idempotency marker (security-design.md). Not returned by
      // Contract 5's custom operations; readable by the owning donor through
      // the generated model queries — see "Fields" above (review F-7).
      processedPaymentId: a.string(),
    })
    .secondaryIndexes((index) => [
      index('status').sortKeys(['createdAt']).name(DONATION_STATUS_INDEX),
      index('donorGoogleId').sortKeys(['createdAt']).name(DONATION_DONOR_INDEX),
    ])
    // Owner-READ only. No create/update/delete rule on purpose: every write is
    // performed by the donation Lambdas through IAM, which is where BR5.2,
    // BR5.3, BR5.5 and BR5.6 are enforced.
    .authorization((allow) => [
      allow.ownerDefinedIn('donorGoogleId').identityClaim('sub').to(['read']),
    ]),

  // Contract 5: what `initiateDonation` returns — a checkout hand-off, not a Donation.
  DonationInitiation: a.customType({
    donationId: a.id().required(),
    checkoutUrl: a.url().required(),
    checkoutReference: a.string().required(),
  }),

  // Contract 5 operations — any signed-in user (Contract 1); all handled by
  // the `donation-api` Lambda, which derives the caller from the verified JWT.
  initiateDonation: a
    .mutation()
    .arguments({
      amount: a.float().required(),
      donationType: a.ref('DonationType').required(),
      frequency: a.ref('DonationFrequency'),
    })
    .returns(a.ref('DonationInitiation').required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(donationApi)),

  cancelDonation: a
    .mutation()
    .arguments({ id: a.id().required() })
    .returns(a.ref('Donation').required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(donationApi)),

  myDonations: a
    .query()
    .returns(a.ref('Donation').required().array().required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(donationApi)),

  // ==========================================================================
  // feed-unit (U2) — the `Post` entity and Contract 3
  // ==========================================================================
  //
  // ## Post — who enforces what (project.md Correction: never leave implicit)
  //
  // - **Operation authorization (declarative, server-side, AppSync):** this is
  //   the layer that actually enforces BR2.3 and BR2.7. `listPosts` carries
  //   `allow.guest()` + `allow.authenticated()` (anyone may read the feed —
  //   FR1.3/FR2.6, NFR-AUTHZ.1 — guests through the Identity Pool's
  //   unauthenticated role, the same mode Contract 9 uses); the five admin
  //   operations carry `allow.group('Admin')` ONLY. The `Post` model carries
  //   matching type-level rules so the fields of a returned `Post` are
  //   readable under the same modes.
  //
  //   **CORRECTED 2026-10-01, against the first real deployment.** That rule
  //   does NOT reach AppSync for every admin operation, and the difference is
  //   whether the operation is backed by a custom JS resolver or by a Lambda.
  //   Reading the deployed SDL (`aws appsync get-introspection-schema
  //   --include-directives`) shows:
  //
  //     createPost            @aws_cognito_user_pools(cognito_groups:["Admin"])
  //     deletePost            @aws_cognito_user_pools(cognito_groups:["Admin"])
  //     updatePost            @aws_cognito_user_pools(cognito_groups:["Admin"])
  //     listAllPostsForAdmin  @aws_cognito_user_pools        <-- no group
  //     allSuggestions        @aws_cognito_user_pools        <-- no group
  //     confirmDocumentUpload @aws_cognito_user_pools        <-- no group
  //
  //   All six declare `allow.group('Admin')` here. Amplify Data translates it
  //   into a `cognito_groups` directive for `a.handler.custom(...)` resolvers
  //   but NOT for `a.handler.function(...)` Lambda-backed operations, where it
  //   degrades silently to "any authenticated Cognito user". There is no
  //   warning at synth or deploy time.
  //
  //   So for the three Lambda-backed operations, AppSync admits any signed-in
  //   worshipper and the request reaches the Lambda.
  // - **In-handler group check:** each admin operation re-checks the caller's
  //   groups — `ctx.identity.groups` + `util.unauthorized()` in the four
  //   `post-resolvers/*.js` resolvers, `event.identity.groups` in the
  //   `feed-api`, `all-suggestions` and `document-api` Lambdas' `requireAdmin`.
  //
  //   **For the three Lambda-backed operations this is THE ENFORCING LAYER,
  //   not a backstop.** It is the only thing standing between an ordinary
  //   signed-in user and every suggestion-box submission. Do not remove or
  //   weaken `requireAdmin` on the belief that AppSync has already filtered
  //   the caller — for those three it has not. `all-suggestions`,
  //   `document-api` and `feed-api` each carry a test asserting a non-admin
  //   identity is refused; those tests exist to make this impossible to
  //   delete by accident.
  //
  //   For the JS-resolver operations it remains a genuine second layer, and
  //   it is load-bearing there too, because Amplify's IAM authorization mode
  //   does not apply `@auth` rules to an IAM principal and an IAM caller
  //   carries no `cognito:groups`.
  // - **Flutter screens (flutter-app-unit):** UX convenience only (hiding the
  //   admin controls) — never relied on for security.
  //
  // ## Why the two list operations are Lambda-backed and the other four are not
  //
  // 1. `listPosts`: the installed `@aws-amplify/data-schema` refuses
  //    identityPool-based rules (`allow.guest()`) on any `a.handler.custom`
  //    operation ("not currently supported with handler.custom"). Rather than
  //    an expiring API key, the builder chose (plan Revision 2) a small
  //    Lambda, `functions/feed-api`, which `a.handler.function` accepts with
  //    the guest rule the design intended.
  // 2. `listAllPostsForAdmin`: it must PAGE through the table, and an
  //    APPSYNC_JS unit resolver makes exactly one data-source call per
  //    invocation. As a JS resolver it read only the first Scan page and
  //    silently dropped older posts past ~100 rows (Revision 1, review
  //    finding F-1). Contract 3 declares `listAllPostsForAdmin: [Post!]!`
  //    with no arguments and no pagination field, so pagination cannot be
  //    exposed through the operation without breaking the contract; moving it
  //    onto the same Lambda keeps the contract shape exact AND returns every
  //    row. Both list paths now share one paginated Scan implementation, so a
  //    pagination bug cannot reappear in one while the other stays correct.
  //
  // `getPost`, `createPost`, `updatePost` and `deletePost` are single-item
  // reads and writes with no pagination concern, so they stay AppSync
  // JavaScript resolvers with no Lambda.
  //
  // ## Generated model operations are disabled
  //
  // `disableOperations(['queries', 'mutations', 'subscriptions'])` keeps the
  // generated `listPosts`/`getPost`/`createPost`/... from colliding with the
  // Contract 3 operations of the same names, and closes the only path by
  // which a soft-deleted post could ever be read (BR2.6): the table is
  // reachable solely through the six operations below.
  //
  // ## Fields
  //
  // Exactly `entities.md`. `deletedAt` is the soft-delete marker (BR2.6); it
  // is exposed on the GraphQL `Post` type as an optional field the contract
  // did not list (additive; recorded in the plan's known deviations) and is
  // null on every post a query returns. `createdAt`/`updatedAt` are declared
  // explicitly and set by the resolvers, not by Amplify's auto-timestamps,
  // because the model's generated mutations are disabled.
  //
  // ## Input types
  //
  // Amplify names a custom type used as an argument `<TypeName>Input`, so the
  // custom types are `CreatePost` / `UpdatePost` to produce EXACTLY Contract
  // 3's `createPost(input: CreatePostInput!)` and
  // `updatePost(id: ID!, input: UpdatePostInput!)`. Amplify also emits a stray
  // output `type CreatePost` / `type UpdatePost`; nothing references them.
  //
  // NFR4.1: the `Post` table uses AWS-managed encryption at rest; AppSync is
  // HTTPS-only. Contract 8: DynamoDB Streams (`NEW_AND_OLD_IMAGES`) are
  // enabled on the table in `backend.ts` (`post-shared/post-table-config.ts`).

  PostType: a.enum([...POST_TYPES]),

  Post: a
    .model({
      type: a.ref('PostType').required(),
      title: a.string().required(),
      description: a.string().required(),
      dateTime: a.datetime().required(),
      createdByGoogleId: a.string().required(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required(),
      // Soft-delete marker (BR2.6). Null on every post any query returns.
      deletedAt: a.datetime(),
    })
    .disableOperations(['queries', 'mutations', 'subscriptions'])
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.authenticated().to(['read']),
      allow.group('Admin'),
    ]),

  // Contract 3 input shapes (GraphQL: `CreatePostInput` / `UpdatePostInput`).
  CreatePost: a.customType({
    type: a.ref('PostType').required(),
    title: a.string().required(),
    description: a.string().required(),
    dateTime: a.datetime().required(),
  }),

  UpdatePost: a.customType({
    type: a.ref('PostType'),
    title: a.string(),
    description: a.string(),
    dateTime: a.datetime(),
  }),

  // --- Contract 3: public read (BR2.4, BR2.6; FR1.3, FR2.6) ------------------
  // Lambda-backed (see "Why `listPosts` is Lambda-backed" above); guests reach
  // it through the Identity Pool's unauthenticated role.
  listPosts: a
    .query()
    .returns(a.ref('Post').required().array().required())
    .authorization((allow) => [allow.guest(), allow.authenticated()])
    .handler(a.handler.function(feedApi)),

  // --- Contract 3: admin-only (BR2.3, BR2.7) — `allow.group('Admin')` is the
  // enforcing layer; the handlers' own group check is a backstop. ------------
  //
  // `listAllPostsForAdmin` is Lambda-backed for the SAME reason `listPosts` is
  // (see "Why the two list operations are Lambda-backed" above): it must page
  // through the table, which an APPSYNC_JS resolver cannot do. Contract 3's
  // return type stays exactly `[Post!]!` with no arguments.
  listAllPostsForAdmin: a
    .query()
    .returns(a.ref('Post').required().array().required())
    .authorization((allow) => [allow.group('Admin')])
    .handler(a.handler.function(feedApi)),

  getPost: a
    .query()
    .arguments({ id: a.id().required() })
    .returns(a.ref('Post'))
    .authorization((allow) => [allow.group('Admin')])
    .handler(a.handler.custom({ dataSource: a.ref('Post'), entry: './post-resolvers/getPost.js' })),

  createPost: a
    .mutation()
    .arguments({ input: a.ref('CreatePost').required() })
    .returns(a.ref('Post').required())
    .authorization((allow) => [allow.group('Admin')])
    .handler(
      a.handler.custom({ dataSource: a.ref('Post'), entry: './post-resolvers/createPost.js' }),
    ),

  updatePost: a
    .mutation()
    .arguments({ id: a.id().required(), input: a.ref('UpdatePost').required() })
    .returns(a.ref('Post').required())
    .authorization((allow) => [allow.group('Admin')])
    .handler(
      a.handler.custom({ dataSource: a.ref('Post'), entry: './post-resolvers/updatePost.js' }),
    ),

  deletePost: a
    .mutation()
    .arguments({ id: a.id().required() })
    .returns(a.ref('Post').required())
    .authorization((allow) => [allow.group('Admin')])
    .handler(
      a.handler.custom({ dataSource: a.ref('Post'), entry: './post-resolvers/deletePost.js' }),
    ),

  // ==========================================================================
  // reminder-unit (U7) — the `Reminder` and `DeviceToken` entities and
  // Contract 9
  // ==========================================================================
  //
  // Placed BEFORE the pdf-library block (not appended at the end) on purpose:
  // Amplify emits models in definition order and custom types after all
  // models, and pdf-library-unit's schema test reads the SDL window between
  // `type Document` and `type DocumentUploadTarget`, which must not contain a
  // `status` field. Contract 9's `Reminder.status` therefore sits above it.
  //
  // ## Reminder / DeviceToken — who enforces what (project.md Correction:
  // never leave implicit)
  //
  // - **Operation authorization (declarative, server-side, AppSync) — the
  //   enforcing layer for BR7.6:** all five operations carry `allow.guest()`
  //   + `allow.authenticated()`. A device reaches them through the Cognito
  //   Identity Pool's unauthenticated role; a signed-in user's device still
  //   has a guest-pool identity and is treated identically. No User Pool
  //   group or owner rule appears anywhere in this Unit — there is no
  //   signed-in identity in Contract 9 (Domain Design ADR-005).
  // - **Lambda `reminder-api` (server-side, `functions/reminder-api/handler.ts`)
  //   — THE enforcing layer for BR7.3's and BR7.5's ownership checks and for
  //   the `myReminders` owner scoping:** the caller's identity is read ONLY
  //   from `event.identity.cognitoIdentityId` (filled by AppSync for IAM
  //   callers), never from an argument; every row returned is the caller's
  //   own, and a snooze/cancel of another device's Reminder is refused before
  //   any other branch. The model-level `allow.guest().to(['read'])` /
  //   `allow.authenticated().to(['read'])` rules below only make the FIELDS
  //   of a returned `Reminder`/`DeviceToken` readable under those modes;
  //   they are not the layer that decides WHICH rows a caller sees.
  // - **Flutter screens (flutter-app-unit):** UX convenience only.
  //
  // ## Why all five operations are Lambda-backed
  //
  // The infrastructure specification had `registerDeviceToken` /
  // `setRemindersEnabled` as direct resolvers, but the installed
  // `@aws-amplify/data-schema` refuses `allow.guest()` on a no-Lambda custom
  // resolver (the constraint feed-, pdf-library- and suggestion-unit all
  // hit), and `myReminders`/`snoozeReminder`/`cancelReminder` were already
  // Lambda-backed (they call EventBridge Scheduler). One `reminder-api`
  // Lambda serves the whole contract (plan "Known deviations").
  //
  // ## Generated model operations are disabled
  //
  // `disableOperations(['queries', 'mutations', 'subscriptions'])` on BOTH
  // models: Contract 9's names stay exact, and the tables are reachable
  // solely through the five operations below (no client can read another
  // device's rows through a generated `list`).
  //
  // ## Fields and indexes
  //
  // Exactly `entities.md`. `createdAt` is declared explicitly (the model's
  // generated mutations are disabled; the Lambda stamps it) and
  // `initialFireAt` is the sort key of `ownerIndex`. R-04 (Critical, fixed
  // here as the builder decided): BOTH tables are keyed on `id`, yet every
  // identity-scoped lookup (`myReminders`, `deliver-push`,
  // `registerDeviceToken`, `setRemindersEnabled`) is by `ownerIdentityId` —
  // so both carry an `ownerIndex` GSI and every such lookup is an index
  // Query. `postIdIndex` backs the Contract 8 cascade (BR7.9).
  //
  // NFR4.1: both tables use AWS-managed encryption at rest; AppSync is
  // HTTPS-only. `pushToken` is device-scoped personal data — never logged.

  ReminderStatus: a.enum([...REMINDER_STATUSES]),
  DevicePlatform: a.enum([...DEVICE_PLATFORMS]),

  Reminder: a
    .model({
      postId: a.id().required(),
      ownerIdentityId: a.string().required(),
      status: a.ref('ReminderStatus').required(),
      initialFireAt: a.datetime().required(),
      // Set if and only if status is SNOOZED (entities.md constraint).
      snoozeFireAt: a.datetime(),
      createdAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('postId').name(REMINDER_POST_INDEX),
      index('ownerIdentityId').sortKeys(['initialFireAt']).name(REMINDER_OWNER_INDEX),
    ])
    .disableOperations(['queries', 'mutations', 'subscriptions'])
    // Field-level read under guest/IAM and User Pool modes only. Row
    // selection is the Lambda's job (see "who enforces what"). No write rule
    // for anyone: every write goes through the reminder Lambdas via IAM.
    .authorization((allow) => [allow.guest().to(['read']), allow.authenticated().to(['read'])]),

  DeviceToken: a
    .model({
      ownerIdentityId: a.string().required(),
      pushToken: a.string().required(),
      platform: a.ref('DevicePlatform').required(),
      remindersEnabled: a.boolean().required(),
      registeredAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [index('ownerIdentityId').name(DEVICE_TOKEN_OWNER_INDEX)])
    .disableOperations(['queries', 'mutations', 'subscriptions'])
    .authorization((allow) => [allow.guest().to(['read']), allow.authenticated().to(['read'])]),

  // --- Contract 9: guest identity, no sign-in (BR7.6) — all five handled by
  // the `reminder-api` Lambda, which derives the caller from
  // `event.identity.cognitoIdentityId`. ------------------------------------
  myReminders: a
    .query()
    .returns(a.ref('Reminder').required().array().required())
    .authorization((allow) => [allow.guest(), allow.authenticated()])
    .handler(a.handler.function(reminderApi)),

  registerDeviceToken: a
    .mutation()
    .arguments({
      pushToken: a.string().required(),
      platform: a.ref('DevicePlatform').required(),
    })
    .returns(a.ref('DeviceToken').required())
    .authorization((allow) => [allow.guest(), allow.authenticated()])
    .handler(a.handler.function(reminderApi)),

  setRemindersEnabled: a
    .mutation()
    .arguments({ enabled: a.boolean().required() })
    .returns(a.ref('DeviceToken').required())
    .authorization((allow) => [allow.guest(), allow.authenticated()])
    .handler(a.handler.function(reminderApi)),

  snoozeReminder: a
    .mutation()
    .arguments({ id: a.id().required() })
    .returns(a.ref('Reminder').required())
    .authorization((allow) => [allow.guest(), allow.authenticated()])
    .handler(a.handler.function(reminderApi)),

  cancelReminder: a
    .mutation()
    .arguments({ id: a.id().required() })
    .returns(a.ref('Reminder').required())
    .authorization((allow) => [allow.guest(), allow.authenticated()])
    .handler(a.handler.function(reminderApi)),

  // ==========================================================================
  // pdf-library-unit (U5) — the `Document` entity and Contract 6
  // ==========================================================================
  //
  // ## Document — who enforces what (project.md Correction: never leave implicit)
  //
  // - **Operation authorization (declarative, server-side, AppSync):** this is
  //   the layer that actually enforces BR6.3 and BR6.5. `listDocuments` and
  //   `getDocumentDownloadUrl` carry `allow.guest()` + `allow.authenticated()`
  //   (the library is publicly browsable and downloadable — FR6.1, BR6.5 —
  //   guests through the Identity Pool's unauthenticated role, exactly as
  //   `listPosts`); the three admin operations carry `allow.group('Admin')`
  //   ONLY, so AppSync rejects any caller whose `cognito:groups` claim
  //   (Contract 2) lacks "Admin" before the Lambda runs. The `Document` model
  //   carries matching type-level rules so the fields of a returned
  //   `Document` are readable under the same modes.
  // - **In-Lambda group check (`functions/document-api/handler.ts`):** each
  //   admin operation re-checks `event.identity.groups` and throws otherwise.
  //   This is a defense-in-depth BACKSTOP, not the enforcing layer.
  // - **Flutter screens (flutter-app-unit):** UX convenience only (hiding the
  //   admin Library controls, hiding the Library itself until its release) —
  //   never relied on for security.
  //
  // ## Why ALL five operations are Lambda-backed
  //
  // The infrastructure specification fixes one shared Lambda for the four
  // S3-touching operations (pre-signed URLs and `DeleteObject` need the AWS
  // SDK, which AppSync's own resolvers do not have). `listDocuments` joins it
  // because the installed `@aws-amplify/data-schema` refuses `allow.guest()`
  // on a no-Lambda custom resolver — the constraint feed-unit hit — and a
  // second resolver style for one operation buys nothing. Recorded as a
  // known deviation in the plan; the infra spec carries an amendment note.
  //
  // ## Generated model operations are disabled
  //
  // `disableOperations(['queries', 'mutations', 'subscriptions'])` keeps the
  // generated `listDocuments`/`getDocument`/`createDocument`/... from
  // colliding with Contract 6's exact operation names and makes the table
  // reachable solely through the five operations below.
  //
  // ## Fields and index
  //
  // Exactly `entities.md`. `uploadedAt` is declared explicitly and set by the
  // Lambda (the model's generated mutations are disabled) so it can be the
  // sort key of `categoryIndex` (`category`, sorted by `uploadedAt`) — added
  // at Code Generation beyond the infra spec so "browse by category" is a
  // Query, not a filtered Scan (plan "Known deviations"). The `@model`
  // transformer still adds its implicit non-null `createdAt`/`updatedAt` to
  // the GraphQL type; the Lambda's repository writes both so a client that
  // selects them never sees a null.
  //
  // NFR4.1: the `Document` table uses AWS-managed encryption at rest; AppSync
  // is HTTPS-only. The PDF bytes themselves live in the `defineStorage`
  // bucket (`amplify/storage/resource.ts`), never in this table.

  DocumentCategory: a.enum([...DOCUMENT_CATEGORIES]),

  Document: a
    .model({
      title: a.string().required(),
      category: a.ref('DocumentCategory').required(),
      s3Key: a.string().required(),
      uploadedByGoogleId: a.string().required(),
      uploadedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('category').sortKeys(['uploadedAt']).name(DOCUMENT_CATEGORY_INDEX),
    ])
    .disableOperations(['queries', 'mutations', 'subscriptions'])
    .authorization((allow) => [
      allow.guest().to(['read']),
      allow.authenticated().to(['read']),
      allow.group('Admin'),
    ]),

  // Contract 6: what `createDocumentUploadUrl` returns — a pre-signed PUT
  // hand-off plus the key the client echoes back to `confirmDocumentUpload`.
  DocumentUploadTarget: a.customType({
    uploadUrl: a.url().required(),
    s3Key: a.string().required(),
  }),

  // --- Contract 6: public reads (BR6.5; FR6.1) — guest + authenticated ------
  listDocuments: a
    .query()
    .arguments({ category: a.ref('DocumentCategory') })
    .returns(a.ref('Document').required().array().required())
    .authorization((allow) => [allow.guest(), allow.authenticated()])
    .handler(a.handler.function(documentApi)),

  getDocumentDownloadUrl: a
    .query()
    .arguments({ id: a.id().required() })
    .returns(a.url().required())
    .authorization((allow) => [allow.guest(), allow.authenticated()])
    .handler(a.handler.function(documentApi)),

  // --- Contract 6: admin-only (BR6.3; FR6.2) — `allow.group('Admin')` is the
  // enforcing layer; the Lambda's own group check is a backstop. -------------
  createDocumentUploadUrl: a
    .mutation()
    .arguments({
      title: a.string().required(),
      category: a.ref('DocumentCategory').required(),
    })
    .returns(a.ref('DocumentUploadTarget').required())
    .authorization((allow) => [allow.group('Admin')])
    .handler(a.handler.function(documentApi)),

  confirmDocumentUpload: a
    .mutation()
    .arguments({
      s3Key: a.string().required(),
      title: a.string().required(),
      category: a.ref('DocumentCategory').required(),
    })
    .returns(a.ref('Document').required())
    .authorization((allow) => [allow.group('Admin')])
    .handler(a.handler.function(documentApi)),

  deleteDocument: a
    .mutation()
    .arguments({ id: a.id().required() })
    .returns(a.id().required())
    .authorization((allow) => [allow.group('Admin')])
    .handler(a.handler.function(documentApi)),

  // ==========================================================================
  // suggestion-unit (U3) — the `Suggestion` entity, the internal
  // `SuggestionDailyCount` counter and Contract 4
  // ==========================================================================
  //
  // ## Suggestion — who enforces what (project.md Correction: never leave implicit)
  //
  // - **Model authorization (declarative, server-side, AppSync) — THE
  //   enforcing layer for BR3.3:** `Suggestion` carries owner-READ matched on
  //   `submittedByGoogleId` against the JWT's `sub` claim, plus Admin-group
  //   READ. A signed-in user can read only rows whose `submittedByGoogleId`
  //   equals their own `sub`; an Admin can read every row; nobody else can
  //   read anything. NO rule grants create/update/delete to anyone: every
  //   write goes through the `submit-suggestion` Lambda via IAM, and there is
  //   no delete path at all (BR3.4) and no read/resolved field or mutation
  //   (BR3.6).
  // - **Operation authorization (declarative, server-side, AppSync):**
  //   `submitSuggestion` and `myPastSuggestions` carry `allow.authenticated()`
  //   (BR3.2 — a caller without a Cognito User Pool JWT is refused before any
  //   resolver runs); `allSuggestions` carries `allow.group('Admin')` ONLY, so
  //   AppSync rejects any caller whose `cognito:groups` claim (Contract 2)
  //   lacks "Admin" before the Lambda runs.
  // - **In-Lambda checks (`functions/submit-suggestion`, `functions/all-suggestions`):**
  //   `submit-suggestion` reads the caller's `sub` ONLY from the verified
  //   `event.identity` and refuses an event without one; `all-suggestions`
  //   re-checks the Admin group. Both are defense-in-depth BACKSTOPS, not the
  //   enforcing layer.
  // - **`myPastSuggestions` resolver (`suggestion-resolvers/myPastSuggestions.js`):**
  //   keys its Query on `ctx.identity.sub`, never on an argument, so no other
  //   user's rows can even be requested; the owner rule above is still the
  //   layer that enforces it.
  // - **Flutter screens (flutter-app-unit):** UX convenience only.
  //
  // ## Generated model operations are disabled
  //
  // `disableOperations(['queries', 'mutations', 'subscriptions'])` on BOTH
  // models keeps the generated `listSuggestions`/`createSuggestion`/... from
  // colliding with Contract 4's exact names, makes the `Suggestion` table
  // reachable solely through the three operations below, and leaves the
  // counter table with NO client operation at all.
  //
  // ## Fields and index
  //
  // `Suggestion` is exactly `entities.md` — `id` (the identifier, named as
  // Contract 4 names it), `submittedByGoogleId`, `text` (up to 300 WORDS,
  // BR3.1, enforced in the Lambda), `submittedAt` (declared explicitly so it
  // can be the sort key of `submitterIndex`). No `deletedAt`, no status.
  // `submitterIndex` (`submittedByGoogleId`, sorted by `submittedAt`) makes
  // `myPastSuggestions` an owner-keyed Query, newest first.
  //
  // `SuggestionDailyCount` (NFR-RATE.1, BR3.5) is internal bookkeeping, not
  // part of Contract 4: its `id` is `<sub>#<YYYY-MM-DD in Asia/Kolkata>`,
  // `count` is the atomic conditional-increment target and `ttl` the DynamoDB
  // Time-to-Live attribute `amplify/backend.ts` enables. It is modeled here so
  // Amplify provisions the table; its only rule is Admin READ (for console
  // inspection), the Lambda writes through IAM.
  //
  // NFR4.1 / project.md Mandated: suggestion text is personal data — both
  // tables use AWS-managed encryption at rest; AppSync is HTTPS-only; the
  // Lambdas never log the text.

  Suggestion: a
    .model({
      submittedByGoogleId: a.string().required(),
      text: a.string().required(),
      submittedAt: a.datetime().required(),
    })
    .secondaryIndexes((index) => [
      index('submittedByGoogleId').sortKeys(['submittedAt']).name(SUGGESTION_SUBMITTER_INDEX),
    ])
    .disableOperations(['queries', 'mutations', 'subscriptions'])
    // BR3.3 (enforcing layer): owner READ + Admin READ. No write rule for
    // anyone (BR3.4: no delete; writes only via the Lambda's IAM role).
    .authorization((allow) => [
      allow.ownerDefinedIn('submittedByGoogleId').identityClaim('sub').to(['read']),
      allow.group('Admin').to(['read']),
    ]),

  // Internal per-user-per-IST-day counter (BR3.5, NFR-RATE.1). No client
  // operation exists for it; Admin READ only so it can be inspected.
  SuggestionDailyCount: a
    .model({
      count: a.integer().required(),
      ttl: a.integer().required(),
    })
    .disableOperations(['queries', 'mutations', 'subscriptions'])
    .authorization((allow) => [allow.group('Admin').to(['read'])]),

  // --- Contract 4: any signed-in user (BR3.2) ------------------------------
  submitSuggestion: a
    .mutation()
    .arguments({ text: a.string().required() })
    .returns(a.ref('Suggestion').required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(submitSuggestion)),

  // Direct AppSync JS resolver on the Suggestion table (infrastructure-
  // specification.md): a Query on `submitterIndex` keyed on the caller's own
  // `sub`, newest first. The model's owner rule is the enforcing layer.
  myPastSuggestions: a
    .query()
    .returns(a.ref('Suggestion').required().array().required())
    .authorization((allow) => [allow.authenticated()])
    .handler(
      a.handler.custom({
        dataSource: a.ref('Suggestion'),
        entry: './suggestion-resolvers/myPastSuggestions.js',
      }),
    ),

  // --- Contract 4: admin-only (BR3.3) — `allow.group('Admin')` is the
  // enforcing layer; the Lambda's own group check is a backstop. -------------
  allSuggestions: a
    .query()
    .returns(a.ref('Suggestion').required().array().required())
    .authorization((allow) => [allow.group('Admin')])
    .handler(a.handler.function(allSuggestions)),
};

// Contract 3, second consumer (BR7.1): the `reminder-api` Lambda calls
// `listPosts` over IAM during a `myReminders` sync. This schema-level
// `allow.resource()` makes Amplify grant it `appsync:GraphQL` on Query
// fields and set `AMPLIFY_DATA_GRAPHQL_ENDPOINT` in its environment. Model-
// and operation-level rules above are untouched by it.
// No schema-level `allow.resource(...)` grant: Amplify's `allow.resource(fn)`
// attaches `appsync:GraphQL` on `types/Query/*` — EVERY query in this shared
// backend, admin-only ones included (Code Generation review R-01). reminder-api
// needs exactly one field (`listPosts`), so `backend.ts` grants that single
// field ARN explicitly and injects the endpoint env var itself.
export const schema = a.schema(schemaDefinitions);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
