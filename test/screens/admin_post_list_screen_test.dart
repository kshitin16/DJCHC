/// Admin Post List screen tests (plan Step 10.6).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/post.dart';
import 'package:sarovar_jinalaya/screens/admin/admin_post_list_screen.dart';
import 'package:sarovar_jinalaya/screens/admin/post_form_screen.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/widgets/confirm_destructive_action_dialog.dart';
import 'package:sarovar_jinalaya/widgets/list_items.dart';
import 'package:sarovar_jinalaya/widgets/state_widgets.dart';

import '../support/fake_services.dart';
import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  late FakeFeedService feed;

  /// 1 March 2026, 15:30 IST.
  final now = DateTime.utc(2026, 3, 1, 10);

  setUp(() => feed = FakeFeedService());

  Widget screen() =>
      AdminPostListScreen(feedService: feed, strings: stringsFor(), now: now);

  testWidgets('lists every post including aged-out ones, badging the past', (
    tester,
  ) async {
    feed.adminPosts = [
      aPost(
        id: 'p-future',
        title: 'Upcoming event',
        dateTime: DateTime.utc(2026, 4, 12, 3, 30),
      ),
      aPost(
        id: 'p-past',
        title: 'Last month event',
        dateTime: DateTime.utc(2026, 2, 1, 3, 30),
      ),
    ];

    await pumpAppAndSettle(tester, screen());

    // Unlike the public Feed, the aged-out post is present.
    expect(find.byKey(AdminPostListScreen.listKey), findsOneWidget);
    expect(find.text('Upcoming event'), findsOneWidget);
    expect(find.text('Last month event'), findsOneWidget);
    expect(feed.log.of('listAllForAdmin'), hasLength(1));
    // …and only the past one carries the Past badge.
    expect(
      find.byKey(AdminPostListScreen.pastBadgeKeyFor('p-past')),
      findsOneWidget,
    );
    expect(
      find.byKey(AdminPostListScreen.pastBadgeKeyFor('p-future')),
      findsNothing,
    );
  });

  testWidgets('New Post opens the create form, which calls createPost', (
    tester,
  ) async {
    feed.adminPosts = [aPost()];
    feed.post = aPost(id: 'created');

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(AdminPostListScreen.newPostKey));
    await tester.pumpAndSettle();

    // A create form, not an edit form: no getPost was issued.
    expect(find.text('New Post'), findsWidgets);
    expect(feed.log.of('getPost'), isEmpty);

    await tester.enterText(
      find.byKey(PostFormScreen.titleFieldKey),
      'Paryushan begins',
    );
    await tester.enterText(
      find.byKey(PostFormScreen.descriptionFieldKey),
      'Eight days of observance.',
    );
    await tester.tap(find.byKey(PostFormScreen.saveKey));
    await tester.pumpAndSettle();

    expect(feed.log.of('createPost'), hasLength(1));
    expect(feed.createdInput?.title, 'Paryushan begins');
    expect(feed.createdInput?.description, 'Eight days of observance.');
    expect(feed.createdInput?.type, PostType.event);
    // Saving returns to the list and reloads it.
    expect(feed.log.countOf('listAllForAdmin'), 2);
  });

  testWidgets('Edit loads the post via getPost and sends only changed fields', (
    tester,
  ) async {
    final existing = aPost(
      id: 'p-7',
      title: 'Original title',
      description: 'Original description',
    );
    feed.adminPosts = [existing];
    feed.post = existing;

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(AdminPostListScreen.editKeyFor('p-7')));
    await tester.pumpAndSettle();

    // getPost(id) is how the form loads it — it works even for an aged-out post.
    expect(feed.log.of('getPost'), ['getPost:p-7']);
    expect(
      tester
          .widget<TextField>(find.byKey(PostFormScreen.titleFieldKey))
          .controller
          ?.text,
      'Original title',
    );

    await tester.enterText(
      find.byKey(PostFormScreen.titleFieldKey),
      'Renamed title',
    );
    await tester.tap(find.byKey(PostFormScreen.saveKey));
    await tester.pumpAndSettle();

    expect(feed.log.of('updatePost:p-7'), hasLength(1));
    // Only `title` changed, so only `title` is sent.
    expect(feed.updatedInput?.toJson(), {'title': 'Renamed title'});
  });

  testWidgets('Delete requires confirmation before it calls the service', (
    tester,
  ) async {
    final post = aPost(id: 'p-9', title: 'Doomed');
    feed.adminPosts = [post];
    feed.post = post;

    await pumpAppAndSettle(tester, screen());

    // Cancelling the dialog does NOT delete.
    await tester.tap(find.byKey(AdminPostListScreen.deleteKeyFor('p-9')));
    await tester.pumpAndSettle();
    expect(
      find.text('Delete this post? It will no longer appear in the feed.'),
      findsOneWidget,
    );
    await tester.tap(find.byKey(ConfirmDestructiveActionDialog.cancelKey));
    await tester.pumpAndSettle();
    expect(feed.log.of('deletePost:p-9'), isEmpty);
    expect(feed.deletedId, isNull);

    // Confirming does.
    await tester.tap(find.byKey(AdminPostListScreen.deleteKeyFor('p-9')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(ConfirmDestructiveActionDialog.confirmKey));
    await tester.pumpAndSettle();
    expect(feed.deletedId, 'p-9');
    expect(feed.log.countOf('listAllForAdmin'), 2);
  });

  testWidgets("a lost-admin refusal is shown as the server's own copy", (
    tester,
  ) async {
    // BR2.3's server-side refusal, e.g. after the caller was removed from Admin.
    feed.adminListFailure = const ApiException('Admin access required.');

    await pumpAppAndSettle(tester, screen());

    expect(find.byType(ErrorState), findsOneWidget);
    expect(find.text('Admin access required.'), findsOneWidget);
    expect(find.byType(PostCard), findsNothing);
  });

  testWidgets('a delete refusal shows inline and leaves the post in place', (
    tester,
  ) async {
    final post = aPost(id: 'p-9', title: 'Survivor');
    feed.adminPosts = [post];
    feed.post = post;
    feed.writeFailure = const ApiException('Admin access required.');

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(AdminPostListScreen.deleteKeyFor('p-9')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(ConfirmDestructiveActionDialog.confirmKey));
    await tester.pumpAndSettle();

    expect(find.byKey(AdminPostListScreen.actionErrorKey), findsOneWidget);
    expect(find.text('Survivor'), findsOneWidget);
  });

  testWidgets('no posts yet shows the empty state pointing to New Post', (
    tester,
  ) async {
    feed.adminPosts = const [];

    await pumpAppAndSettle(tester, screen());

    expect(
      find.text('No posts yet. Tap New Post to add the first one.'),
      findsOneWidget,
    );
    expect(find.byType(ErrorState), findsNothing);
    // The New Post action is still available from the empty state.
    expect(find.byKey(AdminPostListScreen.newPostKey), findsOneWidget);
  });
}
