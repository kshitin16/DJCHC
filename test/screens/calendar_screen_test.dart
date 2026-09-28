/// Calendar screen tests (plan Step 10.8) — FR7.1-FR7.8.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/post.dart';
import 'package:sarovar_jinalaya/models/reminder.dart';
import 'package:sarovar_jinalaya/screens/calendar_screen.dart';
import 'package:sarovar_jinalaya/services/auth_service.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';
import 'package:sarovar_jinalaya/services/reminder_service.dart';
import 'package:sarovar_jinalaya/state/auth_state.dart';
import 'package:sarovar_jinalaya/state/device_identity_state.dart';
import 'package:sarovar_jinalaya/utils/ist_time.dart';
import 'package:sarovar_jinalaya/widgets/calendar_view.dart';
import 'package:sarovar_jinalaya/widgets/confirm_destructive_action_dialog.dart';
import 'package:sarovar_jinalaya/widgets/state_widgets.dart';

import '../support/fake_gateways.dart';
import '../support/fake_services.dart';
import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  late FakeFeedService feed;
  late FakeReminderService reminders;
  late DeviceIdentityState deviceIdentity;
  late FakeAuthGateway authGateway;
  late AuthState authState;
  late CallLog log;

  /// 1 March 2026, 15:30 IST.
  final now = DateTime.utc(2026, 3, 1, 10);

  /// An upcoming event on 12 March 2026, 09:00 IST — inside the month the
  /// calendar opens on, so its marker is visible without stepping months.
  final marchEvent = DateTime.utc(2026, 3, 12, 3, 30);
  final marchDay = istDay(marchEvent);

  setUp(() async {
    log = CallLog();
    feed = FakeFeedService(log: log);
    reminders = FakeReminderService(log: log);
    deviceIdentity = DeviceIdentityState(reminders);
    authGateway = FakeAuthGateway(session: aSession(signedIn: false));
    authState = AuthState(AuthService(authGateway));
    await authState.refresh();
  });

  tearDown(() async {
    authState.dispose();
    deviceIdentity.dispose();
    await authGateway.close();
  });

  /// The month grid plus the selected day's events do not fit the default
  /// 800x600 test surface, and a `ListView` never builds off-screen children —
  /// so these tests run on a tall phone-shaped surface rather than scrolling in
  /// every single case.
  void useTallSurface(WidgetTester tester) {
    tester.view.physicalSize = const Size(400, 1800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
  }

  Widget screen({String? initialPostId}) => CalendarScreen(
    feedService: feed,
    reminderService: reminders,
    deviceIdentity: deviceIdentity,
    authState: authState,
    strings: stringsFor(),
    now: now,
    initialPostId: initialPostId,
  );

  testWidgets('only EVENT posts appear; other types are excluded', (
    tester,
  ) async {
    useTallSurface(tester);
    feed.posts = [
      aPost(id: 'p-event', title: 'Mahavir Jayanti', dateTime: marchEvent),
      aPost(
        id: 'p-dignitary',
        title: 'Visiting acharya',
        type: PostType.visitingDignitary,
        dateTime: marchEvent,
      ),
      aPost(
        id: 'p-callout',
        title: 'Roof fund',
        type: PostType.donationCallOut,
        dateTime: marchEvent,
      ),
    ];

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(CalendarView.keyForDay(marchDay)));
    await tester.pumpAndSettle();

    // FR7.1: the calendar is EVENT-only.
    expect(find.text('Mahavir Jayanti'), findsOneWidget);
    expect(find.text('Visiting acharya'), findsNothing);
    expect(find.text('Roof fund'), findsNothing);
    // No new backend query was needed — listPosts is reused.
    expect(feed.log.of('listPosts'), hasLength(1));
  });

  testWidgets('past events are excluded, and today still counts as upcoming', (
    tester,
  ) async {
    useTallSurface(tester);
    feed.posts = [
      aPost(
        id: 'p-past',
        title: 'Last month',
        dateTime: DateTime.utc(2026, 2, 1, 3, 30),
      ),
      // Earlier TODAY in IST — still on today's calendar.
      aPost(
        id: 'p-today',
        title: 'This morning',
        dateTime: DateTime.utc(2026, 3, 1, 3, 30),
      ),
      aPost(id: 'p-future', title: 'Later this month', dateTime: marchEvent),
    ];

    await pumpAppAndSettle(tester, screen());

    // Markers: today and the 12th, not February.
    expect(
      find.byKey(CalendarView.markerKeyForDay(istDay(now))),
      findsOneWidget,
    );
    expect(
      find.byKey(CalendarView.markerKeyForDay(DateTime.utc(2026, 2, 1))),
      findsNothing,
    );

    await tester.tap(find.byKey(CalendarView.keyForDay(istDay(now))));
    await tester.pumpAndSettle();
    expect(find.text('This morning'), findsOneWidget);
    expect(find.text('Last month'), findsNothing);
  });

  testWidgets('the identity is resolved BEFORE myReminders is called', (
    tester,
  ) async {
    useTallSurface(tester);
    feed.posts = [aPost(id: 'p-1', dateTime: marchEvent)];
    reminders.reminders = [aReminder(postId: 'p-1')];

    await pumpAppAndSettle(tester, screen());

    // Contract 9 is scoped by the identity, so the order is not optional.
    expect(log.entries, [
      'listPosts:signedIn=false',
      'resolveIdentity',
      'requestPermissionAndToken',
      'myReminders',
    ]);
    expect(deviceIdentity.identityId, 'ap-south-1:guest-identity-1');
  });

  testWidgets('an unresolvable identity skips Contract 9 rather than failing', (
    tester,
  ) async {
    useTallSurface(tester);
    feed.posts = [aPost(id: 'p-1', dateTime: marchEvent)];
    reminders.identityId = null;

    await pumpAppAndSettle(tester, screen());

    // Browsing still works; the reminder sync simply does not happen.
    expect(log.of('myReminders'), isEmpty);
    expect(find.byKey(CalendarView.monthLabelKey), findsOneWidget);
  });

  testWidgets('denied notification permission is explained plainly', (
    tester,
  ) async {
    useTallSurface(tester);
    feed.posts = [aPost(id: 'p-1', dateTime: marchEvent)];
    reminders.permissionGranted = false;

    await pumpAppAndSettle(tester, screen());

    expect(find.byKey(CalendarScreen.permissionNoticeKey), findsOneWidget);
    expect(
      find.textContaining('Notifications are turned off for this app'),
      findsOneWidget,
    );
    // The device still got an identity, so browsing and viewing work.
    expect(deviceIdentity.identityId, isNotNull);
    expect(find.byKey(CalendarView.monthLabelKey), findsOneWidget);
  });

  testWidgets('granted permission shows no notice', (tester) async {
    useTallSurface(tester);
    feed.posts = [aPost(id: 'p-1', dateTime: marchEvent)];
    reminders.reminders = [aReminder(postId: 'p-1')];

    await pumpAppAndSettle(tester, screen());

    expect(find.byKey(CalendarScreen.permissionNoticeKey), findsNothing);
  });

  testWidgets('Snooze calls the service and adopts the returned status', (
    tester,
  ) async {
    useTallSurface(tester);
    feed.posts = [
      aPost(id: 'p-1', title: 'Mahavir Jayanti', dateTime: marchEvent),
    ];
    reminders.reminders = [
      aReminder(id: 'rem-1', postId: 'p-1', status: ReminderStatus.scheduled),
    ];
    reminders.snoozed = aReminder(
      id: 'rem-1',
      postId: 'p-1',
      status: ReminderStatus.snoozed,
    );

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(CalendarView.keyForDay(marchDay)));
    await tester.pumpAndSettle();

    expect(find.text('Reminder set'), findsOneWidget);
    await tester.tap(find.byKey(CalendarScreen.snoozeKeyFor('p-1')));
    await tester.pumpAndSettle();

    expect(reminders.snoozedId, 'rem-1');
    expect(find.text('Snoozed'), findsOneWidget);
    expect(find.byKey(CalendarScreen.actionErrorKey), findsNothing);
  });

  testWidgets("a cutoff refusal shows inline with the server's own wording", (
    tester,
  ) async {
    useTallSurface(tester);
    feed.posts = [aPost(id: 'p-1', dateTime: marchEvent)];
    reminders.reminders = [
      aReminder(id: 'rem-1', postId: 'p-1', status: ReminderStatus.fired),
    ];
    reminders.snoozeFailure = const ReminderFailure(
      ReminderFailureKind.cutoffPassed,
      'It is too late to snooze: the 9:00 PM IST cutoff has passed.',
    );

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(CalendarView.keyForDay(marchDay)));
    await tester.pumpAndSettle();

    // BR7.3: Snooze is still offered while FIRED; the server decides.
    expect(find.byKey(CalendarScreen.snoozeKeyFor('p-1')), findsOneWidget);
    await tester.tap(find.byKey(CalendarScreen.snoozeKeyFor('p-1')));
    await tester.pumpAndSettle();

    expect(find.byKey(CalendarScreen.actionErrorKey), findsOneWidget);
    expect(find.textContaining('9:00 PM IST'), findsOneWidget);
    // The status is unchanged.
    expect(find.text('Reminded'), findsOneWidget);
  });

  testWidgets('Snooze is hidden for a terminal reminder', (tester) async {
    useTallSurface(tester);
    feed.posts = [aPost(id: 'p-1', dateTime: marchEvent)];
    reminders.reminders = [
      aReminder(id: 'rem-1', postId: 'p-1', status: ReminderStatus.cancelled),
    ];

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(CalendarView.keyForDay(marchDay)));
    await tester.pumpAndSettle();

    expect(find.byKey(CalendarScreen.snoozeKeyFor('p-1')), findsNothing);
    expect(find.byKey(CalendarScreen.cancelKeyFor('p-1')), findsNothing);
    expect(find.text('No reminder'), findsOneWidget);
  });

  testWidgets('Cancel requires confirmation, then calls the service', (
    tester,
  ) async {
    useTallSurface(tester);
    feed.posts = [aPost(id: 'p-1', dateTime: marchEvent)];
    reminders.reminders = [
      aReminder(id: 'rem-1', postId: 'p-1', status: ReminderStatus.scheduled),
    ];
    reminders.cancelledReminder = aReminder(
      id: 'rem-1',
      postId: 'p-1',
      status: ReminderStatus.cancelled,
    );

    await pumpAppAndSettle(tester, screen());
    await tester.tap(find.byKey(CalendarView.keyForDay(marchDay)));
    await tester.pumpAndSettle();

    // Backing out does not cancel.
    await tester.tap(find.byKey(CalendarScreen.cancelKeyFor('p-1')));
    await tester.pumpAndSettle();
    expect(find.textContaining('You will not be notified.'), findsOneWidget);
    await tester.tap(find.byKey(ConfirmDestructiveActionDialog.cancelKey));
    await tester.pumpAndSettle();
    expect(reminders.cancelledId, isNull);

    // Confirming does.
    await tester.tap(find.byKey(CalendarScreen.cancelKeyFor('p-1')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(ConfirmDestructiveActionDialog.confirmKey));
    await tester.pumpAndSettle();

    expect(reminders.cancelledId, 'rem-1');
    expect(find.text('No reminder'), findsOneWidget);
  });

  testWidgets('a push deep link selects the event\'s IST date', (tester) async {
    useTallSurface(tester);
    feed.posts = [
      aPost(
        id: 'p-other',
        title: 'Other event',
        dateTime: DateTime.utc(2026, 5, 3, 3, 30),
      ),
      // Deliberately in a LATER month than the one the calendar opens on, so the
      // deep link has to move the visible month as well as select the day.
      aPost(
        id: 'p-target',
        title: 'Mahavir Jayanti',
        dateTime: DateTime.utc(2026, 4, 12, 3, 30),
      ),
    ];
    reminders.reminders = [aReminder(postId: 'p-target')];

    await pumpAppAndSettle(tester, screen(initialPostId: 'p-target'));

    // The tapped notification's event day is already selected and its event
    // shown, with no extra tap needed.
    expect(find.text('Mahavir Jayanti'), findsOneWidget);
    expect(find.text('April 2026'), findsOneWidget);
    expect(find.text('Other event'), findsNothing);
  });

  testWidgets('no upcoming events shows the empty state; a failure retries', (
    tester,
  ) async {
    useTallSurface(tester);
    feed.posts = const [];
    await pumpAppAndSettle(tester, screen());
    expect(find.text('No upcoming events yet.'), findsOneWidget);
    expect(find.byType(ErrorState), findsNothing);

    feed.listFailure = const ApiException.transport(
      'Could not reach the server.',
    );
    await tester.pumpWidget(const SizedBox.shrink());
    await pumpAppAndSettle(tester, screen());
    expect(find.text('Could not reach the server.'), findsOneWidget);

    feed.listFailure = null;
    feed.posts = [aPost(id: 'p-1', title: 'Back online', dateTime: marchEvent)];
    await tester.tap(find.byKey(CalendarScreen.retryKey));
    await tester.pumpAndSettle();
    expect(find.byKey(CalendarView.markerKeyForDay(marchDay)), findsOneWidget);
  });

  testWidgets('a myReminders failure is shown but browsing still works', (
    tester,
  ) async {
    useTallSurface(tester);
    feed.posts = [
      aPost(id: 'p-1', title: 'Mahavir Jayanti', dateTime: marchEvent),
    ];
    reminders.myRemindersFailure = const ApiException.transport('Offline.');

    await pumpAppAndSettle(tester, screen());

    expect(find.byKey(CalendarScreen.actionErrorKey), findsOneWidget);
    expect(find.text('Offline.'), findsOneWidget);
    // The calendar itself still renders.
    expect(find.byKey(CalendarView.markerKeyForDay(marchDay)), findsOneWidget);
    await tester.tap(find.byKey(CalendarView.keyForDay(marchDay)));
    await tester.pumpAndSettle();
    expect(find.text('Mahavir Jayanti'), findsOneWidget);
    // With no reminder row, no controls are offered.
    expect(find.byKey(CalendarScreen.snoozeKeyFor('p-1')), findsNothing);
  });

  testWidgets('selecting a day with no event says so', (tester) async {
    useTallSurface(tester);
    feed.posts = [aPost(id: 'p-1', dateTime: marchEvent)];

    await pumpAppAndSettle(tester, screen());
    await tester.tap(
      find.byKey(CalendarView.keyForDay(DateTime.utc(2026, 3, 15))),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(CalendarScreen.noEventsOnDayKey), findsOneWidget);
    expect(find.text('No events on this day.'), findsOneWidget);
  });
}
