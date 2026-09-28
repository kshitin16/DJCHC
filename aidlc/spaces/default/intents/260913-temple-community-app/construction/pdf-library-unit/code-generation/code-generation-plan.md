# Code Generation Plan — pdf-library-unit

## Scope

pdf-library-unit (U5, `kind: service`, **later release**) owns the `Document` entity (`entities.md`), the S3 bucket holding the PDF files, and the five Contract 6 operations: public `listDocuments(category)` and `getDocumentDownloadUrl(id)`, admin-only `createDocumentUploadUrl`, `confirmDocumentUpload`, `deleteDocument`. Rules BR6.1–BR6.5 (`rules.md`) and the workflows in `functional-spec.md` are approved; `infrastructure-specification.md` fixes one shared Lambda for the S3-touching operations, a `Document` DynamoDB table, and a locked-down S3 bucket (`BlockPublicAccess.BLOCK_ALL`, SSE-S3, versioning off, abort-incomplete-multipart after 7 days).

**Why a full build, unlike donations:** this Unit has no external vendor and no unconfirmed precondition — everything it needs (S3, DynamoDB, Cognito) already exists in the backend. "Later release" here means only that the app hides the Library screens until the release is ready (`functional-spec.md` of flutter-app-unit: navigation entries feature-flagged on the client). The backend is therefore built complete; no backend flag is needed, and an admin can start uploading documents through the sandbox as soon as it deploys.

