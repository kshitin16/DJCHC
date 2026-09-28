/// Admin PDF Library screen tests (plan Step 10.7).
///
/// The load-bearing assertion is BR6.2's ORDER: `createDocumentUploadUrl` ->
/// the direct-to-S3 PUT -> `confirmDocumentUpload`.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/document.dart';
import 'package:sarovar_jinalaya/screens/admin/admin_pdf_library_screen.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/widgets/confirm_destructive_action_dialog.dart';
import 'package:sarovar_jinalaya/widgets/list_items.dart';

import '../support/fake_services.dart';
import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  late FakePdfService pdf;
  late FakePdfPicker picker;

  setUp(() {
    final log = CallLog();
    pdf = FakePdfService(log: log)..confirmed = aDocument(id: 'doc-new');
    picker = FakePdfPicker(log: log, result: aPickedPdf());
  });

  Widget screen() => AdminPdfLibraryScreen(
    pdfService: pdf,
    strings: stringsFor(),
    pickPdf: picker.call,
  );

  testWidgets(
    'the upload runs createUploadUrl -> PUT -> confirm, in that order',
    (tester) async {
      pdf.documents = const [];

      await pumpAppAndSettle(tester, screen());

      await tester.enterText(
        find.byKey(AdminPdfLibraryScreen.titleFieldKey),
        'Bhaktamar Stotra',
      );
      await tester.tap(find.byKey(AdminPdfLibraryScreen.categoryFieldKey));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Bhaktamar').last);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(AdminPdfLibraryScreen.pickKey));
      await tester.pumpAndSettle();

      expect(find.byKey(AdminPdfLibraryScreen.pickedNameKey), findsOneWidget);
      expect(find.text('daily-poojan.pdf'), findsOneWidget);

      pdf.documents = [aDocument(id: 'doc-new', title: 'Bhaktamar Stotra')];
      await tester.tap(find.byKey(AdminPdfLibraryScreen.uploadKey));
      await tester.pumpAndSettle();

      // Exactly BR6.2's sequence — the picker first, then the three steps.
      expect(pdf.log.entries, [
        'list:all',
        'pickPdf',
        'createUploadUrl',
        'uploadBytes',
        'confirmUpload',
        'list:all',
      ]);
      // confirmUpload re-supplies title and category (the built schema needs all
      // three arguments, unlike functional-spec.md's `s3Key`-only wording).
      expect(pdf.lastConfirmedTitle, 'Bhaktamar Stotra');
      expect(pdf.lastConfirmedCategory, DocumentCategory.bhaktamar);
      expect(pdf.lastUploadedBytes, aPickedPdf().bytes);
      expect(find.byKey(AdminPdfLibraryScreen.successKey), findsOneWidget);
    },
  );

  testWidgets('a non-PDF choice is refused before any call is made', (
    tester,
  ) async {
    pdf.documents = const [];
    picker.result = aPickedPdf(fileName: 'scan.jpg');

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(AdminPdfLibraryScreen.pickKey));
    await tester.pumpAndSettle();

    expect(find.byKey(AdminPdfLibraryScreen.errorKey), findsOneWidget);
    expect(find.text('Please choose a PDF file.'), findsOneWidget);
    expect(find.byKey(AdminPdfLibraryScreen.pickedNameKey), findsNothing);
    // Nothing reached the backend or S3.
    expect(pdf.log.of('createUploadUrl'), isEmpty);
    expect(pdf.log.of('uploadBytes'), isEmpty);
  });

  testWidgets('a server refusal at confirm stops after the PUT and shows why', (
    tester,
  ) async {
    pdf.documents = const [];
    pdf.confirmFailure = const ApiException(
      'That file is not a PDF. It has been removed and no document was created.',
    );

    await pumpAppAndSettle(tester, screen());
    await tester.enterText(
      find.byKey(AdminPdfLibraryScreen.titleFieldKey),
      'Suspicious file',
    );
    await tester.tap(find.byKey(AdminPdfLibraryScreen.pickKey));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(AdminPdfLibraryScreen.uploadKey));
    await tester.pumpAndSettle();

    expect(find.textContaining('not a PDF'), findsOneWidget);
    expect(find.byKey(AdminPdfLibraryScreen.successKey), findsNothing);
    // The three steps were attempted in order; the list was NOT reloaded.
    expect(pdf.log.of('confirmUpload'), hasLength(1));
    expect(pdf.log.countOf('list'), 1);
  });

  testWidgets('an upload with no file or no title is refused locally', (
    tester,
  ) async {
    pdf.documents = const [];
    await pumpAppAndSettle(tester, screen());

    // No file picked yet.
    await tester.tap(find.byKey(AdminPdfLibraryScreen.uploadKey));
    await tester.pumpAndSettle();
    expect(find.text('This field is required'), findsOneWidget);
    expect(pdf.log.of('createUploadUrl'), isEmpty);

    // A file but no title.
    await tester.tap(find.byKey(AdminPdfLibraryScreen.pickKey));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(AdminPdfLibraryScreen.uploadKey));
    await tester.pumpAndSettle();
    expect(pdf.log.of('createUploadUrl'), isEmpty);
  });

  testWidgets('Delete requires confirmation, then removes the document', (
    tester,
  ) async {
    pdf.documents = [aDocument(id: 'doc-1', title: 'Old vidhi')];

    await pumpAppAndSettle(tester, screen());

    // Admin rows offer Delete and no Open.
    expect(find.byKey(DocumentListItem.deleteKeyFor('doc-1')), findsOneWidget);
    expect(find.byKey(DocumentListItem.openKeyFor('doc-1')), findsNothing);

    // Backing out does not delete.
    await tester.tap(find.byKey(DocumentListItem.deleteKeyFor('doc-1')));
    await tester.pumpAndSettle();
    expect(
      find.textContaining('disappear from the public library'),
      findsOneWidget,
    );
    await tester.tap(find.byKey(ConfirmDestructiveActionDialog.cancelKey));
    await tester.pumpAndSettle();
    expect(pdf.deletedId, isNull);

    // Confirming does, and the list reloads.
    pdf.documents = const [];
    await tester.tap(find.byKey(DocumentListItem.deleteKeyFor('doc-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(ConfirmDestructiveActionDialog.confirmKey));
    await tester.pumpAndSettle();

    expect(pdf.deletedId, 'doc-1');
    expect(pdf.log.countOf('list'), 2);
    expect(find.byType(DocumentListItem), findsNothing);
  });
}
