/// An in-house month-grid calendar (frontend-components.md "Shared Widgets").
///
/// Written rather than taken from a package: a month grid is small, fully
/// testable, and needs exactly one behaviour beyond a grid — marking the IST days
/// that carry an EVENT post and reporting a tap on one (plan's "Dependencies"
/// note on `table_calendar`).
///
/// Every day cell carries a `Key` of the form `calendar.day.2026-04-12` so a
/// widget test can tap a specific date.
library;

import 'package:flutter/material.dart';

import '../utils/ist_time.dart';

class CalendarView extends StatelessWidget {
  const CalendarView({
    required this.month,
    required this.markedDays,
    required this.onDaySelected,
    this.selectedDay,
    this.onMonthChanged,
    super.key,
  });

  /// Any instant inside the month to display; only its IST year and month matter.
  final DateTime month;

  /// The IST days (midnight-IST wall-clock values, as `istDay` returns) that
  /// have at least one event.
  final Set<DateTime> markedDays;

  /// The currently selected IST day, if any.
  final DateTime? selectedDay;

  final ValueChanged<DateTime> onDaySelected;

  /// Null hides the month-stepping controls.
  final ValueChanged<DateTime>? onMonthChanged;

  static const Key previousMonthKey = ValueKey('calendar.previousMonth');
  static const Key nextMonthKey = ValueKey('calendar.nextMonth');
  static const Key monthLabelKey = ValueKey('calendar.monthLabel');

  /// The key for one day cell, e.g. `calendar.day.2026-04-12`.
  static Key keyForDay(DateTime day) =>
      ValueKey('calendar.day.${_iso(istDay(day))}');

  /// The marker shown inside a day that has an event.
  static Key markerKeyForDay(DateTime day) =>
      ValueKey('calendar.marker.${_iso(istDay(day))}');

  static String _iso(DateTime day) =>
      '${day.year.toString().padLeft(4, '0')}-'
      '${day.month.toString().padLeft(2, '0')}-'
      '${day.day.toString().padLeft(2, '0')}';

  static const List<String> _weekdayInitials = [
    'M',
    'T',
    'W',
    'T',
    'F',
    'S',
    'S',
  ];
  static const List<String> _monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ist = toIst(month);
    final firstOfMonth = DateTime.utc(ist.year, ist.month);
    final daysInMonth = DateTime.utc(
      ist.year,
      ist.month + 1,
    ).difference(firstOfMonth).inDays;
    // `weekday` is 1 (Monday) .. 7 (Sunday); the grid starts on Monday.
    final leadingBlanks = firstOfMonth.weekday - 1;

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            if (onMonthChanged != null)
              IconButton(
                key: previousMonthKey,
                icon: const Icon(Icons.chevron_left),
                onPressed: () =>
                    onMonthChanged!(DateTime.utc(ist.year, ist.month - 1)),
              )
            else
              const SizedBox(width: 48),
            Text(
              '${_monthNames[ist.month - 1]} ${ist.year}',
              key: monthLabelKey,
              style: theme.textTheme.titleMedium,
            ),
            if (onMonthChanged != null)
              IconButton(
                key: nextMonthKey,
                icon: const Icon(Icons.chevron_right),
                onPressed: () =>
                    onMonthChanged!(DateTime.utc(ist.year, ist.month + 1)),
              )
            else
              const SizedBox(width: 48),
          ],
        ),
        Row(
          children: [
            for (final initial in _weekdayInitials)
              Expanded(
                child: Center(
                  child: Text(initial, style: theme.textTheme.labelSmall),
                ),
              ),
          ],
        ),
        const SizedBox(height: 4),
        GridView.count(
          crossAxisCount: 7,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            for (var i = 0; i < leadingBlanks; i++) const SizedBox.shrink(),
            for (var day = 1; day <= daysInMonth; day++)
              _DayCell(
                day: DateTime.utc(ist.year, ist.month, day),
                isMarked: markedDays.contains(
                  DateTime.utc(ist.year, ist.month, day),
                ),
                isSelected:
                    selectedDay != null &&
                    istDay(selectedDay!) ==
                        DateTime.utc(ist.year, ist.month, day),
                onTap: onDaySelected,
              ),
          ],
        ),
      ],
    );
  }
}

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.day,
    required this.isMarked,
    required this.isSelected,
    required this.onTap,
  });

  final DateTime day;
  final bool isMarked;
  final bool isSelected;
  final ValueChanged<DateTime> onTap;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return InkWell(
      key: CalendarView.keyForDay(day),
      onTap: () => onTap(day),
      customBorder: const CircleBorder(),
      child: Container(
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isSelected ? scheme.primaryContainer : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('${day.day}'),
            const SizedBox(height: 2),
            if (isMarked)
              Container(
                key: CalendarView.markerKeyForDay(day),
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: scheme.primary,
                ),
              )
            else
              const SizedBox(height: 6),
          ],
        ),
      ),
    );
  }
}
