/// PDF Library screen tests (plan Step 10.7).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/document.dart';
import 'package:sarovar_jinalaya/screens/pdf_library_screen.dart';
import 'package:sarovar_jinalaya/services/auth_service.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/state/auth_state.dart';
import 'package:sarovar_jinalaya/widgets/list_items.dart';
import 'package:sarovar_jinalaya/widgets/state_widgets.dart';

import '../support/fake_gateways.dart';
import '../support/fake_services.dart';
import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  late FakePdfService pdf;
  late FakeUrlLauncher launcher;
  late FakeAuthGateway authGateway;
  late AuthState authState;

  setUp(() async {
    final log = CallLog();
    pdf = FakePdfService(log: log);
    launcher = FakeUrlLauncher(log: log);
    authGateway = FakeAuthGateway(session: aSession(signedIn: false));
    authState = AuthState(AuthService(authGateway));
    await authState.refresh();
  });

  tearDown(() async {
    authState.dispose();
    await authGateway.close();
  });

  Widget screen() => PdfLibraryScreen(
    pdfService: pdf,
    authState: authState,
    strings: stringsFor(),
    launchUrl: launcher.call,
  );

  testWidgets('lists all categories first, then filters on a chip tap', (
    tester,
  ) async {
    pdf.documents = [
      aDocument(id: 'doc-1', title: 'Daily Poojan Vidhi'),
      aDocument(
        id: 'doc-2',
        title: 'Bhaktamar Stotra',
        category: DocumentCategory.bhaktamar,
      ),
    ];

    await pumpAppAndSettle(tester, screen());

    // The initial listing omits the category argument entirely.
    expect(pdf.lastListedCategory, isNull);
    expect(pdf.log.of('list:all'), hasLength(1));
    expect(find.byType(DocumentListItem), findsNWidgets(2));
    // All three real categories plus "All" are offered as chips.
    expect(find.byKey(PdfLibraryScreen.allChipKey), findsOneWidget);
    for (final category in DocumentCategory.known) {
      expect(find.byKey(PdfLibraryScreen.chipKeyFor(category)), findsOneWidget);
    }

    await tester.tap(
      find.byKey(PdfLibraryScreen.chipKeyFor(DocumentCategory.bhaktamar)),
    );
    await tester.pumpAndSettle();

    expect(pdf.lastListedCategory, DocumentCategory.bhaktamar);
    expect(pdf.log.of('list:BHAKTAMAR'), hasLength(1));

    // Tapping the same chip again does not re-fetch.
    await tester.tap(
      find.byKey(PdfLibraryScreen.chipKeyFor(DocumentCategory.bhaktamar)),
    );
    await tester.pumpAndSettle();
    expect(pdf.log.of('list:BHAKTAMAR'), hasLength(1));
  });

  testWidgets('a signed-out reader browses as a guest', (tester) async {
    pdf.documents = [aDocument()];

    await pumpAppAndSettle(tester, screen());

    // BR6.5: the library is public; `false` selects the Identity Pool guest role.
    expect(pdf.lastListSignedIn, isFalse);
  });

  testWidgets(
    'opening a document fetches its URL and hands it to the browser',
    (tester) async {
      pdf.documents = [aDocument(id: 'doc-7', title: 'Various Vidhaans')];
      pdf.downloadUrlValue = 'https://bucket.s3.ap-south-1.amazonaws.test/documents/doc-7.pdf?sig=x';

      await pumpAppAndSettle(tester, screen());
      await tester.tap(find.byKey(DocumentListItem.openKeyFor('doc-7')));
      await tester.pumpAndSettle();

      expect(pdf.lastDownloadedId, 'doc-7');
      // The URL is fetched BEFORE the browser is opened.
      expect(pdf.log.entries.sublist(1), ['downloadUrl:doc-7', 'launchUrl']);
      expect(launcher.launched.single.toString(), pdf.downloadUrlValue);
      expect(find.byKey(PdfLibraryScreen.actionErrorKey), findsNothing);
    },
  );

  testWidgets('a download-URL failure shows inline and opens nothing', (
    tester,
  ) async {
    pdf.documents = [aDocument(id: 'doc-7')];
    pdf.downloadFailure = const ApiException.transport('Offline.');

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(DocumentListItem.openKeyFor('doc-7')));
    await tester.pumpAndSettle();

    expect(find.byKey(PdfLibraryScreen.actionErrorKey), findsOneWidget);
    expect(find.text('Offline.'), findsOneWidget);
    expect(launcher.launched, isEmpty);

    // A browser that refuses to open is reported too.
    pdf.downloadFailure = null;
    launcher.succeeds = false;
    await tester.tap(find.byKey(DocumentListItem.openKeyFor('doc-7')));
    await tester.pumpAndSettle();
    expect(
      find.text('Could not open that document. Please try again.'),
      findsOneWidget,
    );
  });

  testWidgets(
    'an empty category and a listing failure render their own states',
    (tester) async {
      pdf.documents = const [];
      await pumpAppAndSettle(tester, screen());
      expect(find.text('No documents in this category yet.'), findsOneWidget);
      expect(find.byType(ErrorState), findsNothing);

      pdf.listFailure = const ApiException.transport(
        'Could not reach the server.',
      );
      await tester.tap(
        find.byKey(PdfLibraryScreen.chipKeyFor(DocumentCategory.dailyPoojan)),
      );
      await tester.pumpAndSettle();
      expect(find.text('Could not reach the server.'), findsOneWidget);

      pdf.listFailure = null;
      pdf.documents = [aDocument()];
      await tester.tap(find.byKey(PdfLibraryScreen.retryKey));
      await tester.pumpAndSettle();
      expect(find.byType(DocumentListItem), findsOneWidget);
    },
  );

  testWidgets('the public library offers no delete action', (tester) async {
    pdf.documents = [aDocument(id: 'doc-1')];

    await pumpAppAndSettle(tester, screen());

    // Delete is admin-only and lives on Screen 11.
    expect(find.byKey(DocumentListItem.deleteKeyFor('doc-1')), findsNothing);
    expect(find.byKey(DocumentListItem.openKeyFor('doc-1')), findsOneWidget);
  });
}