This Unit adds `amplify/storage/resource.ts` (the project's first S3 bucket), extends the shared `amplify/data/resource.ts`, and adds one Lambda `amplify/functions/document-api/` backing **all five** operations (see the guest-auth deviation below). Out of scope: `services/pdf_service.dart` and the Library screens (flutter-app-unit).

## Testing Contract

```json
{
  "version": 1,
  "methodology": "test-after",
  "source": "team",
  "ordering": "implement each applicable testable layer, then write and",
  "scope": "temple-mobile-app",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and\n  run that layer's tests, with the walking-skeleton Bolt held to a lighter\n  smoke-level bar across the board — including the admin allowlist gate —\n  and the standard 80% line-coverage floor applying from the second Bolt\n  onward.\n\nAffirmed specifics (Q4-Q7):\n\n- **Test-after, not TDD/BDD** (Q4): writing code first, then its tests,\n  fits a builder who doesn't yet have confidence in the API/widget shapes\n  of either Flutter or Amplify Gen2 — test-first would compound that\n  learning-curve risk.\n- **Walking-skeleton Bolt test rigor: light smoke-level check everywhere in\n  the skeleton, including the admin allowlist gate** (Q5 — Answer A). The\n  quality agent's review recommended a stricter option for the admin gate\n  specifically (a real pass/fail assertion proving non-admins are\n  rejected, since it's a security boundary), but the human deliberately\n  chose the lighter, uniform smoke-level bar for the entire skeleton\n  instead. This is recorded as the builder's considered choice, not an\n  oversight — a proper test for the admin gate's server-side enforcement\n  is expected to land with the fuller coverage floor from the second Bolt\n  onward, once the architecture is proven end-to-end.\n- **Coverage target beyond the skeleton: the org default's 80%\n  line-coverage floor, adopted as-is** (Q6). The quality agent flagged\n  that the 80% floor's applicability was ambiguous under the custom\n  `temple-mobile-app` scope signal (it isn't in the org default's named\n  scope list); the builder resolved this directly by choosing to adopt the\n  80% target rather than a looser or undefined bar.\n- **CI + backend test framework: GitHub Actions with Jest** (Q7). A single\n  GitHub Actions workflow runs on every push/PR to `main`: `flutter\n  analyze` + `flutter test --coverage` on the Flutter app side, and\n  ESLint/`tsc --noEmit` + Jest on the Amplify Gen2/TypeScript backend\n  side (Lambda handlers, AppSync resolver logic) — blocking merge on\n  failure. This is the project's only enforcement mechanism for test\n  quality, since there is no second reviewer to catch a skipped or\n  weakened test. If Amplify Hosting's own build pipeline is used for\n  deploys, a test step must be added to `amplify.yml` deliberately —\n  Amplify Hosting does not run app-level tests by default.\n- Test-type mix (carried forward from the quality agent's contribution,\n  not separately re-asked, since it elaborates rather than contradicts the\n  affirmed methodology): Flutter unit tests for business logic,\n  `flutter_test` widget tests for UI, and `integration_test` for\n  higher-risk end-to-end flows (Cognito/Google-federation sign-in, the\n  admin allowlist gate, and later the donation flow) — integration-level\n  coverage matters more than usual here because a unit test that mocks the\n  Amplify client can pass while the real integration is still broken. On\n  the backend, Jest unit tests for Lambda handlers and schema/contract\n  checks against the AppSync GraphQL schema, exercised against Amplify\n  Gen2's local sandbox (`ampx sandbox`) rather than a live deployed\n  environment."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "test-after",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - implement.",
      "Data model / database behavior - write and run its tests after implementation.",
      "Repository / data access - implement.",
      "Repository / data access - write and run its tests after implementation.",
      "Business logic - implement.",
      "Business logic - write and run its tests after implementation.",
      "API / endpoint - implement.",
      "API / endpoint - write and run its tests after implementation.",
      "Frontend behavior - implement.",
      "Frontend behavior - write and run its tests after implementation.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:817e454c78e3d1ec2c498999a8752124a36e6c73860f504900f17dbf0ec17f6a",
  "contract_sha256": "sha256:322e5d191e27095d9fb5ca26b5cd076c3c99c52b68d46d1e676c77d2a10d3881"
}
```

## Steps

Test-after per the contract; the project-wide 80% line-coverage floor stays in force. Frontend behaviour is omitted (flutter-app-unit).

### Step 1 — Project structure

- [x] 1.1 Add dependencies: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (runtime, for the Lambda). `npm install`. No existing script changes except adding `test:pdf`.
- [x] 1.2 Create `amplify/storage/resource.ts`, `amplify/functions/document-api/`, and `amplify/functions/document-shared/` (repository, S3 adapter, validation, constants).

### Step 2 — Test runner: unit-scoped command

- [x] 2.1 Add script `test:pdf`: `NODE_OPTIONS=--experimental-vm-modules jest --rootDir . amplify/data/document amplify/functions/document`. Verify once with `--passWithNoTests`; the script omits it. `jest.config.ts` unchanged (`coverageThreshold` untouched; `amplify/functions/*/resource.ts` already excluded).

### Step 3 — Data model: `Document` model, S3 bucket, Contract 6 operations

- [x] 3.1 `amplify/storage/resource.ts`: `defineStorage({ name: 'sarovar-jinalaya-documents', access: allow => ({ 'documents/*': [allow.resource(documentApi).to(['read', 'write', 'delete'])] }) })` — only the Lambda may touch objects; no user-facing path grants (every read/write goes through a pre-signed URL the Lambda issues — `infrastructure-specification.md`). In `amplify/backend.ts`: confirm Amplify's defaults give `BlockPublicAccess.BLOCK_ALL` + SSE-S3 + versioning off, and add the lifecycle rule `abortIncompleteMultipartUploadAfter: Duration.days(7)` on `backend.storage.resources.bucket`.
- [x] 3.2 In `amplify/data/resource.ts`: enum `DocumentCategory { DAILY_POOJAN VARIOUS_VIDHAANS BHAKTAMAR }`; model `Document` with `entities.md`'s fields (`title`, `category`, `s3Key`, `uploadedByGoogleId`, `uploadedAt`), generated operations disabled (Contract 6's `listDocuments` name must stay exact), secondary index `categoryIndex` (`category`, sorted by `uploadedAt`) so listing by category is a Query; model auth `allow.guest().to(['read'])`, `allow.authenticated().to(['read'])`, `allow.group('Admin')`. Custom type `DocumentUploadTarget { uploadUrl: AWSURL!, s3Key: String! }`. Five operations, all handled by the `document-api` Lambda (`a.handler.function(documentApi)`):
  - `listDocuments(category: DocumentCategory): [Document!]!` and `getDocumentDownloadUrl(id: ID!): AWSURL!` — `allow.guest()`, `allow.authenticated()` (BR6.5). Lambda-backed because guest auth is refused on no-Lambda custom resolvers in the installed Amplify (the same constraint feed-unit hit) — see deviations.
  - `createDocumentUploadUrl(title: String!, category: DocumentCategory!): DocumentUploadTarget!`, `confirmDocumentUpload(s3Key: String!, title: String!, category: DocumentCategory!): Document!`, `deleteDocument(id: ID!): ID!` — `allow.group('Admin')` only (BR6.3, Contract 2). Names, arguments, returns exactly as Contract 6 (amended).
