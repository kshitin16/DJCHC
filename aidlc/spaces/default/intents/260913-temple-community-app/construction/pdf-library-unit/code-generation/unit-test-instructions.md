# Unit Test Instructions — pdf-library-unit

## Test framework and setup

- **Framework**: Jest 29 + `ts-jest` (ESM), `testEnvironment: 'node'` — the shared runner in `jest.config.ts`; the project-wide 80% line-coverage floor stays in force and is not changed by this Unit.
- **Install**: `npm install` after plan Step 1.1 adds `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`.
- No AWS credentials, no `ampx sandbox`, no network: the Lambda handler takes its repository and S3 adapter by injection; the repository takes a DynamoDB document client; the S3 adapter takes an S3 client and a presigner function — tests pass fakes for all of them.

## How to run THIS UNIT's tests

Exact, unit-scoped command:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/data/document amplify/functions/document
```

Wired as `npm run test:pdf`. It matches `amplify/data/document-schema.test.ts`, `amplify/functions/document-shared/**`, and `amplify/functions/document-api/**` only. Runnable at plan Step 2.1 (verified once with `--passWithNoTests`; the script omits that flag).

With unit-scoped coverage:

```bash
NODE_OPTIONS=--experimental-vm-modules npx jest --rootDir . amplify/data/document amplify/functions/document --coverage --collectCoverageFrom='amplify/functions/document-*/**/*.ts' --collectCoverageFrom='!amplify/functions/*/resource.ts'
```

Never use a bare `npm test` as this Unit's own verification.

## Test files and cases (37 tests across 6 files)

| File | Tests | Covers |
|---|---|---|
| `amplify/data/document-schema.test.ts` | 6 | `DocumentCategory` values; `Document` fields; generated operations disabled; `categoryIndex`; five Contract 6 operations with exact arguments/returns incl. `DocumentUploadTarget`; guest+authenticated on the two public ops, `Admin` only on the three admin ops |
| `amplify/functions/document-shared/constants.test.ts` | 1 | 900 s upload / 3600 s download URL lifetimes (NFR-SEC.1.1) |
| `amplify/functions/document-shared/document-repository.test.ts` | 6 | Command shapes: create; `getById`; `categoryIndex` query with pagination; scan with pagination; conditional delete; error rethrow |
| `amplify/functions/document-shared/s3-adapter.test.ts` | 5 | PUT presign with `application/pdf` + 900 s; GET presign + 3600 s; `headObject` NotFound → `{ exists: false }`; content type returned; delete targets bucket+key |
| `amplify/functions/document-shared/validation.test.ts` | 7 | BR6.1 categories; title; PDF content type (case-insensitive) vs. non-PDF (BR6.2); key shape; `parseS3Key` rejects traversal, foreign prefixes, unknown categories |
| `amplify/functions/document-api/handler.test.ts` | 12 | All five operations: public list by category / all / sorted; download URL from the record's key + unknown id; upload URL validation, non-admin refusal, contract shape; confirm creates with `identity.sub`, non-PDF cleanup + rejection, missing object, foreign key rejected; delete S3-before-record ordering, record-delete failure surfaced, non-admin refusal |

Per-component volume (Standard strategy, 5–8 per component): schema 6, repository 6, S3 adapter 5, validation 7; the handler component is five operations, so 12 across them (2–3 per operation).

## Expected coverage

- Global floor 80% lines (unchanged). Expected for this Unit's own files ≥ 90%.
- Excluded from collection: `amplify/functions/*/resource.ts`, `amplify/backend.ts` (as before).

## Mocking / stubbing guidance

- **Fake, don't mock modules.** Repository tests use a `send(command)` recorder that returns canned outputs (including a paginated `LastEvaluatedKey` sequence and an error whose `name === 'ConditionalCheckFailedException'`). S3-adapter tests inject a fake `presign(command, { expiresIn })` function and a fake S3 client `send` (returning `ContentType` for `HeadObject`, or throwing an error with `name: 'NotFound'`). Handler tests inject a `FakeDocumentRepository` and `FakeS3Adapter` with call recording so ordering (S3 delete before record delete) is assertable.
- Never mock `@aws-amplify/backend`; the schema test reads the exported schema definition/SDL.
- `identity` helpers: `adminCtx()` (`groups: ['Admin']`, `sub: 'admin-sub'`), `userCtx()`, `guestCtx()`.

## Test data management

- Fixtures are object literals built by helpers (`aDocument({ category: 'BHAKTAMAR' })`) inside each test file; fixed ISO timestamps and deterministic ids injected via `deps.now()` / `deps.newId()`. No fixture directory, no snapshots.

## Integration tests

None in this pass. When the Library ships in the app, the first integration test to add is the sandbox-backed upload round trip (`createDocumentUploadUrl` → real PUT → `confirmDocumentUpload` → `listDocuments` shows it → `getDocumentDownloadUrl` fetches it), owned by flutter-app-unit's `integration_test`.
