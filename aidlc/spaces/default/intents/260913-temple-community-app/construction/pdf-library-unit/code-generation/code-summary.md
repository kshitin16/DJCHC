# Code Summary — pdf-library-unit

Full backend build (no feature flag — later-release gating lives in the app's navigation). Adds the project's first S3 bucket, the `Document` model, and one Lambda backing all five Contract 6 operations.

## Files created / modified

20 entries in `source-manifest.json`; workspace-relative.

| Path | Kind | Purpose |
|---|---|---|
| `package.json`, `package-lock.json` | modified | Runtime deps `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`; script `test:pdf`. |
| `amplify/storage/resource.ts` | created | `defineStorage({ name: 'sarovar-jinalaya-documents', versioned: false })` — deliberately no `access` block (decision 1). |
| `amplify/data/resource.ts` | modified | Appended `DocumentCategory` enum, `Document` model (all `entities.md` fields, `categoryIndex` on `category` sorted by `uploadedAt`, generated operations disabled, guest/authenticated read + `Admin`), `DocumentUploadTarget`, and the five Contract 6 operations — exact names/arguments/returns — all `a.handler.function(documentApi)`. Donation and feed content untouched. |
| `amplify/backend.ts` | modified | Registers `storage` + `documentApi`; bucket hardening pinned on the L1 (`PublicAccessBlockConfiguration` all four flags, SSE-S3 `AES256`, abort-incomplete-multipart after 7 days; synth-time guard that versioning stays off — BR6.4); least-privilege IAM: `s3:PutObject`/`GetObject`/`DeleteObject` on `<bucket>/documents/*` only, `dynamodb:GetItem`/`PutItem`/`DeleteItem`/`Query`/`Scan` on the `Document` table + `/index/*`; injects `DOCUMENT_TABLE_NAME`, `DOCUMENT_BUCKET_NAME`. Existing wiring untouched. |
| `amplify/functions/document-shared/constants.ts` (+ test) | created | Categories, index name, `UPLOAD_URL_EXPIRES_SECONDS = 900`, `DOWNLOAD_URL_EXPIRES_SECONDS = 3600` (NFR-SEC.1.1), key prefix, PDF content type, `MAX_TITLE_LENGTH = 200`. 1 test. |
| `amplify/functions/document-shared/types.ts`, `errors.ts` | created | Record/input types; `DocumentValidationError`, `DocumentNotFoundError`, `DocumentAuthorizationError`. |
| `amplify/functions/document-shared/validation.ts` (+ test) | created | `validateCategory` (BR6.1), `validateTitle`, `isPdfContentType` (BR6.2), `buildS3Key`, `parseS3Key` (rejects foreign prefixes, `..`/backslash traversal, leading/doubled slashes, unknown categories, non-UUID names, non-`.pdf`). 7 tests. |
| `amplify/functions/document-shared/document-repository.ts` (+ test) | created | `create` (conditional on new id), `getById`, `listByCategory` (Query on `categoryIndex`, newest first, paginated), `listAll` (Scan, paginated), `deleteById` (conditional `attribute_exists(id)` → not-found). 6 tests. |
| `amplify/functions/document-shared/s3-adapter.ts` (+ test) | created | Injectable presigner: PUT presign with `application/pdf` + 900 s; GET presign + 3600 s; `headObject` maps `NotFound`/`NoSuchKey`/404 → `{ exists: false }`; `deleteObject`. 5 tests. |
| `amplify/functions/document-api/resource.ts`, `handler.ts` (+ test) | created | 128MB/10s, `resourceGroupName: 'data'`. `createHandler(deps)` dispatching on `event.info.fieldName`; identity only from `event.identity`; `requireAdmin` backstop on the three admin operations; `confirmDocumentUpload` parses the issued key, HEADs the object, deletes a non-PDF and rejects (BR6.2), creates the record with `uploadedByGoogleId = identity.sub`; `deleteDocument` deletes the S3 object FIRST, then the record, surfacing a record-delete failure for retry (BR6.4). 12 tests. |
| `amplify/data/document-schema.test.ts` | created | 6 SDL/definition tests. |
| `README.md` | modified | "PDF Library" section: operations and callers, enforcing layer vs. backstop, direct-to-S3 upload flow (the PUT must send `Content-Type: application/pdf` exactly), URL lifetimes, delete ordering, accepted unconfirmed-upload risk, bucket hardening, self-review checklist. |

## Key implementation decisions

1. **No `allow.resource(documentApi)` in `defineStorage`** — that grant would attach a storage-stack policy to the Lambda's role in the data stack while `backend.ts` passes the bucket name the other way: a CloudFormation cross-stack cycle. S3 permissions come solely from the explicit `PolicyStatement` in `backend.ts` (which the plan required anyway).
2. **Bucket hardening pinned explicitly on the L1** rather than trusting defaults: the installed CDK `Bucket` emits `PublicAccessBlockConfiguration`/`BucketEncryption` only when asked, and Amplify's `AmplifyStorage` does not ask. Amplify does set `versioned: false` and `enforceSSL: true`.
3. **`s3:HeadObject` is not an IAM action** — `HeadObject` is authorized by `s3:GetObject`; the policy lists `PutObject`/`GetObject`/`DeleteObject` (plan 9.3 named four; intent preserved).
4. **`createdAt`/`updatedAt` written by the repository** (equal to `uploadedAt`): Amplify's `@model` transformer adds those non-null fields to the GraphQL type regardless; writing them avoids null-for-non-null errors. Additive to `entities.md`.
5. **Idempotent confirm**: the UUID embedded in the issued key becomes the record `id`, so a retried `confirmDocumentUpload` hits `attribute_not_exists(id)` instead of duplicating; a `category` argument that disagrees with the key's segment is rejected.
6. **All five operations Lambda-backed** (declared deviation; `listDocuments` joins the Lambda because guest auth is refused on no-Lambda custom resolvers, as feed-unit found).
7. Authorization layering stated explicitly (project.md correction): the declarative AppSync rules enforce; `requireAdmin` in the handler is a backstop; app screens are UX only.

## Test coverage summary

- `npm run test:pdf` → **6 suites, 37 tests, 37 passed** (exactly the approved instructions' table).
- `npm test -- --coverage` → **28 suites, 155 tests, 155 passed; 93.4% statements / 85.4% branches / 88.8% functions / 94.7% lines** (80% floor enforced, unchanged) — re-run and confirmed by the conductor. This Unit: `document-shared` 100% lines, `document-api` 94.7% (uncovered: the lazy real-client bootstrap).
- `npm run lint`, `npm run typecheck`, `prettier --check` → clean.
- No integration test yet; the first is the sandbox-backed upload round trip owned by flutter-app-unit when the Library ships.

## Deviations from the design and plan

| Deviation | Why | Effect |
|---|---|---|
| `listDocuments` Lambda-backed (infra spec: direct resolver) | Guest auth refused on no-Lambda custom resolvers in the installed Amplify | Infra spec amendment note recorded in the stage diary |
| `categoryIndex` GSI added | Browse-by-category as a Query, not a Scan | Infra spec amendment note |
| No storage `access` grant (plan 3.1 proposed one) | Cross-stack cycle; explicit IAM in `backend.ts` suffices | None on behaviour |
| `HeadObject` not listed as an IAM action | Not an IAM action; covered by `GetObject` | None |
| `createdAt`/`updatedAt` written | Amplify `@model` adds them as non-null | Additive |
| NFR-OBS.1 per-category document-count metric deferred | Declared in the plan | `Deferred` in `traceability.json` |

## Open items (not defects)

- **Not synthesized against AWS** in this pass: the storage/data stack wiring, bucket L1 properties, and the pre-signed PUT with `Content-Type: application/pdf` get their first real check at the first `ampx sandbox` (Build and Test).
- **flutter-app-unit's `pdf_service.dart`** must send exactly `Content-Type: application/pdf` on the pre-signed PUT (S3 returns 403 otherwise) and call the two public operations with `authorizationMode: identityPool` when signed out.
- The permission surface added here (`backend.ts`, `data/resource.ts`, `storage/resource.ts`) is on the builder's self-review checklist (project.md Mandated).
- `npm audit`: the same 20 transitive advisories under `@aws-amplify/backend-cli`; none introduced here.

## Re-verification (2026-09-28)

Same stage-attempt reset as auth-unit (see that Unit's code-summary.md). Re-ran Plan Approval under the current attempt and verified the existing implementation directly:

- `npm run test:pdf`: 6/6 suites, 37/37 tests passing.
- `npm run typecheck` / `npm run lint`: clean (verified once during this session's re-verification pass; unaffected by this Unit).
- Repository content is unchanged: no `amplify/data/document*/**`, `amplify/functions/document-*/**`, or `amplify/storage/**` file was touched.