- [x] 3.3 `npx tsc --noEmit` passes.

### Step 4 — Data model: tests

- [x] 4.1 `amplify/data/document-schema.test.ts` (6): `DocumentCategory` values exact; `Document` fields per `entities.md`; generated operations disabled; `categoryIndex` on `category` sorted by `uploadedAt`; the five operations with Contract 6's exact argument names and return types (`DocumentUploadTarget` fields); guest+authenticated on the two public operations, `Admin` only on the three admin operations.
- [x] 4.2 `amplify/functions/document-shared/constants.ts` exports `UPLOAD_URL_EXPIRES_SECONDS = 900` (15 min) and `DOWNLOAD_URL_EXPIRES_SECONDS = 3600` (1 h) — NFR-SEC.1.1; a 1-test file pins both.

### Step 5 — Repository / data access: implement

- [x] 5.1 `amplify/functions/document-shared/document-repository.ts` (injected document client): `create(doc)`, `getById(id)`, `listByCategory(category)` (Query on `categoryIndex`, follows `LastEvaluatedKey`), `listAll()` (Scan, follows `LastEvaluatedKey`, for a `listDocuments` with no category), `deleteById(id)` (conditional `attribute_exists(id)`). Table name from env `DOCUMENT_TABLE_NAME`.
- [x] 5.2 `amplify/functions/document-shared/s3-adapter.ts` (injected S3 client + presigner): `presignUpload(key)` (PUT, `ContentType: application/pdf`, 15 min), `presignDownload(key)` (GET, 1 h), `headObject(key)` → `{ exists, contentType }`, `deleteObject(key)`. Bucket name from env `DOCUMENT_BUCKET_NAME`.

### Step 6 — Repository / data access: tests

- [x] 6.1 `document-repository.test.ts` (6): create writes all fields + `__typename`; `getById` key; `listByCategory` targets `categoryIndex` and concatenates pages; `listAll` scans and concatenates pages; `deleteById` condition; data-source errors rethrown.
- [x] 6.2 `s3-adapter.test.ts` (5, presigner injected as a fake): upload presign uses PUT with `ContentType: application/pdf` and 900 s; download presign uses GET and 3600 s; `headObject` maps a `NotFound` error to `{ exists: false }`; `headObject` returns the content type; `deleteObject` targets bucket+key.

### Step 7 — Business logic: implement

- [x] 7.1 `amplify/functions/document-shared/validation.ts`: `validateCategory` (BR6.1), `validateTitle` (non-empty, trimmed, ≤ 200 chars — a technical bound, not a business rule; documented), `isPdfContentType(contentType)` (`application/pdf`, case-insensitive; BR6.2), `buildS3Key(category, uuid)` → `documents/<category>/<uuid>.pdf`, `parseS3Key(s3Key)` (rejects keys outside `documents/`, path traversal, or a category the enum does not know — an admin can only confirm keys this Unit issued).

### Step 8 — Business logic: tests

- [x] 8.1 `validation.test.ts` (7): each category accepted, unknown rejected; empty title rejected; PDF content type accepted (case-insensitive), `application/octet-stream` rejected; key shape; `parseS3Key` rejects `../`, non-`documents/` prefixes, and unknown categories.

### Step 9 — API / endpoint: the `document-api` Lambda

