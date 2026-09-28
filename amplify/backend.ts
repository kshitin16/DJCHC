/**
 * Amplify Gen2 backend composition root for the Sarovar Jinalaya app.
 *
 * Every backend Unit registers its resource here. auth-unit (U1) is the first;
 * later Units add `data`, `storage` and `functions` alongside it.
 *
 * After `defineBackend`, this file applies auth-unit's explicit Cognito policy
 * (see `./auth/token-policy`) to the underlying L1 CloudFormation resources:
 *
 * - App Client token lifetimes (BR1.3 / NFR3.1 / security-design.md): 1-hour
 *   access + ID tokens, 30-day refresh token — set explicitly rather than
 *   relying on Cognito defaults, because the <= 1-hour admin-revocation window
 *   depends on them.
 * - App Client stays PUBLIC (NFR3.1): `GenerateSecret` is pinned to `false`, so
 *   the mobile app signs in with Authorization Code + PKCE and never embeds a
 *   client secret.
 * - User Pool self-registration is disabled (`AllowAdminCreateUserOnly = true`,
 *   BR1.1 / BR1.4): `defineAuth` needs an email sign-in attribute on the pool,
 *   but nobody may create an email/password account. Google-federated users are
 *   still created automatically by the federation flow — this only closes the
 *   email/password path.
 *
 * donation-unit (U4) adds, after the auth block below:
 * - `data` — the shared Amplify Data schema (`./data/resource`), introduced by
 *   this Unit with the `Donation` model; other Units add their models to it.
 * - `donationApi`, `donationWebhook`, `donationReconciler` — the three
 *   donation Lambdas, each granted a least-privilege policy on the `Donation`
 *   table (infrastructure-specification.md) and told its name.
 * - PITR on the `Donation` table (NFR2.3 / infra spec "financial-record stakes").
 * - The webhook's public Function URL (auth NONE; the aggregator's HMAC
 *   signature is the real authentication — security-design.md), exported as
 *   the `donationWebhookUrl` custom output to register with the aggregator.
 *
 * feed-unit (U2) adds, after the donation block:
 * - DynamoDB Streams on the `Post` table with `NEW_AND_OLD_IMAGES` (Contract 8,
 *   `feed-unit/nfr-design/security-design.md`): reminder-unit's handler needs
 *   the OLD image to see `deletedAt` go from absent to set. feed-unit owns only
 *   the stream; the consuming event-source mapping is reminder-unit's.
 * - `feedApi` — the one feed-unit Lambda (plan Revision 2): the public
 *   `listPosts` query, granted `dynamodb:Scan` on the `Post` table only and
 *   told its name. The five admin operations are AppSync JS resolvers
 *   declared in `./data/resource.ts` and need no wiring here.
 *
 * pdf-library-unit (U5) adds, after the feed block:
 * - `storage` — the project's first S3 bucket (`./storage/resource`), holding
 *   the library's PDFs. Hardened here on the L1 bucket per security-design.md:
 *   `BlockPublicAccess.BLOCK_ALL` (NFR-SEC.1.2), SSE-S3 default encryption
 *   (NFR4.1), and `AbortIncompleteMultipartUpload` after 7 days. Versioning
 *   stays OFF (BR6.4 hard delete).
 * - `documentApi` — the one pdf-library Lambda backing all five Contract 6
 *   operations, granted least-privilege S3 access on `documents/*` only and
 *   the exact DynamoDB actions the infrastructure specification lists on the
 *   `Document` table (+ `categoryIndex`), and told both resource names.
 *   Permission changes here fall under project.md's self-review mandate.
 *
 * suggestion-unit (U3) adds, after the pdf-library block:
 * - TTL on the `SuggestionDailyCount` table (attribute `ttl`, NFR-RATE.1 /
 *   security-design.md): the per-user-per-IST-day rate-limit counters expire
 *   on their own; no delete code, no write cost.
 * - PITR on the `Suggestion` table (reliability-design.md: permanent
 *   user-submitted records, BR3.4 — same posture as `Donation`). The counter
 *   table is regenerable bookkeeping and gets no PITR.
 * - `submitSuggestion` — `dynamodb:UpdateItem` on the counter table ONLY (the
 *   atomic BR3.5 increment), `dynamodb:PutItem` on the `Suggestion` table
 *   ONLY, and `cloudwatch:PutMetricData` restricted by the
 *   `cloudwatch:namespace` condition key to this Unit's namespace (the
 *   action has no resource-level ARN to scope to). Told both table names.
 * - `allSuggestions` — `dynamodb:Scan` on the `Suggestion` table ONLY. Told
 *   the table name. `myPastSuggestions` is an AppSync JS resolver declared in
 *   `./data/resource.ts` and needs no wiring here.
 *   Permission changes here fall under project.md's self-review mandate.
 *
 * reminder-unit (U7) adds, after the suggestion block:
 * - PITR on the `Reminder` and `DeviceToken` tables (reliability-design.md).
 * - An EventBridge Scheduler GROUP (`CfnScheduleGroup`) holding every
 *   one-time `fire-<id>` / `clear-<id>` schedule, and the scheduler EXECUTION
 *   ROLE trusted by `scheduler.amazonaws.com` with `lambda:InvokeFunction` on
 *   exactly `deliver-push` and `auto-clear` (security-design.md — never a
 *   wildcard invoke grant).
 * - The Contract 8 event-source mapping: `DynamoEventSource` from feed-unit's
 *   `Post` table stream onto `reminder-stream-handler` (LATEST, batch 10,
 *   bisect on error, 3 retries, partial-batch failure reporting).
 * - Least-privilege IAM per function (the R-04 `ownerIndex` / `postIdIndex`
 *   Queries are index-scoped), `iam:PassRole` on the scheduler role for
 *   `reminder-api` (required to create schedules that assume it), and every
 *   env var the four Lambdas read. `reminder-api`'s access to `listPosts`
 *   (Contract 3) is an explicit `appsync:GraphQL` grant on that ONE field's
 *   ARN plus `AMPLIFY_DATA_GRAPHQL_ENDPOINT` set here — not the schema-level
 *   `allow.resource(fn)`, which grants `types/Query/*` (every query in the
 *   shared backend, admin-only ones included; review R-01). Permission
 *   changes here fall under project.md's self-review mandate.
 */
