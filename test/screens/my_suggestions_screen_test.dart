/// My Suggestions screen tests (plan Step 10.5).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/screens/my_suggestions_screen.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/widgets/list_items.dart';
import 'package:sarovar_jinalaya/widgets/state_widgets.dart';

import '../support/fake_services.dart';
import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  late FakeSuggestionService suggestions;

  setUp(() => suggestions = FakeSuggestionService());

  Widget screen() => MySuggestionsScreen(
    suggestionService: suggestions,
    strings: stringsFor(),
  );

  testWidgets('renders the loaded suggestions in the server order', (
    tester,
  ) async {
    suggestions.mine = [
      aSuggestion(
        id: 's-3',
        text: 'Newest idea',
        submittedAt: DateTime.utc(2026, 3, 1, 3, 30),
      ),
      aSuggestion(
        id: 's-2',
        text: 'Middle idea',
        submittedAt: DateTime.utc(2026, 2, 1, 3, 30),
      ),
      aSuggestion(
        id: 's-1',
        text: 'Oldest idea',
        submittedAt: DateTime.utc(2026, 1, 1, 3, 30),
      ),
    ];

    await pumpAppAndSettle(tester, screen());

    expect(find.byKey(MySuggestionsScreen.listKey), findsOneWidget);
    expect(find.byType(SuggestionListItem), findsNWidgets(3));
    // Newest first, passed through unchanged (the server orders it).
    final texts = tester
        .widgetList<SuggestionListItem>(find.byType(SuggestionListItem))
        .map((w) => w.suggestion.text)
        .toList();
    expect(texts, ['Newest idea', 'Middle idea', 'Oldest idea']);
    // The IST submission date is shown.
    expect(find.text('1 Mar 2026'), findsOneWidget);
    // The user's own list does not show the submitter.
    expect(find.textContaining('user-sub-1'), findsNothing);
  });

  testWidgets(
    'nothing submitted yet shows the empty state pointing to Submit',
    (tester) async {
      suggestions.mine = const [];

      await pumpAppAndSettle(tester, screen());

      expect(
        find.text(
          'You have not submitted any suggestions yet. Tap Submit to add one.',
        ),
        findsOneWidget,
      );
      expect(find.byType(ErrorState), findsNothing);
      expect(find.byType(SuggestionListItem), findsNothing);
    },
  );

  testWidgets('a failure shows the message and retry re-calls the service', (
    tester,
  ) async {
    suggestions.myPastFailure = const ApiException.transport(
      'Could not reach the server.',
    );

    await pumpAppAndSettle(tester, screen());

    expect(find.text('Could not reach the server.'), findsOneWidget);
    expect(suggestions.log.countOf('myPast'), 1);

    suggestions.myPastFailure = null;
    suggestions.mine = [aSuggestion(text: 'Recovered')];
    await tester.tap(find.byKey(MySuggestionsScreen.retryKey));
    await tester.pumpAndSettle();

    expect(suggestions.log.countOf('myPast'), 2);
    expect(find.text('Recovered'), findsOneWidget);
  });

  testWidgets('a long suggestion is truncated rather than overflowing', (
    tester,
  ) async {
    suggestions.mine = [aSuggestion(text: List.filled(80, 'word').join(' '))];

    await pumpAppAndSettle(tester, screen());

    final title = tester.widget<Text>(
      find
          .descendant(
            of: find.byType(SuggestionListItem),
            matching: find.byType(Text),
          )
          .first,
    );
    expect(title.maxLines, 3);
    expect(title.overflow, TextOverflow.ellipsis);
  });
}
