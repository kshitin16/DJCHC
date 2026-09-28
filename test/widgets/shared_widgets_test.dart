/// Shared-widget tests (plan Step 10.1).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/reminder.dart';
import 'package:sarovar_jinalaya/utils/feature_flags.dart';
import 'package:sarovar_jinalaya/utils/ist_time.dart';
import 'package:sarovar_jinalaya/widgets/bottom_nav_bar.dart';
import 'package:sarovar_jinalaya/widgets/calendar_view.dart';
import 'package:sarovar_jinalaya/widgets/confirm_destructive_action_dialog.dart';
import 'package:sarovar_jinalaya/widgets/list_items.dart';
import 'package:sarovar_jinalaya/widgets/state_widgets.dart';

import '../support/fixtures.dart';
import '../support/pump_app.dart';

void main() {
  testWidgets('ErrorState shows the message and reports a retry tap', (
    tester,
  ) async {
    var retries = 0;
    await pumpApp(
      tester,
      Scaffold(
        body: ErrorState(
          message: 'Could not reach the server.',
          retryLabel: 'Try again',
          onRetry: () => retries++,
          retryKey: const ValueKey('feed.retry'),
        ),
      ),
    );

    expect(find.text('Could not reach the server.'), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('feed.retry')));
    await tester.pump();
    expect(retries, 1);
  });

  testWidgets(
    'ErrorState omits the retry button when there is nothing to retry',
    (tester) async {
      await pumpApp(
        tester,
        const Scaffold(
          body: ErrorState(
            message: 'Admin access required.',
            retryLabel: 'Try again',
          ),
        ),
      );

      expect(find.text('Admin access required.'), findsOneWidget);
      expect(find.byType(FilledButton), findsNothing);
    },
  );

  testWidgets('EmptyState shows its per-screen copy with no error styling', (
    tester,
  ) async {
    await pumpApp(
      tester,
      const Scaffold(
        body: EmptyState(message: 'Nothing here yet.', icon: Icons.inbox),
      ),
    );

    expect(find.byKey(const ValueKey('empty.message')), findsOneWidget);
    expect(find.text('Nothing here yet.'), findsOneWidget);
    // The error icon belongs to ErrorState only.
    expect(find.byIcon(Icons.error_outline), findsNothing);
  });

  testWidgets('LoadingSkeleton renders the requested number of placeholders', (
    tester,
  ) async {
    await pumpApp(tester, const Scaffold(body: LoadingSkeleton(itemCount: 3)));

    expect(find.byKey(const ValueKey('loading.skeleton')), findsOneWidget);
    // Three rows, each with three bars.
    expect(find.byType(Container), findsNWidgets(9));
  });

  testWidgets(
    'the destructive-action dialog returns true only when confirmed',
    (tester) async {
      Future<bool?> showAndAnswer(Key answer) async {
        bool? outcome;
        await pumpApp(
          tester,
          Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                key: const ValueKey('open'),
                onPressed: () async {
                  outcome = await ConfirmDestructiveActionDialog.show(
                    context,
                    message: 'Delete this post?',
                    confirmLabel: 'Delete',
                    cancelLabel: 'Cancel',
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
        );
        await tester.tap(find.byKey(const ValueKey('open')));
        await tester.pumpAndSettle();
        expect(find.text('Delete this post?'), findsOneWidget);
        await tester.tap(find.byKey(answer));
        await tester.pumpAndSettle();
        return outcome;
      }

      expect(
        await showAndAnswer(ConfirmDestructiveActionDialog.cancelKey),
        isFalse,
      );
      expect(
        await showAndAnswer(ConfirmDestructiveActionDialog.confirmKey),
        isTrue,
      );
    },
  );

  testWidgets('BottomNavBar shows 4 tabs by default and 6 with both flags on', (
    tester,
  ) async {
    Future<void> pumpNav(FeatureFlags flags) async {
      final tabs = AppTab.visibleUnder(flags);
      await pumpApp(
        tester,
        Scaffold(
          bottomNavigationBar: BottomNavBar(
            tabs: tabs,
            currentTab: AppTab.feed,
            onSelected: (_) {},
            strings: stringsFor(),
          ),
        ),
      );
    }

    await pumpNav(FeatureFlags.allOff);
    expect(find.byType(NavigationDestination), findsNWidgets(4));
    expect(find.byKey(BottomNavBar.keyFor(AppTab.feed)), findsOneWidget);
    expect(find.byKey(BottomNavBar.keyFor(AppTab.calendar)), findsOneWidget);
    expect(find.byKey(BottomNavBar.keyFor(AppTab.donate)), findsNothing);
    expect(find.byKey(BottomNavBar.keyFor(AppTab.library)), findsNothing);

    await pumpNav(FeatureFlags.allOn);
    expect(find.byType(NavigationDestination), findsNWidgets(6));
    expect(find.byKey(BottomNavBar.keyFor(AppTab.donate)), findsOneWidget);
    expect(find.byKey(BottomNavBar.keyFor(AppTab.library)), findsOneWidget);
    // Account stays the rightmost entry in both configurations.
    expect(AppTab.visibleUnder(FeatureFlags.allOn).last, AppTab.account);
    expect(AppTab.visibleUnder(FeatureFlags.allOff).last, AppTab.account);
  });

  testWidgets('BottomNavBar reports the tapped tab', (tester) async {
    final selected = <AppTab>[];
    await pumpApp(
      tester,
      Scaffold(
        bottomNavigationBar: BottomNavBar(
          tabs: AppTab.visibleUnder(FeatureFlags.allOff),
          currentTab: AppTab.feed,
          onSelected: selected.add,
          strings: stringsFor(),
        ),
      ),
    );

    await tester.tap(find.byKey(BottomNavBar.keyFor(AppTab.calendar)));
    await tester.pump();
    await tester.tap(find.byKey(BottomNavBar.keyFor(AppTab.account)));
    await tester.pump();

    expect(selected, [AppTab.calendar, AppTab.account]);
  });

  testWidgets('CalendarView marks event days only, and reports a day tap', (
    tester,
  ) async {
    final eventDay = DateTime.utc(2026, 4, 12);
    final tapped = <DateTime>[];
    await pumpApp(
      tester,
      Scaffold(
        body: SingleChildScrollView(
          child: CalendarView(
            month: DateTime.utc(2026, 4, 1),
            markedDays: {eventDay},
            onDaySelected: tapped.add,
          ),
        ),
      ),
    );

    expect(find.byKey(CalendarView.monthLabelKey), findsOneWidget);
    expect(find.text('April 2026'), findsOneWidget);
    // Exactly one marker, on the event day.
    expect(find.byKey(CalendarView.markerKeyForDay(eventDay)), findsOneWidget);
    expect(
      find.byKey(CalendarView.markerKeyForDay(DateTime.utc(2026, 4, 11))),
      findsNothing,
    );
    // April has 30 days, so 30 cells.
    expect(find.byType(InkWell), findsNWidgets(30));

    await tester.tap(find.byKey(CalendarView.keyForDay(eventDay)));
    await tester.pump();
    expect(tapped, [eventDay]);
  });

  testWidgets('CalendarView steps months when the controls are wired', (
    tester,
  ) async {
    final months = <DateTime>[];
    await pumpApp(
      tester,
      Scaffold(
        body: SingleChildScrollView(
          child: CalendarView(
            month: DateTime.utc(2026, 4, 1),
            markedDays: const {},
            onDaySelected: (_) {},
            onMonthChanged: months.add,
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(CalendarView.nextMonthKey));
    await tester.pump();
    await tester.tap(find.byKey(CalendarView.previousMonthKey));
    await tester.pump();

    expect(months, [DateTime.utc(2026, 5), DateTime.utc(2026, 3)]);
  });

  testWidgets('ReminderStatusBadge labels each status and hides when absent', (
    tester,
  ) async {
    final strings = stringsFor();
    for (final entry in const {
      ReminderStatus.scheduled: 'Reminder set',
      ReminderStatus.snoozed: 'Snoozed',
      ReminderStatus.fired: 'Reminded',
      ReminderStatus.cleared: 'Done',
      ReminderStatus.cancelled: 'No reminder',
    }.entries) {
      await pumpApp(
        tester,
        Scaffold(
          body: ReminderStatusBadge(status: entry.key, strings: strings),
        ),
      );
      expect(
        find.text(entry.value),
        findsOneWidget,
        reason: 'label for ${entry.key.graphQlValue}',
      );
    }

    // No reminder row yet (pre-backfill) renders nothing at all.
    await pumpApp(
      tester,
      Scaffold(body: ReminderStatusBadge(status: null, strings: strings)),
    );
    expect(find.byKey(ReminderStatusBadge.badgeKey), findsNothing);
  });

  testWidgets('PostCard shows the type badge and the IST date/time', (
    tester,
  ) async {
    // 03:30Z is 09:00 IST.
    final post = aPost(dateTime: DateTime.utc(2026, 4, 12, 3, 30));
    await pumpApp(
      tester,
      Scaffold(
        body: PostCard(post: post, strings: stringsFor()),
      ),
    );

    expect(find.byKey(PostCard.keyFor(post.id)), findsOneWidget);
    expect(find.text('Event'), findsOneWidget);
    expect(find.text('12 Apr 2026, 9:00 AM IST'), findsOneWidget);
    expect(find.text(post.title), findsOneWidget);
    expect(find.text(post.description), findsOneWidget);
    expect(formatIstDateTime(post.dateTime), '12 Apr 2026, 9:00 AM IST');
  });
}