import { Duration, Stack } from 'aws-cdk-lib';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { FunctionUrlAuthType, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { CfnScheduleGroup } from 'aws-cdk-lib/aws-scheduler';
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { selfSignUpDisabled, tokenPolicy } from './auth/token-policy';
import { data } from './data/resource';
import { postStreamViewTypeCdk } from './data/post-shared/post-table-config';
import { DOCUMENT_KEY_PREFIX } from './functions/document-shared/constants';
import { documentApi } from './functions/document-api/resource';
import { donationApi } from './functions/donation-api/resource';
import { donationReconciler } from './functions/donation-reconciler/resource';
import { donationWebhook } from './functions/donation-webhook/resource';
import { feedApi } from './functions/feed-api/resource';
import { autoClear } from './functions/auto-clear/resource';
import { deliverPush } from './functions/deliver-push/resource';
import { reminderApi } from './functions/reminder-api/resource';
import {
  AUTO_CLEAR_ARN_ENV,
  DELIVER_PUSH_ARN_ENV,
  DEVICE_TOKEN_OWNER_INDEX,
  GRAPHQL_ENDPOINT_ENV,
  DEVICE_TOKEN_TABLE_ENV,
  REMINDER_METRIC_NAMESPACE,
  REMINDER_OWNER_INDEX,
  REMINDER_POST_INDEX,
  REMINDER_TABLE_ENV,
  SCHEDULE_GROUP_ENV,
  SCHEDULER_ROLE_ARN_ENV,
} from './functions/reminder-shared/constants';
import { reminderStreamHandler } from './functions/reminder-stream-handler/resource';
import { allSuggestions } from './functions/all-suggestions/resource';
import { submitSuggestion } from './functions/submit-suggestion/resource';
import { SUGGESTION_METRIC_NAMESPACE } from './functions/suggestion-shared/metrics';
import {
  SUGGESTION_DAILY_COUNT_TABLE_ENV,
  SUGGESTION_TABLE_ENV,
} from './functions/suggestion-shared/types';
import { storage } from './storage/resource';

export const backend = defineBackend({
  auth,
  data,
  storage,
  donationApi,
  donationWebhook,
  donationReconciler,
  feedApi,
  documentApi,
  submitSuggestion,
  allSuggestions,
  reminderApi,
  reminderStreamHandler,
  deliverPush,
  autoClear,
});

const { cfnUserPool, cfnUserPoolClient } = backend.auth.resources.cfnResources;

// --- App Client: token lifetimes (BR1.3, NFR3.1) ---------------------------
cfnUserPoolClient.accessTokenValidity = tokenPolicy.accessTokenValidity;
cfnUserPoolClient.idTokenValidity = tokenPolicy.idTokenValidity;
cfnUserPoolClient.refreshTokenValidity = tokenPolicy.refreshTokenValidity;
cfnUserPoolClient.tokenValidityUnits = tokenPolicy.tokenValidityUnits;

// --- App Client: PUBLIC client, PKCE (NFR3.1) ------------------------------
// Fail fast at synth time if anything upstream ever turns on a client secret:
// a secret inside a distributed mobile binary is extractable, and the Flutter
// client (flutter-app-unit) is built for the secret-less PKCE flow.
if (cfnUserPoolClient.generateSecret === true) {
  throw new Error(
    'auth-unit: the Cognito App Client must be PUBLIC (no client secret) for the ' +
      'Authorization Code + PKCE flow (NFR3.1); GenerateSecret was set to true.',
  );
}
cfnUserPoolClient.generateSecret = false;

// --- User Pool: no self-registration (BR1.1, BR1.4) ------------------------
// Merge into whatever `defineAuth` already placed on AdminCreateUserConfig
// (e.g. the invite message template) rather than replacing it wholesale.
const existingAdminCreateUserConfig = cfnUserPool.adminCreateUserConfig;
cfnUserPool.adminCreateUserConfig = {
  ...(isPlainObject(existingAdminCreateUserConfig) ? existingAdminCreateUserConfig : {}),
  allowAdminCreateUserOnly: selfSignUpDisabled,
};

/** True for a plain property bag, false for `undefined` or a CDK `IResolvable` token. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !('resolve' in value && typeof (value as { resolve: unknown }).resolve === 'function')
  );
}

// ===========================================================================
// donation-unit (U4)
// ===========================================================================

const donationTable = backend.data.resources.tables['Donation'];
if (!donationTable) {
  throw new Error('donation-unit: the Donation model is missing from the Amplify Data schema');
}

// Amplify exports the model table as `Table.fromTableAttributes` WITHOUT index
// permissions, so `grantReadWriteData` would not cover `statusIndex` /
// `donorIndex`. Grant each Lambda exactly the actions the infrastructure
// specification lists, on the table AND its indexes.
const donationTableAndIndexes = [donationTable.tableArn, `${donationTable.tableArn}/index/*`];

const donationFunctions = [
  {
    fn: backend.donationApi,
    actions: ['dynamodb:PutItem', 'dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:UpdateItem'],
  },
  { fn: backend.donationWebhook, actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'] },
  { fn: backend.donationReconciler, actions: ['dynamodb:Query', 'dynamodb:UpdateItem'] },
];

for (const { fn, actions } of donationFunctions) {
  fn.resources.lambda.addToRolePolicy(
    new PolicyStatement({ actions, resources: donationTableAndIndexes }),
  );
  fn.addEnvironment('DONATION_TABLE_NAME', donationTable.tableName);
}

// --- Donation table: Point-in-Time Recovery (NFR2.3, infra spec) ----------
// Encryption at rest is AWS-managed by default on Amplify Data tables (NFR4.1).
const donationTableWrapper = backend.data.resources.cfnResources.amplifyDynamoDbTables['Donation'];
if (!donationTableWrapper) {
  throw new Error('donation-unit: cannot enable PITR — the Donation table wrapper was not found');
}
donationTableWrapper.pointInTimeRecoveryEnabled = true;

// --- Webhook Function URL (Contract 7) -------------------------------------
// Auth NONE is deliberate (security-design.md "Webhook endpoint security"):
// the aggregator cannot sign SigV4 requests; the handler's HMAC check is the
// authentication. Flagged here as the one endpoint that bypasses Cognito.
const donationWebhookUrl = backend.donationWebhook.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

backend.addOutput({
  custom: {
    // Register this URL with the aggregator as its payment-status webhook target.
    donationWebhookUrl: donationWebhookUrl.url,
  },
});

// ===========================================================================
// feed-unit (U2)
// ===========================================================================

// --- Post table: DynamoDB Streams, NEW_AND_OLD_IMAGES (Contract 8) ---------
// Load-bearing for reminder-unit's `PostDeleted` detection: a soft delete is
// a MODIFY record (never REMOVE), recognisable only by diffing OLD vs NEW
// `deletedAt`. Encryption at rest stays AWS-managed (NFR4.1); no PITR here —
// posts are public announcements, not financial records.
const postTableWrapper = backend.data.resources.cfnResources.amplifyDynamoDbTables['Post'];
if (!postTableWrapper) {
  throw new Error('feed-unit: cannot enable Streams — the Post table wrapper was not found');
}
postTableWrapper.streamSpecification = { streamViewType: postStreamViewTypeCdk };

// --- feed-api Lambda: least-privilege read of the Post table ---------------
// `listPosts` only ever Scans the table (no index, no writes), so that is the
// whole grant. The admin operations never pass through this function.
const postTable = backend.data.resources.tables['Post'];
if (!postTable) {
  throw new Error('feed-unit: the Post model is missing from the Amplify Data schema');
}
backend.feedApi.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['dynamodb:Scan'], resources: [postTable.tableArn] }),
);
backend.feedApi.addEnvironment('POST_TABLE_NAME', postTable.tableName);

// ===========================================================================
// pdf-library-unit (U5)
// ===========================================================================

// --- Documents bucket: hardening (security-design.md, NFR-SEC.1.2, NFR4.1) --
// `defineStorage` already gives versioning OFF and `enforceSSL`. The rest is
// pinned explicitly on the L1 bucket rather than trusting S3 account defaults.
const documentBucket = backend.storage.resources.bucket;
const { cfnBucket: documentCfnBucket } = backend.storage.resources.cfnResources;
if (documentCfnBucket.versioningConfiguration !== undefined) {
  // BR6.4 hard delete depends on versioning staying off; fail fast if anything
  // upstream ever turns it on (a deleted PDF would silently become recoverable).
  throw new Error('pdf-library-unit: the documents bucket must not be versioned (BR6.4)');
}
documentCfnBucket.publicAccessBlockConfiguration = {
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
};
documentCfnBucket.bucketEncryption = {
  serverSideEncryptionConfiguration: [
    { serverSideEncryptionByDefault: { sseAlgorithm: 'AES256' } },
  ],
};
if (documentBucket instanceof Bucket) {
  documentBucket.addLifecycleRule({ abortIncompleteMultipartUploadAfter: Duration.days(7) });
} else {
  documentCfnBucket.lifecycleConfiguration = {
    rules: [{ status: 'Enabled', abortIncompleteMultipartUpload: { daysAfterInitiation: 7 } }],
  };
}
// --- document-api Lambda: least-privilege S3 + DynamoDB -------------------
// S3: signing a PUT/GET needs the matching object permission on the role that
// signs; `HeadObject` is covered by `s3:GetObject`; `DeleteObject` serves both
// BR6.2's non-PDF cleanup and BR6.4. Scoped to the `documents/` prefix only —
// the same prefix `parseS3Key` refuses to step outside of.
const documentTable = backend.data.resources.tables['Document'];
if (!documentTable) {
  throw new Error('pdf-library-unit: the Document model is missing from the Amplify Data schema');
}
backend.documentApi.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['s3:PutObject', 's3:GetObject', 's3:DeleteObject'],
    resources: [`${documentBucket.bucketArn}/${DOCUMENT_KEY_PREFIX}*`],
  }),
);
// DynamoDB: exactly the infra spec's list (GetItem, PutItem, DeleteItem) plus
// Query (on `categoryIndex`) and Scan for the public `listDocuments`.
backend.documentApi.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:DeleteItem',
      'dynamodb:Query',
      'dynamodb:Scan',
    ],
    resources: [documentTable.tableArn, `${documentTable.tableArn}/index/*`],
  }),
);
backend.documentApi.addEnvironment('DOCUMENT_TABLE_NAME', documentTable.tableName);
backend.documentApi.addEnvironment('DOCUMENT_BUCKET_NAME', documentBucket.bucketName);

// ===========================================================================
// suggestion-unit (U3)
// ===========================================================================

const suggestionTable = backend.data.resources.tables['Suggestion'];
const suggestionDailyCountTable = backend.data.resources.tables['SuggestionDailyCount'];
if (!suggestionTable || !suggestionDailyCountTable) {
  throw new Error(
    'suggestion-unit: the Suggestion / SuggestionDailyCount models are missing from the Amplify Data schema',
  );
}

// --- SuggestionDailyCount table: TTL on `ttl` (NFR-RATE.1, security-design.md)
// Each counter row carries `ttl` = next IST midnight + 48h (epoch seconds),
// set by the same atomic UpdateItem that increments it; DynamoDB's sweep
// removes expired rows for free. Encryption at rest stays AWS-managed (NFR4.1).
const suggestionDailyCountWrapper =
  backend.data.resources.cfnResources.amplifyDynamoDbTables['SuggestionDailyCount'];
if (!suggestionDailyCountWrapper) {
  throw new Error(
    'suggestion-unit: cannot enable TTL — the SuggestionDailyCount table wrapper was not found',
  );
}
suggestionDailyCountWrapper.timeToLiveAttribute = { attributeName: 'ttl', enabled: true };

// --- Suggestion table: Point-in-Time Recovery (reliability-design.md, NFR2.3)
// Suggestions are permanent (BR3.4) and personal data; PITR matches `Donation`.
const suggestionTableWrapper =
  backend.data.resources.cfnResources.amplifyDynamoDbTables['Suggestion'];
if (!suggestionTableWrapper) {
  throw new Error(
    'suggestion-unit: cannot enable PITR — the Suggestion table wrapper was not found',
  );
}
suggestionTableWrapper.pointInTimeRecoveryEnabled = true;

// --- submit-suggestion Lambda: least privilege (infrastructure-specification.md)
// Exactly the three actions the workflow performs, each on its own resource.
// `cloudwatch:PutMetricData` has no ARN to scope to; the namespace condition
// key is the narrowest available restriction.
backend.submitSuggestion.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:UpdateItem'],
    resources: [suggestionDailyCountTable.tableArn],
  }),
);
backend.submitSuggestion.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['dynamodb:PutItem'], resources: [suggestionTable.tableArn] }),
);
backend.submitSuggestion.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cloudwatch:PutMetricData'],
    resources: ['*'],
    conditions: { StringEquals: { 'cloudwatch:namespace': SUGGESTION_METRIC_NAMESPACE } },
  }),
);
backend.submitSuggestion.addEnvironment(SUGGESTION_TABLE_ENV, suggestionTable.tableName);
backend.submitSuggestion.addEnvironment(
  SUGGESTION_DAILY_COUNT_TABLE_ENV,
  suggestionDailyCountTable.tableName,
);

// --- all-suggestions Lambda: read-only Scan of the Suggestion table --------
backend.allSuggestions.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['dynamodb:Scan'], resources: [suggestionTable.tableArn] }),
);
backend.allSuggestions.addEnvironment(SUGGESTION_TABLE_ENV, suggestionTable.tableName);

// ===========================================================================
// reminder-unit (U7)
// ===========================================================================

const reminderTable = backend.data.resources.tables['Reminder'];
const deviceTokenTable = backend.data.resources.tables['DeviceToken'];
if (!reminderTable || !deviceTokenTable) {
  throw new Error(
    'reminder-unit: the Reminder / DeviceToken models are missing from the Amplify Data schema',
  );
}

// --- Reminder + DeviceToken tables: Point-in-Time Recovery (reliability-design.md)
// Encryption at rest stays AWS-managed (NFR4.1).
for (const modelName of ['Reminder', 'DeviceToken']) {
  const wrapper = backend.data.resources.cfnResources.amplifyDynamoDbTables[modelName];
  if (!wrapper) {
    throw new Error(
      `reminder-unit: cannot enable PITR — the ${modelName} table wrapper was not found`,
    );
  }
  wrapper.pointInTimeRecoveryEnabled = true;
}

// --- EventBridge Scheduler: dedicated group + execution role (NFR-PERF.3) --
// Lives in the data stack with the four Lambdas (all `resourceGroupName:
// 'data'`), so no cross-stack reference is introduced. The group name is
// unique per environment through the stack name.
const reminderStack = Stack.of(backend.reminderApi.resources.lambda);
const reminderScheduleGroupName = `reminder-unit-schedules-${reminderStack.stackName}`;
const reminderScheduleGroup = new CfnScheduleGroup(reminderStack, 'ReminderScheduleGroup', {
  name: reminderScheduleGroupName,
});
const reminderScheduleGroupArn = reminderStack.formatArn({
  service: 'scheduler',
  resource: 'schedule',
  resourceName: `${reminderScheduleGroupName}/*`,
});

// The role EventBridge Scheduler assumes to invoke a target: exactly the two
// target Lambdas, nothing else (security-design.md — no wildcard invoke).
const reminderSchedulerRole = new Role(reminderStack, 'ReminderSchedulerRole', {
  assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
  description: 'reminder-unit: lets EventBridge Scheduler invoke deliver-push and auto-clear',
});
reminderSchedulerRole.addToPolicy(
  new PolicyStatement({
    actions: ['lambda:InvokeFunction'],
    resources: [
      backend.deliverPush.resources.lambda.functionArn,
      backend.autoClear.resources.lambda.functionArn,
    ],
  }),
);

// --- reminder-api Lambda: the five Contract 9 operations ------------------
// DynamoDB: index-scoped Queries (R-04) plus the single-item actions the
// operations perform; Scheduler: create/update/delete inside this Unit's
// group only; `iam:PassRole` so `CreateSchedule` may name the scheduler role.
backend.reminderApi.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Query'],
    resources: [
      `${reminderTable.tableArn}/index/${REMINDER_OWNER_INDEX}`,
      `${reminderTable.tableArn}/index/${REMINDER_POST_INDEX}`,
      `${deviceTokenTable.tableArn}/index/${DEVICE_TOKEN_OWNER_INDEX}`,
    ],
  }),
);
backend.reminderApi.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
    resources: [reminderTable.tableArn, deviceTokenTable.tableArn],
  }),
);
backend.reminderApi.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['scheduler:CreateSchedule', 'scheduler:UpdateSchedule', 'scheduler:DeleteSchedule'],
    resources: [reminderScheduleGroupArn],
  }),
);
backend.reminderApi.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['iam:PassRole'],
    resources: [reminderSchedulerRole.roleArn],
    conditions: { StringEquals: { 'iam:PassedToService': 'scheduler.amazonaws.com' } },
  }),
);
// AppSync: `listPosts` only (Contract 3). `allow.resource(fn)` would grant
// `types/Query/*`; this names the single field ARN instead (review R-01).
// Amplify's IAM authorization mode lets any principal holding this permission
// call the field, so the policy below IS the whole gate — keep it narrow.
const graphqlApi = backend.data.resources.graphqlApi;
backend.reminderApi.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['appsync:GraphQL'],
    resources: [`${graphqlApi.arn}/types/Query/fields/listPosts`],
  }),
);
backend.reminderApi.addEnvironment(
  GRAPHQL_ENDPOINT_ENV,
  backend.data.resources.cfnResources.cfnGraphqlApi.attrGraphQlUrl,
);
backend.reminderApi.addEnvironment(REMINDER_TABLE_ENV, reminderTable.tableName);
backend.reminderApi.addEnvironment(DEVICE_TOKEN_TABLE_ENV, deviceTokenTable.tableName);
backend.reminderApi.addEnvironment(SCHEDULE_GROUP_ENV, reminderScheduleGroupName);
backend.reminderApi.addEnvironment(SCHEDULER_ROLE_ARN_ENV, reminderSchedulerRole.roleArn);
backend.reminderApi.addEnvironment(
  DELIVER_PUSH_ARN_ENV,
  backend.deliverPush.resources.lambda.functionArn,
);
backend.reminderApi.addEnvironment(
  AUTO_CLEAR_ARN_ENV,
  backend.autoClear.resources.lambda.functionArn,
);

// --- reminder-stream-handler Lambda: Contract 8 consumer (BR7.9, BR7.10) ---
// The event source grants the stream read/describe permissions itself.
backend.reminderStreamHandler.resources.lambda.addEventSource(
  new DynamoEventSource(postTable, {
    startingPosition: StartingPosition.LATEST,
    batchSize: 10,
    bisectBatchOnError: true,
    retryAttempts: 3,
    reportBatchItemFailures: true,
  }),
);
backend.reminderStreamHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Query'],
    resources: [`${reminderTable.tableArn}/index/${REMINDER_POST_INDEX}`],
  }),
);
backend.reminderStreamHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['dynamodb:UpdateItem'], resources: [reminderTable.tableArn] }),
);
backend.reminderStreamHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['scheduler:DeleteSchedule'],
    resources: [reminderScheduleGroupArn],
  }),
);
backend.reminderStreamHandler.addEnvironment(REMINDER_TABLE_ENV, reminderTable.tableName);
backend.reminderStreamHandler.addEnvironment(SCHEDULE_GROUP_ENV, reminderScheduleGroupName);

// --- deliver-push Lambda: FCM push + FIRED transition (BR7.11) -------------
// `cloudwatch:PutMetricData` has no ARN to scope to; the namespace condition
// key is the narrowest available restriction (as in suggestion-unit).
backend.deliverPush.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
    resources: [reminderTable.tableArn],
  }),
);
backend.deliverPush.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Query'],
    resources: [`${deviceTokenTable.tableArn}/index/${DEVICE_TOKEN_OWNER_INDEX}`],
  }),
);
backend.deliverPush.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cloudwatch:PutMetricData'],
    resources: ['*'],
    conditions: { StringEquals: { 'cloudwatch:namespace': REMINDER_METRIC_NAMESPACE } },
  }),
);
backend.deliverPush.addEnvironment(REMINDER_TABLE_ENV, reminderTable.tableName);
backend.deliverPush.addEnvironment(DEVICE_TOKEN_TABLE_ENV, deviceTokenTable.tableName);

// --- auto-clear Lambda: CLEARED transition (BR7.4) --------------------------
backend.autoClear.resources.lambda.addToRolePolicy(
  new PolicyStatement({ actions: ['dynamodb:UpdateItem'], resources: [reminderTable.tableArn] }),
);
backend.autoClear.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['scheduler:DeleteSchedule'],
    resources: [reminderScheduleGroupArn],
  }),
);
backend.autoClear.addEnvironment(REMINDER_TABLE_ENV, reminderTable.tableName);
backend.autoClear.addEnvironment(SCHEDULE_GROUP_ENV, reminderScheduleGroupName);

// Keep the group resource referenced so a future refactor cannot drop it silently.
void reminderScheduleGroup;
