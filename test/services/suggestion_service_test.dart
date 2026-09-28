/// `SuggestionService` tests (plan Step 6.3) — Contract 4.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/services/suggestion_service.dart';

import '../support/fake_gateways.dart';
import '../support/fixtures.dart';

void main() {
  late FakeApiGateway api;
  late SuggestionService service;

  setUp(() {
    api = FakeApiGateway();
    service = SuggestionService(api);
  });

  test(
    'submit sends {text} over userPool and parses the created row',
    () async {
      api.stub(
        'submitSuggestion',
        aSuggestionJson(id: 's-5', text: 'More parking'),
      );

      final created = await service.submit('More parking');

      final call = api.callTo('submitSuggestion');
      expect(call.variables, {'text': 'More parking'});
      expect(call.authMode, AuthMode.userPool);
      expect(call.isMutation, isTrue);
      expect(call.document, contains('mutation SubmitSuggestion'));
      for (final field in const [
        'id',
        'submittedByGoogleId',
        'text',
        'submittedAt',
      ]) {
        expect(call.document, contains(field));
      }
      expect(created.id, 's-5');
      expect(created.text, 'More parking');
    },
  );

  test('the client never pre-empts the word limit — long text is still sent', () async {
    // BR3.1 is enforced server-side; the client's warning is advisory only, so
    // a 400-word suggestion must still reach the server rather than be blocked.
    final longText = List.filled(400, 'word').join(' ');
    api.stub('submitSuggestion', aSuggestionJson(text: longText));

    await service.submit(longText);

    expect(api.callTo('submitSuggestion').variables['text'], longText);
  });

  test("a server refusal's message is surfaced verbatim", () async {
    // BR3.1 (300-word limit) and BR3.5 (5 per IST day) both refuse this way.
    api.stubRefusal(
      'submitSuggestion',
      'Your suggestion is 342 words; the limit is 300 words.',
    );
    await expectLater(
      service.submit('x'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'message',
          'Your suggestion is 342 words; the limit is 300 words.',
        ),
      ),
    );

    api.calls.clear();
    api.failures.clear();
    api.stubRefusal(
      'submitSuggestion',
      'You have already submitted 5 suggestions today. Please try again tomorrow.',
    );
    await expectLater(
      service.submit('x'),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'message',
          contains('5 suggestions today'),
        ),
      ),
    );
  });

  test(
    'myPast passes the server newest-first order through unchanged',
    () async {
      api.stub('myPastSuggestions', [
        aSuggestionJson(id: 's-3', submittedAt: DateTime.utc(2026, 3, 1)),
        aSuggestionJson(id: 's-2', submittedAt: DateTime.utc(2026, 2, 1)),
        aSuggestionJson(id: 's-1', submittedAt: DateTime.utc(2026, 1, 1)),
      ]);

      final mine = await service.myPast();

      expect(mine.map((s) => s.id), ['s-3', 's-2', 's-1']);
      final call = api.callTo('myPastSuggestions');
      expect(call.authMode, AuthMode.userPool);
      expect(call.isMutation, isFalse);
      expect(call.variables, isEmpty);
    },
  );

  test('allSuggestions is an admin-only userPool query', () async {
    api.stub('allSuggestions', [
      aSuggestionJson(id: 's-a', submittedByGoogleId: 'user-1'),
      aSuggestionJson(id: 's-b', submittedByGoogleId: 'user-2'),
    ]);

    final all = await service.allSuggestions();

    expect(all, hasLength(2));
    expect(all.map((s) => s.submittedByGoogleId), ['user-1', 'user-2']);
    expect(api.callTo('allSuggestions').authMode, AuthMode.userPool);

    // A non-admin caller is refused server-side; the copy is shown as-is.
    api.calls.clear();
    api.stubRefusal('allSuggestions', 'Admin access required.');
    await expectLater(
      service.allSuggestions(),
      throwsA(
        isA<ApiException>().having(
          (e) => e.message,
          'message',
          'Admin access required.',
        ),
      ),
    );
  });

  test('a network failure is a transport ApiException, and an empty list is not an error', () async {
    api.stubTransportFailure('myPastSuggestions');
    await expectLater(
      service.myPast(),
      throwsA(
        isA<ApiException>().having((e) => e.isTransport, 'isTransport', isTrue),
      ),
    );

    // Nothing submitted yet is an empty list, not a failure — the screen turns
    // that into its own empty state.
    api.calls.clear();
    api.failures.clear();
    api.stub('myPastSuggestions', <Object>[]);
    expect(await service.myPast(), isEmpty);
  });
}
