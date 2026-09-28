/// `FeedService` tests (plan Step 6.2) — Contract 3.
///
/// The load-bearing assertions are the per-call auth mode (rule 3), the
/// selection set matching Contract 3's fields, and the exact variable shapes the
/// built schema declares.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/post.dart';
import 'package:sarovar_jinalaya/services/feed_service.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';

import '../support/fake_gateways.dart';
import '../support/fixtures.dart';

void main() {
  late FakeApiGateway api;
  late FeedService service;

  setUp(() {
    api = FakeApiGateway();
    service = FeedService(api);
  });

  test(
    'listPosts uses identityPool when signed out, userPool when signed in',
    () async {
      api.stub('listPosts', [aPostJson()]);

      await service.listPosts(signedIn: false);
      expect(api.lastCall.authMode, AuthMode.identityPool);

      await service.listPosts(signedIn: true);
      expect(api.lastCall.authMode, AuthMode.userPool);

      expect(api.countOf('listPosts'), 2);
      // A public read is a query, never a mutation.
      expect(api.calls.every((c) => !c.isMutation), isTrue);
    },
  );

  test('the listPosts selection set is exactly Contract 3 fields', () async {
    api.stub('listPosts', <Object>[]);

    await service.listPosts(signedIn: false);
    final document = api.callTo('listPosts').document;

    for (final field in const [
      'id',
      'type',
      'title',
      'description',
      'dateTime',
      'createdByGoogleId',
      'createdAt',
      'updatedAt',
    ]) {
      expect(document, contains(field), reason: 'missing $field');
    }
    // `deletedAt` is feed-unit's internal soft-delete marker and is NOT part of
    // Contract 3 — selecting it would be a contract violation.
    expect(document, isNot(contains('deletedAt')));
    expect(document, contains('query ListPosts'));
  });

  test('listPosts parses rows and returns them in the server order', () async {
    api.stub('listPosts', [
      aPostJson(id: 'p-1', title: 'Newest'),
      aPostJson(id: 'p-2', title: 'Older', type: 'VISITING_DIGNITARY'),
    ]);

    final posts = await service.listPosts(signedIn: false);

    expect(posts.map((p) => p.id), ['p-1', 'p-2']);
    expect(posts.first.title, 'Newest');
    expect(posts.last.type, PostType.visitingDignitary);
  });

  test('every admin operation uses userPool', () async {
    api.stub('listAllPostsForAdmin', [aPostJson()]);
    api.stub('getPost', aPostJson());
    api.stub('createPost', aPostJson());
    api.stub('updatePost', aPostJson());
    api.stub('deletePost', aPostJson());

    await service.listAllForAdmin();
    await service.getPost('p-1');
    await service.create(
      CreatePostInput(
        type: PostType.event,
        title: 't',
        description: 'd',
        dateTime: fixedNowUtc,
      ),
    );
    await service.update('p-1', const UpdatePostInput(title: 't2'));
    await service.delete('p-1');

    expect(api.calls, hasLength(5));
    expect(api.calls.map((c) => c.authMode).toSet(), {
      AuthMode.userPool,
    }, reason: 'admin operations are User Pool only');
    // The three writes are mutations; the two reads are queries.
    expect(api.calls.where((c) => c.isMutation).map((c) => c.field), [
      'createPost',
      'updatePost',
      'deletePost',
    ]);
  });

  test(
    'createPost sends {input: {type, title, description, dateTime}}',
    () async {
      api.stub('createPost', aPostJson(id: 'new-1'));

      final created = await service.create(
        CreatePostInput(
          type: PostType.donationCallOut,
          title: 'Roof fund',
          description: 'Contributions welcome.',
          dateTime: DateTime.utc(2026, 5, 1, 3, 30),
        ),
      );

      final call = api.callTo('createPost');
      expect(call.variables.keys, ['input']);
      final input = call.variables['input'] as Map<String, dynamic>;
      expect(input, {
        'type': 'DONATION_CALL_OUT',
        'title': 'Roof fund',
        'description': 'Contributions welcome.',
        'dateTime': '2026-05-01T03:30:00.000Z',
      });
      // The input type name is the schema's customType key, not `CreatePostInput`.
      expect(call.document, contains(r'$input: CreatePost!'));
      expect(created.id, 'new-1');
    },
  );

  test('updatePost sends only the fields the caller supplied', () async {
    api.stub('updatePost', aPostJson());

    await service.update('p-7', const UpdatePostInput(title: 'Renamed'));

    var input = api.callTo('updatePost').variables['input'] as Map;
    expect(input, {'title': 'Renamed'});
    expect(input.containsKey('description'), isFalse);
    expect(input.containsKey('type'), isFalse);
    expect(input.containsKey('dateTime'), isFalse);
    expect(api.callTo('updatePost').variables['id'], 'p-7');

    // A fuller edit sends exactly the fields it was given, and nothing else.
    api.calls.clear();
    await service.update(
      'p-7',
      UpdatePostInput(
        type: PostType.event,
        description: 'New details',
        dateTime: DateTime.utc(2026, 6, 2, 3, 30),
      ),
    );
    input = api.callTo('updatePost').variables['input'] as Map;
    expect(input, {
      'type': 'EVENT',
      'description': 'New details',
      'dateTime': '2026-06-02T03:30:00.000Z',
    });
    expect(input.containsKey('title'), isFalse);

    // An empty edit sends an empty input rather than inventing fields.
    api.calls.clear();
    await service.update('p-7', const UpdatePostInput());
    expect(api.callTo('updatePost').variables['input'], isEmpty);
  });

  test('getPost sends the id and tolerates a missing post', () async {
    api.stub('getPost', aPostJson(id: 'p-3'));
    final found = await service.getPost('p-3');
    expect(api.callTo('getPost').variables, {'id': 'p-3'});
    expect(found?.id, 'p-3');

    // The schema's return type is nullable: an unknown id is null, not an error.
    api.calls.clear();
    api.stub('getPost', null);
    expect(await service.getPost('nope'), isNull);
  });

  test('deletePost sends the id and returns the soft-deleted post', () async {
    api.stub('deletePost', aPostJson(id: 'p-9', title: 'Gone'));

    final deleted = await service.delete('p-9');

    expect(api.callTo('deletePost').variables, {'id': 'p-9'});
    expect(deleted.id, 'p-9');
    expect(deleted.title, 'Gone');
  });

  test('a GraphQL error surfaces the server message verbatim', () async {
    // BR2.3's refusal when the caller is not (or no longer) an admin.
    api.stubRefusal('listAllPostsForAdmin', 'Admin access required.');

    await expectLater(
      service.listAllForAdmin(),
      throwsA(
        isA<ApiException>()
            .having((e) => e.message, 'message', 'Admin access required.')
            .having((e) => e.isTransport, 'isTransport', isFalse),
      ),
    );
  });

  test(
    'a malformed response becomes a typed failure, never a TypeError',
    () async {
      // The field came back as an object where a list was expected.
      api.stub('listPosts', {'unexpected': true});
      await expectLater(
        service.listPosts(signedIn: false),
        throwsA(
          isA<ApiException>().having(
            (e) => e.isTransport,
            'isTransport',
            isTrue,
          ),
        ),
      );

      // A list whose rows are missing a required field.
      api.calls.clear();
      api.stub('listPosts', [
        {'id': 'p-1'},
      ]);
      await expectLater(
        service.listPosts(signedIn: false),
        throwsA(isA<ApiException>()),
      );

      // A scalar where an object was expected.
      api.calls.clear();
      api.stub('createPost', 'not-an-object');
      await expectLater(
        service.create(
          CreatePostInput(
            type: PostType.event,
            title: 't',
            description: 'd',
            dateTime: fixedNowUtc,
          ),
        ),
        throwsA(isA<ApiException>()),
      );
    },
  );

  test(
    'a transport failure is flagged as transport, not a server refusal',
    () async {
      api.stubTransportFailure('listPosts');

      await expectLater(
        service.listPosts(signedIn: true),
        throwsA(
          isA<ApiException>().having(
            (e) => e.isTransport,
            'isTransport',
            isTrue,
          ),
        ),
      );
    },
  );
}