- [x] 9.1 `amplify/functions/document-api/resource.ts`: `defineFunction`, 128MB/10s, `resourceGroupName: 'data'`, env `DOCUMENT_TABLE_NAME`, `DOCUMENT_BUCKET_NAME` (injected from `backend.ts`).
- [x] 9.2 `handler.ts` — `createHandler(deps)` factory dispatching on `event.info.fieldName`; identity only from `event.identity` (`sub`, `groups`); admin operations re-check `groups` contains `Admin` as a backstop behind the declarative rule:
  - `listDocuments` → `listByCategory` or `listAll`, sorted by `uploadedAt` desc.
  - `getDocumentDownloadUrl` → `getById` (throw a not-found error if absent) → `presignDownload(s3Key)`.
  - `createDocumentUploadUrl` → validate title/category → `buildS3Key` → `presignUpload` → return `{ uploadUrl, s3Key }`. No record is written yet.
  - `confirmDocumentUpload` → `parseS3Key` → `headObject`: missing → not-found error; non-PDF → `deleteObject` then a validation error (BR6.2); PDF → `create({ id: uuid, title, category, s3Key, uploadedByGoogleId: identity.sub, uploadedAt: now })` and return the `Document`.
  - `deleteDocument` → `getById` (not-found if absent) → `deleteObject(s3Key)` FIRST → `deleteById(id)`; if the record delete fails the error is surfaced so the caller retries (BR6.4's ordering — never a file with no record). Returns the `id`.
- [x] 9.3 `amplify/backend.ts`: add `storage` and `documentApi`; least-privilege IAM for the Lambda — S3 `PutObject`/`GetObject`/`HeadObject`/`DeleteObject` on `arn:…:<bucket>/documents/*` only; DynamoDB `GetItem`/`PutItem`/`DeleteItem`/`Query`/`Scan` on the `Document` table and its `categoryIndex`; inject both env names. Existing wiring untouched.
- [x] 9.4 `npm run lint` and `npm run typecheck` pass.

### Step 10 — API / endpoint: tests

- [x] 10.1 `document-api/handler.test.ts` (12, fake repository + fake S3 adapter): `listDocuments` with category queries the index; without category scans; sorted desc; `getDocumentDownloadUrl` signs the record's `s3Key` and errors on unknown id; `createDocumentUploadUrl` rejects a bad category before presigning, non-admin refused, returns the contract shape with a `documents/<category>/…pdf` key; `confirmDocumentUpload` creates the record with `uploadedByGoogleId` from `identity.sub`, deletes a non-PDF object and throws, errors on a missing object, rejects a key it did not issue; `deleteDocument` deletes S3 before the record, surfaces a record-delete failure after S3 succeeded, non-admin refused.
- [x] 10.2 `npm run test:pdf` green; `npm test -- --coverage` green with the 80% floor; lint, typecheck, prettier clean.

### Omitted layer

- **Frontend behavior**: `services/pdf_service.dart`, the Library and Admin Library screens belong to flutter-app-unit (feature-flagged off in the app until release).

### Step 11 — Environment/build configuration

- [x] 11.1 `README.md`: a "PDF Library" section — the five operations and who may call them, the direct-to-S3 upload flow (get URL → PUT the file → confirm), the 15 min / 1 h URL lifetimes, hard-delete semantics and ordering, the accepted "unconfirmed upload lingers in the bucket" risk from the infra spec, and that the app hides the Library until the release is ready.

### Step 12 — Documentation and traceability

- [x] 12.1 Doc comments naming the rule each piece realizes (BR6.1–BR6.5, NFR-SEC.1.x, NFR-AUTHZ).
- [x] 12.2 Write `source-manifest.json` (every path created or modified; not `node_modules/`).
- [x] 12.3 The conductor writes `code-summary.md` and `traceability.json`.

## Rule-to-step traceability

| Rule / requirement | Realized by |
|---|---|
| BR6.1 fixed categories | 7.1, 8.1, 9.2 |
| BR6.2 PDF check at confirm time | 5.2 `headObject`, 7.1, 9.2 `confirmDocumentUpload`, 10.1 |
| BR6.3 admin-only upload/delete | 3.2 `allow.group('Admin')` (enforcing layer), 9.2 backstop, 10.1 |
| BR6.4 hard delete, S3 first | 9.2 `deleteDocument`, 10.1 |
| BR6.5 public browse/download | 3.2 guest+authenticated, 9.2 |
| NFR-SEC.1.1 URL expirations | 4.2, 5.2, 6.2 |
| NFR-SEC.1.2 bucket locked down | 3.1 |
| NFR4.1 encryption | 3.1 (SSE-S3 default), DynamoDB-managed |
| NFR-AUTHZ / NFR6.1 process controls | README (11.1) |

## Known deviations declared up front

- **`listDocuments` is Lambda-backed** (the infra spec left it as a direct resolver): guest authorization is refused on no-Lambda custom resolvers in the installed Amplify version — the same constraint feed-unit hit — and the design already has one shared Lambda for this Unit, so the public list simply joins it. Infra spec gets an amendment note.
- **`categoryIndex` GSI added** beyond the infra spec so "browse by category" is a Query, not a Scan.
- **No backend feature flag**: unlike donations there is nothing unfinished on the backend side; later-release gating lives in the app's navigation, per flutter-app-unit's functional spec.
- **NFR-OBS.1's custom per-category document-count metric is deferred** (recorded `Deferred` in `traceability.json`); standard Lambda/AppSync metrics exist by default.
