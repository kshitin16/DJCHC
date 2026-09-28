/// `PdfService` tests (plan Step 6.5) — Contract 6, including the direct-to-S3
/// PUT that BR6.2's two-step upload depends on.
library;

import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sarovar_jinalaya/models/document.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/services/pdf_service.dart';

import '../support/fake_gateways.dart';
import '../support/fixtures.dart';

void main() {
  late FakeApiGateway api;

  /// Builds a service whose HTTP client answers every PUT with [status] and
  /// records the requests it saw.
  ({PdfService service, List<http.BaseRequest> requests}) serviceWith({
    int status = 200,
    Object? throwInstead,
  }) {
    final requests = <http.BaseRequest>[];
    final client = MockClient((request) async {
      requests.add(request);
      if (throwInstead != null) throw throwInstead;
      return http.Response('', status);
    });
    return (service: PdfService(api, client), requests: requests);
  }

  setUp(() => api = FakeApiGateway());

  test(
    'list without a category omits it, with one sends the enum literal',
    () async {
      api.stub('listDocuments', [aDocumentJson()]);
      final service = serviceWith().service;

      await service.list(signedIn: false);
      expect(api.lastCall.variables, isEmpty);

      await service.list(
        category: DocumentCategory.variousVidhaans,
        signedIn: false,
      );
      expect(api.lastCall.variables, {'category': 'VARIOUS_VIDHAANS'});

      // `unknown` is this app's tolerance sentinel, never a value to send.
      await service.list(category: DocumentCategory.unknown, signedIn: false);
      expect(api.lastCall.variables, isEmpty);

      // The schema declares `category` nullable, so the document must too.
      expect(api.lastCall.document, contains(r'$category: DocumentCategory'));
    },
  );

  test(
    'both public reads follow the signed-in/signed-out auth-mode rule',
    () async {
      api.stub('listDocuments', <Object>[]);
      api.stub('getDocumentDownloadUrl', 'https://s3.example.test/doc?sig=1');
      final service = serviceWith().service;

      await service.list(signedIn: false);
      expect(api.lastCall.authMode, AuthMode.identityPool);
      await service.list(signedIn: true);
      expect(api.lastCall.authMode, AuthMode.userPool);

      await service.downloadUrl('doc-1', signedIn: false);
      expect(api.lastCall.authMode, AuthMode.identityPool);
      await service.downloadUrl('doc-1', signedIn: true);
      expect(api.lastCall.authMode, AuthMode.userPool);
    },
  );

  test('downloadUrl returns the pre-signed URL string', () async {
    api.stub(
      'getDocumentDownloadUrl',
      'https://bucket.s3.ap-south-1.amazonaws.test/documents/doc-1.pdf?sig=abc',
    );
    final service = serviceWith().service;

    final url = await service.downloadUrl('doc-1', signedIn: false);

    expect(url, startsWith('https://'));
    expect(url, contains('documents/doc-1.pdf'));
    expect(api.callTo('getDocumentDownloadUrl').variables, {'id': 'doc-1'});
    // The schema returns a bare AWSURL!, so the document selects no sub-fields.
    expect(
      api.callTo('getDocumentDownloadUrl').document,
      isNot(contains('{\n    id')),
    );
  });

  test(
    'a download URL that comes back empty or non-string fails loudly',
    () async {
      final service = serviceWith().service;

      api.stub('getDocumentDownloadUrl', '');
      await expectLater(
        service.downloadUrl('doc-1', signedIn: false),
        throwsA(isA<ApiException>()),
      );

      api.calls.clear();
      api.stub('getDocumentDownloadUrl', 42);
      await expectLater(
        service.downloadUrl('doc-1', signedIn: false),
        throwsA(isA<ApiException>()),
      );
    },
  );

  test('uploadBytes PUTs with Content-Type application/pdf', () async {
    final built = serviceWith();
    final bytes = Uint8List.fromList('%PDF-1.7 fake'.codeUnits);

    await built.service.uploadBytes(
      'https://s3.example.test/put?sig=abc',
      bytes,
    );

    expect(built.requests, hasLength(1));
    final request = built.requests.single;
    expect(request.method, 'PUT');
    expect(request.url.toString(), 'https://s3.example.test/put?sig=abc');
    expect(request.headers['Content-Type'], 'application/pdf');
    expect(PdfService.pdfContentType, 'application/pdf');
    expect((request as http.Request).bodyBytes, bytes);
  });

  test(
    'a non-2xx PUT and a transport failure both fail with plain copy',
    () async {
      final bytes = Uint8List.fromList([1, 2, 3]);

      for (final status in const [403, 400, 500]) {
        final built = serviceWith(status: status);
        await expectLater(
          built.service.uploadBytes('https://s3.example.test/put', bytes),
          throwsA(
            isA<ApiException>()
                .having(
                  (e) => e.message,
                  'message',
                  PdfService.uploadFailedMessage,
                )
                .having((e) => e.isTransport, 'isTransport', isTrue),
          ),
          reason: 'status $status must fail',
        );
      }

      // A socket-level failure is the same user-visible outcome.
      final broken = serviceWith(throwInstead: http.ClientException('socket'));
      await expectLater(
        broken.service.uploadBytes('https://s3.example.test/put', bytes),
        throwsA(isA<ApiException>()),
      );

      // A 204 (S3's own success for a PUT) is NOT a failure.
      final ok = serviceWith(status: 204);
      await ok.service.uploadBytes('https://s3.example.test/put', bytes);
    },
  );

  test(
    'the upload sequence is createUploadUrl -> PUT -> confirmUpload',
    () async {
      api.stub(
        'createDocumentUploadUrl',
        aDocumentUploadTargetJson(
          uploadUrl: 'https://s3.example.test/put?sig=xyz',
          s3Key: 'documents/new-1.pdf',
        ),
      );
      api.stub(
        'confirmDocumentUpload',
        aDocumentJson(
          id: 'doc-new',
          title: 'Bhaktamar Stotra',
          category: 'BHAKTAMAR',
        ),
      );
      final built = serviceWith();
      final service = built.service;

      final target = await service.createUploadUrl(
        title: 'Bhaktamar Stotra',
        category: DocumentCategory.bhaktamar,
      );
      expect(api.callTo('createDocumentUploadUrl').variables, {
        'title': 'Bhaktamar Stotra',
        'category': 'BHAKTAMAR',
      });
      expect(api.callTo('createDocumentUploadUrl').authMode, AuthMode.userPool);

      await service.uploadBytes(target.uploadUrl, Uint8List.fromList([1]));

      final document = await service.confirmUpload(
        s3Key: target.s3Key,
        title: 'Bhaktamar Stotra',
        category: DocumentCategory.bhaktamar,
      );

      // confirmDocumentUpload re-supplies title and category — the built schema
      // requires all three arguments, unlike functional-spec.md's `s3Key` only.
      expect(api.callTo('confirmDocumentUpload').variables, {
        's3Key': 'documents/new-1.pdf',
        'title': 'Bhaktamar Stotra',
        'category': 'BHAKTAMAR',
      });
      expect(document.id, 'doc-new');
      expect(document.category, DocumentCategory.bhaktamar);

      // The PUT happened between the two mutations, not before or after both.
      expect(api.calls.map((c) => c.field), [
        'createDocumentUploadUrl',
        'confirmDocumentUpload',
      ]);
      expect(built.requests, hasLength(1));
    },
  );

  test(
    'a non-PDF object is refused by confirmUpload and the copy is shown',
    () async {
      api.stubRefusal(
        'confirmDocumentUpload',
        'That file is not a PDF. It has been removed and no document was created.',
      );
      final service = serviceWith().service;

      await expectLater(
        service.confirmUpload(
          s3Key: 'documents/x',
          title: 't',
          category: DocumentCategory.dailyPoojan,
        ),
        throwsA(
          isA<ApiException>().having(
            (e) => e.message,
            'message',
            contains('not a PDF'),
          ),
        ),
      );
    },
  );

  test(
    'delete sends the id and returns the deleted id as a bare string',
    () async {
      // The schema returns ID!, not a Document.
      api.stub('deleteDocument', 'doc-9');
      final service = serviceWith().service;

      final deletedId = await service.delete('doc-9');

      expect(deletedId, 'doc-9');
      expect(api.callTo('deleteDocument').variables, {'id': 'doc-9'});
      expect(api.callTo('deleteDocument').authMode, AuthMode.userPool);
      expect(api.callTo('deleteDocument').isMutation, isTrue);
    },
  );
}
