/// `ist_time` tests (plan Step 8.4) — IST is a fixed +05:30 offset.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/utils/ist_time.dart';

void main() {
  test('toIst shifts by exactly +05:30 and formats the wall clock', () {
    // 03:30Z is 09:00 IST — the hour reminder pushes go out (BR7.2).
    expect(formatIstTime(DateTime.utc(2026, 3, 1, 3, 30)), '9:00 AM');
    // 15:30Z is 21:00 IST — the snooze cutoff (BR7.3).
    expect(formatIstTime(DateTime.utc(2026, 3, 1, 15, 30)), '9:00 PM');
    expect(istOffset, const Duration(hours: 5, minutes: 30));
    expect(reminderHourIst, 9);
    expect(snoozeCutoffHourIst, 21);
  });

  test('midnight and noon render as 12, not 0', () {
    // 18:30Z is IST midnight — the rollover case.
    expect(formatIstTime(DateTime.utc(2026, 3, 1, 18, 30)), '12:00 AM');
    // 06:30Z is IST noon.
    expect(formatIstTime(DateTime.utc(2026, 3, 1, 6, 30)), '12:00 PM');
    expect(formatIstTime(DateTime.utc(2026, 3, 1, 18, 59)), '12:29 AM');
  });

  test('the IST calendar day rolls over at 18:30Z, not at 00:00Z', () {
    // One minute before IST midnight: still 1 March IST.
    expect(formatIstDate(DateTime.utc(2026, 3, 1, 18, 29)), '1 Mar 2026');
    // At IST midnight: already 2 March IST, while UTC is still 1 March.
    expect(formatIstDate(DateTime.utc(2026, 3, 1, 18, 30)), '2 Mar 2026');
    expect(istDay(DateTime.utc(2026, 3, 1, 18, 30)), DateTime.utc(2026, 3, 2));
    expect(istDay(DateTime.utc(2026, 3, 1, 18, 29)), DateTime.utc(2026, 3, 1));

    // Two instants either side of IST midnight are NOT the same IST day, even
    // though they are the same UTC day.
    expect(
      isSameIstDay(
        DateTime.utc(2026, 3, 1, 18, 29),
        DateTime.utc(2026, 3, 1, 18, 30),
      ),
      isFalse,
    );
    // And two instants on different UTC days CAN be the same IST day.
    expect(
      isSameIstDay(
        DateTime.utc(2026, 3, 1, 20, 0),
        DateTime.utc(2026, 3, 2, 10, 0),
      ),
      isTrue,
    );

    // Month and year boundaries cross correctly.
    expect(formatIstDate(DateTime.utc(2026, 12, 31, 18, 30)), '1 Jan 2027');
    expect(formatIstDate(DateTime.utc(2026, 3, 31, 18, 30)), '1 Apr 2026');
  });

  test(
    'formatIstDateTime and formatReminderMoment read as the copy specifies',
    () {
      final event = DateTime.utc(2026, 4, 12, 3, 30); // 12 Apr 2026, 09:00 IST
      expect(formatIstDateTime(event), '12 Apr 2026, 9:00 AM IST');
      // BR7.2: the reminder is 9:00 AM IST the DAY BEFORE.
      expect(formatReminderMoment(event), '9:00 AM IST on 11 Apr 2026');

      // The day before crosses a month boundary correctly.
      expect(
        formatReminderMoment(DateTime.utc(2026, 5, 1, 3, 30)),
        '9:00 AM IST on 30 Apr 2026',
      );
      // An evening event still reminds at 9:00 AM the previous IST day.
      expect(
        formatReminderMoment(DateTime.utc(2026, 4, 12, 15, 30)),
        '9:00 AM IST on 11 Apr 2026',
      );
    },
  );

  test('isUpcomingIst keeps today and excludes yesterday, on IST days', () {
    final now = DateTime.utc(2026, 3, 1, 10, 0); // 15:30 IST, 1 March

    // Later today (IST) — upcoming.
    expect(isUpcomingIst(DateTime.utc(2026, 3, 1, 14, 0), now: now), isTrue);
    // EARLIER today (IST) — still on today's calendar, so still shown.
    expect(isUpcomingIst(DateTime.utc(2026, 3, 1, 3, 30), now: now), isTrue);
    // Tomorrow — upcoming.
    expect(isUpcomingIst(DateTime.utc(2026, 3, 2, 3, 30), now: now), isTrue);
    // Yesterday (IST) — excluded.
    expect(isUpcomingIst(DateTime.utc(2026, 2, 28, 3, 30), now: now), isFalse);
    // 17:00Z on 28 Feb is 22:30 IST on 28 Feb — the previous IST day, excluded.
    expect(isUpcomingIst(DateTime.utc(2026, 2, 28, 17, 0), now: now), isFalse);
    // 18:30Z on 28 Feb is IST midnight on 1 March — today, so included.
    expect(isUpcomingIst(DateTime.utc(2026, 2, 28, 18, 30), now: now), isTrue);
  });

  test('a local (non-UTC) instant is normalised before shifting', () {
    // Models always parse as UTC, but a DateTime.now() from a screen is local —
    // the formatting must not depend on the host machine's timezone.
    final utc = DateTime.utc(2026, 3, 1, 3, 30);
    expect(formatIstDateTime(utc.toLocal()), formatIstDateTime(utc));
    expect(istDay(utc.toLocal()), istDay(utc));
  });
}
