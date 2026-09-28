/// Feed screen tests (plan Step 10.2).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/post.dart';
import 'package:sarovar_jinalaya/screens/feed_screen.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/state/auth_state.dart';
import 'package:sarovar_jinalaya/widgets/list_items.dart';
import 'package:sarovar_jinalaya/widgets/state_widgets.dart';

import '../support/fake_gateways.dart';
import '../support/fake_services.dart';
import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  late FakeFeedService feed;
  late AuthState authState;
  late FakeAuthGateway authGateway;

  Future<void> signIn({bool signedIn = false}) async {
    final resolved = await resolvedAuthState(signedIn: signedIn);
    authState = resolved.state;
    authGateway = resolved.gateway;
  }

  setUp(() => feed = FakeFeedService());

  tearDown(() async {
    authState.dispose();
    await authGateway.close();
  });

  Widget screenUnderTest({VoidCallback? onSignInTap}) => FeedScreen(
    feedService: feed,
    authState: authState,
    strings: stringsFor(),
    onSignInTap: onSignInTap,
  );

  testWidgets('shows the skeleton first, then the loaded posts', (
    tester,
  ) async {
    await signIn();
    feed.posts = [
      aPost(id: 'p-1', title: 'Paryushan begins'),
      aPost(
        id: 'p-2',
        title: 'Visiting acharya',
        type: PostType.visitingDignitary,
      ),
    ];

    // The first frame is the Loading state, before the service call resolves —
    // this is what keeps the screen transition inside NFR-PERF.2's budget.
    await tester.pumpWidget(MaterialApp(home: screenUnderTest()));
    expect(find.byType(LoadingSkeleton), findsOneWidget);

    await tester.pumpAndSettle();
    expect(find.byType(LoadingSkeleton), findsNothing);
    expect(find.byKey(FeedScreen.listKey), findsOneWidget);
    expect(find.text('Paryushan begins'), findsOneWidget);
    expect(find.text('Visiting acharya'), findsOneWidget);
    expect(find.byKey(PostCard.keyFor('p-1')), findsOneWidget);
  });

  testWidgets('an empty feed renders the empty state, not an error', (
    tester,
  ) async {
    await signIn();
    feed.posts = const [];

    await pumpAppAndSettle(tester, screenUnderTest());

    expect(
      find.text('Nothing here yet. New temple happenings will appear here.'),
      findsOneWidget,
    );
    expect(find.byType(ErrorState), findsNothing);
    expect(find.byKey(FeedScreen.retryKey), findsNothing);
  });

  testWidgets(
    'an error shows the server message and retry re-calls the service',
    (tester) async {
      await signIn();
      feed.listFailure = const ApiException.transport(
        'Could not reach the server.',
      );

      await pumpAppAndSettle(tester, screenUnderTest());

      expect(find.text('Could not reach the server.'), findsOneWidget);
      expect(feed.log.countOf('listPosts'), 1);

      // Retry succeeds the second time.
      feed.listFailure = null;
      feed.posts = [aPost(title: 'Back online')];
      await tester.tap(find.byKey(FeedScreen.retryKey));
      await tester.pumpAndSettle();

      expect(feed.log.countOf('listPosts'), 2);
      expect(find.text('Back online'), findsOneWidget);
      expect(find.byType(ErrorState), findsNothing);
    },
  );

  testWidgets('a signed-out reader lists as a guest', (tester) async {
    await signIn();
    feed.posts = [aPost()];

    await pumpAppAndSettle(tester, screenUnderTest());

    // `false` makes FeedService use AuthMode.identityPool (the guest role).
    expect(feed.lastListSignedIn, isFalse);
  });

  testWidgets('a signed-in reader lists with their User Pool token', (
    tester,
  ) async {
    await signIn(signedIn: true);
    feed.posts = [aPost()];

    await pumpAppAndSettle(tester, screenUnderTest());

    expect(feed.lastListSignedIn, isTrue);
  });

  testWidgets('the app-bar action reads Sign In when signed out', (
    tester,
  ) async {
    await signIn();
    feed.posts = [aPost()];
    var taps = 0;

    await pumpAppAndSettle(tester, screenUnderTest(onSignInTap: () => taps++));

    expect(_actionLabel(tester), 'Sign In');
    await tester.tap(find.byKey(FeedScreen.signInKey));
    await tester.pump();
    expect(taps, 1);
  });

  testWidgets('the app-bar action reads Account when signed in', (
    tester,
  ) async {
    await signIn(signedIn: true);
    feed.posts = [aPost()];

    await pumpAppAndSettle(tester, screenUnderTest());

    expect(_actionLabel(tester), 'Account');
  });

  testWidgets('a post card shows its type badge and IST date', (tester) async {
    await signIn();
    feed.posts = [
      aPost(
        id: 'p-9',
        title: 'Mahavir Jayanti',
        type: PostType.event,
        // 03:30Z is 09:00 IST.
        dateTime: DateTime.utc(2026, 4, 12, 3, 30),
      ),
    ];

    await pumpAppAndSettle(tester, screenUnderTest());

    expect(find.text('Event'), findsOneWidget);
    expect(find.text('12 Apr 2026, 9:00 AM IST'), findsOneWidget);
    expect(find.text('Mahavir Jayanti'), findsOneWidget);
  });
}

/// The app-bar action's visible label.
String? _actionLabel(WidgetTester tester) => tester
    .widget<Text>(
      find.descendant(
        of: find.byKey(FeedScreen.signInKey),
        matching: find.byType(Text),
      ),
    )
    .data;
