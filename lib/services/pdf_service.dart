/// Contract 6 (PDF Library Data) — browse, download, and (for an admin) upload
/// and delete PDF documents.
///
/// Realizes: FR6.1-FR6.3 (later release, behind `featureFlags.pdfLibraryEnabled`).
///
/// The PDF bytes never pass through this app's own API: BR6.2's two-step upload
/// is `createDocumentUploadUrl` -> HTTP PUT straight to the pre-signed S3 URL ->
/// `confirmDocumentUpload`. That PUT is the one place this Unit speaks HTTP
/// directly, which is why an `http.Client` is injected rather than constructed.
library;

import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../models/document.dart';
import 'gateways.dart';
import 'documents/pdf_documents.dart';
import 'service_parsing.dart';

class PdfService {
  /// [httpClient] is injected rather than constructed so the direct-to-S3
  /// PUT can be driven by `MockClient` in tests.
  PdfService(this._api, this._httpClient);

  final ApiGateway _api;
  final http.Client _httpClient;

  /// The `Content-Type` the pre-signed PUT is signed for (BR6.2). A mismatch
  /// makes S3 reject the upload outright.
  static const String pdfContentType = 'application/pdf';

  static const String uploadFailedMessage =
      'The document could not be uploaded. Please check your connection and '
      'try again.';

  /// `listDocuments(category)` — public read; [category] omitted lists all.
  Future<List<Document>> list({
    DocumentCategory? category,
    required bool signedIn,
  }) async {
    final data = await _api.query(
      document: listDocumentsDocument,
      field: 'listDocuments',
      authMode: publicReadAuthMode(signedIn: signedIn),
      variables: {
        if (category != null && category != DocumentCategory.unknown)
          'category': category.graphQlValue,
      },
    );
    return parseList(data, Document.fromJson, field: 'listDocuments');
  }

  /// `getDocumentDownloadUrl(id)` — public read returning a pre-signed URL
  /// string the screen opens externally.
  Future<String> downloadUrl(String id, {required bool signedIn}) async {
    final data = await _api.query(
      document: getDocumentDownloadUrlDocument,
      field: 'getDocumentDownloadUrl',
      authMode: publicReadAuthMode(signedIn: signedIn),
      variables: {'id': id},
    );
    return parseString(data, field: 'getDocumentDownloadUrl');
  }

  /// `createDocumentUploadUrl(title, category)` — admin-only; BR6.2 step 1.
  Future<DocumentUploadTarget> createUploadUrl({
    required String title,
    required DocumentCategory category,
  }) async {
    final data = await _api.mutate(
      document: createDocumentUploadUrlDocument,
      field: 'createDocumentUploadUrl',
      authMode: AuthMode.userPool,
      variables: {'title': title, 'category': category.graphQlValue},
    );
    return parseObject(
      data,
      DocumentUploadTarget.fromJson,
      field: 'createDocumentUploadUrl',
    );
  }

  /// PUTs the PDF bytes straight to the pre-signed S3 URL — BR6.2 step 2.
  ///
  /// Throws [ApiException] on a non-2xx response or a transport failure. The
  /// same URL can be retried; once it expires a new one must be requested.
  Future<void> uploadBytes(String uploadUrl, Uint8List bytes) async {
    http.Response response;
    try {
      response = await _httpClient.put(
        Uri.parse(uploadUrl),
        headers: const {'Content-Type': pdfContentType},
        body: bytes,
      );
    } on Object {
      // Any transport-level failure (socket, DNS, TLS, malformed URL).
      throw const ApiException.transport(uploadFailedMessage);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw const ApiException.transport(uploadFailedMessage);
    }
  }

  /// `confirmDocumentUpload(s3Key, title, category)` — admin-only; BR6.2 step 3.
  ///
  /// The built schema takes all three arguments (functional-spec.md shows only
  /// `s3Key`), so `title` and `category` are re-supplied here.
  Future<Document> confirmUpload({
    required String s3Key,
    required String title,
    required DocumentCategory category,
  }) async {
    final data = await _api.mutate(
      document: confirmDocumentUploadDocument,
      field: 'confirmDocumentUpload',
      authMode: AuthMode.userPool,
      variables: {
        's3Key': s3Key,
        'title': title,
        'category': category.graphQlValue,
      },
    );
    return parseObject(data, Document.fromJson, field: 'confirmDocumentUpload');
  }

  /// `deleteDocument(id)` — admin-only; returns the deleted document's id.
  Future<String> delete(String id) async {
    final data = await _api.mutate(
      document: deleteDocumentDocument,
      field: 'deleteDocument',
      authMode: AuthMode.userPool,
      variables: {'id': id},
    );
    return parseString(data, field: 'deleteDocument');
  }
}
