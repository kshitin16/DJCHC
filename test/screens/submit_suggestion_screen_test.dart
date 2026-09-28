/// Submit-a-Suggestion screen tests (plan Step 10.4).
///
/// The important behaviour is that the client's word count NEVER blocks Submit
/// and a refusal NEVER clears the input.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/screens/submit_suggestion_screen.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/utils/word_count.dart';

import '../support/fake_services.dart';
import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  late FakeSuggestionService suggestions;

  setUp(() {
    suggestions = FakeSuggestionService()..submitted = aSuggestion();
  });

  Widget screen() => SubmitSuggestionScreen(
    suggestionService: suggestions,
    strings: stringsFor(),
  );

  /// Whether the Submit button is currently tappable.
  bool submitEnabled(WidgetTester tester) =>
      tester
          .widget<FilledButton>(find.byKey(SubmitSuggestionScreen.submitKey))
          .onPressed !=
      null;

  testWidgets('the word count updates live as the user types', (tester) async {
    await pumpAppAndSettle(tester, screen());

    expect(find.text('0 / 300'), findsOneWidget);

    await tester.enterText(
      find.byKey(SubmitSuggestionScreen.inputKey),
      'please add an evening aarti',
    );
    await tester.pump();
    expect(find.text('5 / 300'), findsOneWidget);

    await tester.enterText(
      find.byKey(SubmitSuggestionScreen.inputKey),
      'more   parking\tplease',
    );
    await tester.pump();
    expect(find.text('3 / 300'), findsOneWidget);
  });

  testWidgets('the near-limit warning appears but Submit stays enabled', (
    tester,
  ) async {
    await pumpAppAndSettle(tester, screen());

    // Just under the warning threshold: no warning, button enabled.
    await tester.enterText(
      find.byKey(SubmitSuggestionScreen.inputKey),
      List.filled(suggestionWarnAt - 1, 'word').join(' '),
    );
    await tester.pump();
    expect(find.byKey(SubmitSuggestionScreen.warningKey), findsNothing);
    expect(submitEnabled(tester), isTrue);

    // At the threshold: warning shown, button STILL enabled.
    await tester.enterText(
      find.byKey(SubmitSuggestionScreen.inputKey),
      List.filled(suggestionWarnAt, 'word').join(' '),
    );
    await tester.pump();
    expect(find.byKey(SubmitSuggestionScreen.warningKey), findsOneWidget);
    expect(submitEnabled(tester), isTrue);

    // WELL OVER the server's limit: the client still does not block — the
    // authority is suggestion-unit's BR3.1, not this screen.
    final tooLong = List.filled(342, 'word').join(' ');
    await tester.enterText(
      find.byKey(SubmitSuggestionScreen.inputKey),
      tooLong,
    );
    await tester.pump();
    expect(find.text('342 / 300'), findsOneWidget);
    expect(submitEnabled(tester), isTrue);

    await tester.tap(find.byKey(SubmitSuggestionScreen.submitKey));
    await tester.pumpAndSettle();
    // And it really was sent, in full.
    expect(suggestions.submittedTexts, [tooLong]);
  });

  testWidgets('a successful submit confirms inline and clears the input', (
    tester,
  ) async {
    await pumpAppAndSettle(tester, screen());

    await tester.enterText(
      find.byKey(SubmitSuggestionScreen.inputKey),
      'More parking on festival days',
    );
    await tester.tap(find.byKey(SubmitSuggestionScreen.submitKey));
    await tester.pumpAndSettle();

    expect(suggestions.submittedTexts, ['More parking on festival days']);
    expect(find.byKey(SubmitSuggestionScreen.successKey), findsOneWidget);
    expect(
      find.text('Thank you — your suggestion has been submitted.'),
      findsOneWidget,
    );
    expect(find.byKey(SubmitSuggestionScreen.errorKey), findsNothing);
    // No redirect: the confirmation is in place.
    expect(find.byKey(SubmitSuggestionScreen.inputKey), findsOneWidget);
    expect(find.text('0 / 300'), findsOneWidget);
  });

  testWidgets('a server refusal shows its message and PRESERVES the input', (
    tester,
  ) async {
    const refusal = 'Your suggestion is 342 words; the limit is 300 words.';
    suggestions.submitFailure = const ApiException(refusal);
    await pumpAppAndSettle(tester, screen());

    const typed = 'a long suggestion the server rejects';
    await tester.enterText(find.byKey(SubmitSuggestionScreen.inputKey), typed);
    await tester.tap(find.byKey(SubmitSuggestionScreen.submitKey));
    await tester.pumpAndSettle();

    expect(find.byKey(SubmitSuggestionScreen.errorKey), findsOneWidget);
    expect(find.text(refusal), findsOneWidget);
    expect(find.byKey(SubmitSuggestionScreen.successKey), findsNothing);
    // The input is NOT cleared — the user does not lose what they wrote.
    expect(
      tester
          .widget<TextField>(find.byKey(SubmitSuggestionScreen.inputKey))
          .controller
          ?.text,
      typed,
    );

    // The rate-limit refusal reads the same way.
    suggestions.submitFailure = const ApiException(
      'You have already submitted 5 suggestions today. Please try again tomorrow.',
    );
    await tester.tap(find.byKey(SubmitSuggestionScreen.submitKey));
    await tester.pumpAndSettle();
    expect(find.textContaining('5 suggestions today'), findsOneWidget);
  });

  testWidgets(
    'a network failure can be retried, and empty text is refused locally',
    (tester) async {
      await pumpAppAndSettle(tester, screen());

      // An empty submit never reaches the server.
      await tester.tap(find.byKey(SubmitSuggestionScreen.submitKey));
      await tester.pumpAndSettle();
      expect(suggestions.submittedTexts, isEmpty);
      expect(
        find.text('Please write something before submitting.'),
        findsOneWidget,
      );

      // A network failure, then a successful retry of the same text.
      suggestions.submitFailure = const ApiException.transport(
        'Could not reach the server.',
      );
      await tester.enterText(
        find.byKey(SubmitSuggestionScreen.inputKey),
        'idea',
      );
      await tester.tap(find.byKey(SubmitSuggestionScreen.submitKey));
      await tester.pumpAndSettle();
      expect(find.text('Could not reach the server.'), findsOneWidget);

      suggestions.submitFailure = null;
      await tester.tap(find.byKey(SubmitSuggestionScreen.submitKey));
      await tester.pumpAndSettle();
      expect(suggestions.submittedTexts, ['idea', 'idea']);
      expect(find.byKey(SubmitSuggestionScreen.successKey), findsOneWidget);
    },
  );
}
