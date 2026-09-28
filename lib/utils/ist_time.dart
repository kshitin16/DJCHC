/// India Standard Time formatting (FR2.x, FR7.x).
///
/// Every `AWSDateTime` a contract returns is parsed as UTC; every date and time
/// a user sees is rendered in IST. IST is a FIXED +05:30 offset with no daylight
/// saving, so a plain `Duration` shift is exact — no timezone database and no
/// `timezone` package are needed.
library;

/// India Standard Time: UTC+05:30, year-round.
const Duration istOffset = Duration(hours: 5, minutes: 30);

/// The hour (IST) reminder-unit's day-before push is scheduled for (BR7.2).
const int reminderHourIst = 9;

/// The hour (IST) after which a snooze is refused (BR7.3).
const int snoozeCutoffHourIst = 21;

const List<String> _monthsShort = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/// Shifts [instant] onto the IST wall clock.
///
/// The result is a `DateTime` whose Y/M/D/h/m fields read as IST. It is marked
/// UTC so that no host-timezone conversion is ever applied to it again — treat
/// it as a wall-clock value, not as an instant.
DateTime toIst(DateTime instant) => instant.toUtc().add(istOffset);

/// The IST calendar day [instant] falls on, as a midnight-IST wall clock value.
/// This is the key Calendar groups events by.
DateTime istDay(DateTime instant) {
  final ist = toIst(instant);
  return DateTime.utc(ist.year, ist.month, ist.day);
}

/// Whether two instants fall on the same IST calendar day.
bool isSameIstDay(DateTime a, DateTime b) => istDay(a) == istDay(b);

/// `12 Apr 2026` — an event's date in IST.
String formatIstDate(DateTime instant) {
  final ist = toIst(instant);
  return '${ist.day} ${_monthsShort[ist.month - 1]} ${ist.year}';
}

/// `9:00 AM` — an event's time in IST, 12-hour with a meridiem.
String formatIstTime(DateTime instant) {
  final ist = toIst(instant);
  final meridiem = ist.hour < 12 ? 'AM' : 'PM';
  final hour12 = switch (ist.hour % 12) {
    0 => 12,
    final h => h,
  };
  final minute = ist.minute.toString().padLeft(2, '0');
  return '$hour12:$minute $meridiem';
}

/// `12 Apr 2026, 9:00 AM IST` — the full rendering feed and calendar cards use.
String formatIstDateTime(DateTime instant) =>
    '${formatIstDate(instant)}, ${formatIstTime(instant)} IST';

/// The reminder copy for an event: "9:00 AM IST on 11 Apr 2026" — the day
/// BEFORE the event (BR7.2).
String formatReminderMoment(DateTime eventInstant) {
  final dayBefore = istDay(eventInstant).subtract(const Duration(days: 1));
  return '$reminderHourIst:00 AM IST on '
      '${dayBefore.day} ${_monthsShort[dayBefore.month - 1]} ${dayBefore.year}';
}

/// Whether [eventInstant] is still in the future relative to [now], compared on
/// the IST calendar day rather than the exact instant — an event earlier today
/// still belongs on today's calendar (functional-spec.md Screen 12 filters to
/// "upcoming" events).
bool isUpcomingIst(DateTime eventInstant, {required DateTime now}) =>
    !istDay(eventInstant).isBefore(istDay(now));
