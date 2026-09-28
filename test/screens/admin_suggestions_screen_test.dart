/// Admin Suggestions screen tests (plan Step 10.7).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/screens/admin/admin_suggestions_screen.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/widgets/list_items.dart';
import 'package:sarovar_jinalaya/widgets/state_widgets.dart';

import '../support/fake_services.dart';
import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  late FakeSuggestionService suggestions;

  setUp(() => suggestions = FakeSuggestionService());

  Widget screen() => AdminSuggestionsScreen(
    suggestionService: suggestions,
    strings: stringsFor(),
  );

  testWidgets('lists every suggestion with its submitter, newest first', (
    tester,
  ) async {
    suggestions.all = [
      aSuggestion(
        id: 's-2',
        text: 'Newer idea',
        submittedByGoogleId: 'user-b',
        submittedAt: DateTime.utc(2026, 3, 1, 3, 30),
      ),
      aSuggestion(
        id: 's-1',
        text: 'Older idea',
        submittedByGoogleId: 'user-a',
        submittedAt: DateTime.utc(2026, 2, 1, 3, 30),
      ),
    ];

    await pumpAppAndSettle(tester, screen());

    expect(find.byKey(AdminSuggestionsScreen.listKey), findsOneWidget);
    expect(find.byType(SuggestionListItem), findsNWidgets(2));
    expect(
      tester
          .widgetList<SuggestionListItem>(find.byType(SuggestionListItem))
          .map((w) => w.suggestion.text),
      ['Newer idea', 'Older idea'],
    );
    // The admin view DOES show who submitted it.
    expect(find.textContaining('user-b'), findsOneWidget);
    expect(find.textContaining('user-a'), findsOneWidget);
    expect(suggestions.log.of('allSuggestions'), hasLength(1));
  });

  testWidgets('the list is strictly read-only — no actions of any kind', (
    tester,
  ) async {
    suggestions.all = [aSuggestion(), aSuggestion(id: 's-2')];

    await pumpAppAndSettle(tester, screen());

    // FR3.5: nothing to mark read or resolved, so no action controls exist.
    expect(find.byType(IconButton), findsNothing);
    expect(find.byType(Checkbox), findsNothing);
    expect(find.byType(Switch), findsNothing);
    expect(find.byType(FilledButton), findsNothing);
    expect(
      tester
          .widgetList<SuggestionListItem>(find.byType(SuggestionListItem))
          .every((w) => w.showSubmitter),
      isTrue,
    );
  });

  testWidgets('no suggestions yet shows the empty state', (tester) async {
    suggestions.all = const [];

    await pumpAppAndSettle(tester, screen());

    expect(
      find.text('No suggestions have been submitted yet.'),
      findsOneWidget,
    );
    expect(find.byType(ErrorState), findsNothing);
  });

  testWidgets('a refusal or failure shows plain copy with a retry', (
    tester,
  ) async {
    suggestions.allFailure = const ApiException('Admin access required.');

    await pumpAppAndSettle(tester, screen());

    expect(find.text('Admin access required.'), findsOneWidget);

    suggestions.allFailure = null;
    suggestions.all = [aSuggestion(text: 'Recovered')];
    await tester.tap(find.byKey(AdminSuggestionsScreen.retryKey));
    await tester.pumpAndSettle();

    expect(suggestions.log.countOf('allSuggestions'), 2);
    expect(find.text('Recovered'), findsOneWidget);
  });
}
