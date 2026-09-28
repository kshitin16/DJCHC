/// Screen 12 — Calendar & Reminders (FR7.1-FR7.8; Contract 3 `listPosts` reused,
/// plus all of Contract 9).
///
/// Access tier: this is the app's one DEVICE-GUEST-IDENTITY screen. Browsing and
/// every reminder action need neither sign-in nor admin status — only the Cognito
/// Identity Pool identity, resolved silently (BR7.6, functional-spec.md's third
/// access tier).
///
/// Sequence on entry:
///   1. `listPosts` (Contract 3), filtered client-side to `type == EVENT` and to
///      upcoming IST days — no new backend query was needed (FR7.1).
///   2. `DeviceIdentityState.ensureResolved()` — Calendar WAITS on the identity
///      before Contract 9, because a reminder is scoped by it.
///   3. Notification permission + `registerDeviceToken` on the FIRST visit only
///      (never at app start, performance-design.md).
///   4. `myReminders`, which also triggers reminder-unit's lazy backfill (BR7.1).
///
/// The identity id changes on sign-in/out (plan rule 4); `DeviceIdentityState`
/// notifies and this screen re-syncs. Existing reminders under the previous
/// identity are deliberately left alone rather than migrated.
library;

import 'package:flutter/material.dart';

import '../models/post.dart';
import '../models/reminder.dart';
import '../services/feed_service.dart';
import '../services/gateways.dart';
import '../services/reminder_service.dart';
import '../state/auth_state.dart';
import '../state/device_identity_state.dart';
import '../state/localization_controller.dart';
import '../utils/ist_time.dart';
import '../utils/screen_state.dart';
import '../widgets/calendar_view.dart';
import '../widgets/confirm_destructive_action_dialog.dart';
import '../widgets/list_items.dart';
import '../widgets/state_widgets.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({
    required this.feedService,
    required this.reminderService,
    required this.deviceIdentity,
    required this.authState,
    required this.strings,
    this.now,
    this.initialPostId,
    super.key,
  });

  final FeedService feedService;
  final ReminderService reminderService;
  final DeviceIdentityState deviceIdentity;
  final AuthState authState;
  final LocalizationController strings;

  /// Injected for tests; defaults to the real clock.
  final DateTime? now;

  /// A post id from a tapped push notification — its IST date is selected once
  /// the events have loaded (deep link).
  final String? initialPostId;

  static const Key retryKey = ValueKey('calendar.retry');
  static const Key permissionNoticeKey = ValueKey('calendar.permissionDenied');
  static const Key dayListKey = ValueKey('calendar.dayList');
  static const Key actionErrorKey = ValueKey('calendar.actionError');
  static const Key noEventsOnDayKey = ValueKey('calendar.noEventsOnDay');
  static Key snoozeKeyFor(String postId) => ValueKey('calendar.snooze.$postId');
  static Key cancelKeyFor(String postId) => ValueKey('calendar.cancel.$postId');

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  final ValueNotifier<ScreenState<List<Post>>> _events = ValueNotifier(
    const ScreenState.loading(),
  );

  /// This device's reminders, keyed by `postId`.
  final ValueNotifier<Map<String, Reminder>> _reminders = ValueNotifier({});

  DateTime? _selectedDay;
  late DateTime _visibleMonth;
  String? _actionError;
  String? _syncedIdentityId;

  /// True while [_enter] runs, so the identity listener does not duplicate the
  /// entry sequence's own reminder sync.
  bool _entering = false;

  DateTime get _now => widget.now ?? DateTime.now().toUtc();

  @override
  void initState() {
    super.initState();
    _visibleMonth = istDay(_now);
    widget.deviceIdentity.addListener(_onIdentityChanged);
    _enter();
  }

  @override
  void dispose() {
    widget.deviceIdentity.removeListener(_onIdentityChanged);
    _events.dispose();
    _reminders.dispose();
    super.dispose();
  }

  /// A new identity id means a different set of reminders (plan rule 4).
  ///
  /// Suppressed while [_enter] is running: resolving the identity for the first
  /// time notifies too, and [_enter] already ends with its own sync — without
  /// this guard the first visit would call `myReminders` twice.
  void _onIdentityChanged() {
    if (_entering) return;
    final current = widget.deviceIdentity.identityId;
    if (current == null || current == _syncedIdentityId) return;
    _syncReminders();
  }

  Future<void> _enter() async {
    _entering = true;
    try {
      await _loadEvents();
      // The identity is required BEFORE Contract 9 can be called at all.
      await widget.deviceIdentity.ensureResolved();
      // First visit only: the OS prompt is never raised at app start.
      await widget.deviceIdentity.ensureRegistered();
    } finally {
      _entering = false;
    }
    await _syncReminders();
  }

  Future<void> _loadEvents() async {
    _events.value = const ScreenState.loading();
    try {
      final posts = await widget.feedService.listPosts(
        signedIn: widget.authState.isSignedIn,
      );
      if (!mounted) return;
      // FR7.1: EVENT posts only — Visiting Dignitary and Donation Call-out are
      // excluded from the calendar — and only days that have not passed in IST.
      final events = posts
          .where((p) => p.isEvent && isUpcomingIst(p.dateTime, now: _now))
          .toList(growable: false);
      _events.value = ScreenState.loaded(events);
      _applyDeepLink(events);
    } on ApiException catch (e) {
      if (!mounted) return;
      _events.value = ScreenState.error(e.message);
    }
  }

  void _applyDeepLink(List<Post> events) {
    final postId = widget.initialPostId;
    if (postId == null || _selectedDay != null) return;
    final match = events.where((p) => p.id == postId).firstOrNull;
    if (match == null) return;
    setState(() {
      _selectedDay = istDay(match.dateTime);
      _visibleMonth = _selectedDay!;
    });
  }

  Future<void> _syncReminders() async {
    final identityId = widget.deviceIdentity.identityId;
    if (identityId == null) return;
    try {
      final reminders = await widget.reminderService.myReminders();
      if (!mounted) return;
      _syncedIdentityId = identityId;
      _reminders.value = {for (final r in reminders) r.postId: r};
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _actionError = e.message);
    }
  }

  Future<void> _snooze(Post post, Reminder reminder) async {
    setState(() => _actionError = null);
    try {
      final updated = await widget.reminderService.snooze(reminder.id);
      if (!mounted) return;
      _reminders.value = {..._reminders.value, updated.postId: updated};
    } on ReminderFailure catch (e) {
      if (!mounted) return;
      // Includes BR7.3's cutoff refusal, shown inline with the server's wording.
      setState(() => _actionError = e.message);
    }
  }

  Future<void> _cancel(Post post, Reminder reminder) async {
    final confirmed = await ConfirmDestructiveActionDialog.show(
      context,
      message: widget.strings.t('calendar.cancelConfirm'),
      confirmLabel: widget.strings.t('calendar.cancelReminder'),
      cancelLabel: widget.strings.t('common.cancel'),
    );
    if (!confirmed) return;
    setState(() => _actionError = null);
    try {
      final updated = await widget.reminderService.cancel(reminder.id);
      if (!mounted) return;
      _reminders.value = {..._reminders.value, updated.postId: updated};
    } on ReminderFailure catch (e) {
      if (!mounted) return;
      setState(() => _actionError = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = widget.strings;
    return Scaffold(
      appBar: AppBar(title: Text(strings.t('calendar.title'))),
      body: ValueListenableBuilder<ScreenState<List<Post>>>(
        valueListenable: _events,
        builder: (context, state, _) => ScreenStateView<List<Post>>(
          state: state,
          emptyMessage: strings.t('calendar.empty'),
          emptyIcon: Icons.event_busy_outlined,
          retryLabel: strings.t('common.retry'),
          onRetry: _enter,
          retryKey: CalendarScreen.retryKey,
          isEmpty: (events) => events.isEmpty,
          builder: _buildCalendar,
        ),
      ),
    );
  }

  Widget _buildCalendar(BuildContext context, List<Post> events) {
    final strings = widget.strings;
    final theme = Theme.of(context);
    final markedDays = {for (final event in events) istDay(event.dateTime)};
    final selected = _selectedDay;
    final dayEvents = selected == null
        ? const <Post>[]
        : events
              .where((e) => istDay(e.dateTime) == selected)
              .toList(growable: false);

    return ListView(
      children: [
        // Permission denied: browsing and viewing still work, and the reason is
        // explained plainly rather than showing nothing (functional-spec.md).
        if (widget.deviceIdentity.permissionRequested &&
            !widget.deviceIdentity.permissionGranted)
          Container(
            key: CalendarScreen.permissionNoticeKey,
            width: double.infinity,
            color: theme.colorScheme.surfaceContainerHighest,
            padding: const EdgeInsets.all(12),
            child: Text(
              strings.t('calendar.permissionDenied'),
              style: theme.textTheme.bodySmall,
            ),
          ),
        if (_actionError != null)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              _actionError!,
              key: CalendarScreen.actionErrorKey,
              style: TextStyle(color: theme.colorScheme.error),
            ),
          ),
        Padding(
          padding: const EdgeInsets.all(8),
          child: CalendarView(
            month: _visibleMonth,
            markedDays: markedDays,
            selectedDay: selected,
            onDaySelected: (day) => setState(() => _selectedDay = day),
            onMonthChanged: (month) => setState(() => _visibleMonth = month),
          ),
        ),
        const Divider(height: 1),
        if (selected != null && dayEvents.isEmpty)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              strings.t('calendar.noEventsOnDay'),
              key: CalendarScreen.noEventsOnDayKey,
              textAlign: TextAlign.center,
            ),
          ),
        ValueListenableBuilder<Map<String, Reminder>>(
          valueListenable: _reminders,
          builder: (context, reminders, _) => Column(
            key: CalendarScreen.dayListKey,
            children: [
              for (final event in dayEvents)
                _EventTile(
                  event: event,
                  reminder: reminders[event.id],
                  strings: strings,
                  onSnooze: () {
                    final reminder = reminders[event.id];
                    if (reminder != null) _snooze(event, reminder);
                  },
                  onCancel: () {
                    final reminder = reminders[event.id];
                    if (reminder != null) _cancel(event, reminder);
                  },
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// One event on the selected day, with its reminder status and controls.
class _EventTile extends StatelessWidget {
  const _EventTile({
    required this.event,
    required this.reminder,
    required this.strings,
    required this.onSnooze,
    required this.onCancel,
  });

  final Post event;

  /// Null until the next `myReminders` sync backfills one (BR7.1).
  final Reminder? reminder;
  final LocalizationController strings;
  final VoidCallback onSnooze;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final current = reminder;
    return ListTile(
      key: ValueKey('calendar.event.${event.id}'),
      title: Text(event.title),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(formatIstDateTime(event.dateTime)),
          if (current != null)
            Text(
              // BR7.2: the push goes out at 9:00 AM IST the day before.
              formatReminderMoment(event.dateTime),
              style: Theme.of(context).textTheme.labelSmall,
            ),
        ],
      ),
      isThreeLine: current != null,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ReminderStatusBadge(status: current?.status, strings: strings),
          // BR7.3: Snooze is offered only while the notification can still be
          // acted on (SCHEDULED or FIRED); the server enforces the 9:00 PM
          // IST cutoff regardless.
          if (current != null && current.canSnooze)
            IconButton(
              key: CalendarScreen.snoozeKeyFor(event.id),
              tooltip: strings.t('calendar.snooze'),
              icon: const Icon(Icons.snooze),
              onPressed: onSnooze,
            ),
          if (current != null && current.canCancel)
            IconButton(
              key: CalendarScreen.cancelKeyFor(event.id),
              tooltip: strings.t('calendar.cancelReminder'),
              icon: const Icon(Icons.notifications_off_outlined),
              onPressed: onCancel,
            ),
        ],
      ),
    );
  }
}
