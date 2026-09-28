/// Data-model tests (plan Step 4.1) — Contracts 3, 4, 5, 6, 9.
///
/// The load-bearing behaviours here are the `fromJson` round-trips against the
/// exact wire shapes `amplify/data/resource.ts` declares, and the additive rule
/// from `contract-summary.md`: an enum value this build does not know must fall
/// back tolerantly, never throw.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/aws_date_time.dart';
import 'package:sarovar_jinalaya/models/document.dart';
import 'package:sarovar_jinalaya/models/donation.dart';
import 'package:sarovar_jinalaya/models/post.dart';
import 'package:sarovar_jinalaya/models/reminder.dart';
import 'package:sarovar_jinalaya/models/suggestion.dart';

import '../support/fixtures.dart';

void main() {
  group('fromJson / toJson round-trips', () {
    test('Post parses every Contract 3 field and round-trips', () {
      final json = aPostJson(
        id: 'p-9',
        title: 'Paryushan begins',
        description: 'Eight days of observance.',
        dateTime: DateTime.utc(2026, 9, 10, 3, 30),
      );

      final post = Post.fromJson(json);

      expect(post.id, 'p-9');
      expect(post.type, PostType.event);
      expect(post.title, 'Paryushan begins');
      expect(post.description, 'Eight days of observance.');
      expect(post.dateTime, DateTime.utc(2026, 9, 10, 3, 30));
      expect(post.dateTime.isUtc, isTrue);
      expect(post.createdByGoogleId, 'admin-sub-1');
      // Round-trip: re-parsing our own serialization yields an equal value.
      expect(Post.fromJson(post.toJson()), post);
    });

    test('Suggestion and Document parse and round-trip', () {
      final suggestion = Suggestion.fromJson(
        aSuggestionJson(text: 'More parking on festival days.'),
      );
      expect(suggestion.text, 'More parking on festival days.');
      expect(suggestion.submittedByGoogleId, 'user-sub-1');
      expect(Suggestion.fromJson(suggestion.toJson()), suggestion);

      final document = Document.fromJson(
        aDocumentJson(category: 'BHAKTAMAR', s3Key: 'documents/bh.pdf'),
      );
      expect(document.category, DocumentCategory.bhaktamar);
      expect(document.s3Key, 'documents/bh.pdf');
      expect(Document.fromJson(document.toJson()), document);
    });

    test('Donation parses a recurring row and round-trips', () {
      final donation = Donation.fromJson(
        aDonationJson(
          amount: 1100.5,
          donationType: 'RECURRING',
          frequency: 'QUARTERLY',
          status: 'SUCCEEDED',
          cancelledAt: DateTime.utc(2026, 4, 1),
        ),
      );

      expect(donation.amount, 1100.5);
      expect(donation.donationType, DonationType.recurring);
      expect(donation.frequency, DonationFrequency.quarterly);
      expect(donation.status, DonationStatus.succeeded);
      expect(donation.cancelledAt, DateTime.utc(2026, 4, 1));
      expect(Donation.fromJson(donation.toJson()), donation);
    });

    test('Reminder and DeviceToken parse Contract 9 shapes', () {
      final reminder = Reminder.fromJson(
        aReminderJson(
          status: 'SNOOZED',
          initialFireAt: DateTime.utc(2026, 3, 9, 3, 30),
          snoozeFireAt: DateTime.utc(2026, 3, 9, 15, 30),
        ),
      );
      expect(reminder.status, ReminderStatus.snoozed);
      expect(reminder.snoozeFireAt, DateTime.utc(2026, 3, 9, 15, 30));
      expect(Reminder.fromJson(reminder.toJson()), reminder);

      final token = DeviceToken.fromJson(
        aDeviceTokenJson(platform: 'IOS', remindersEnabled: false),
      );
      expect(token.platform, DevicePlatform.ios);
      expect(token.remindersEnabled, isFalse);
      expect(DeviceToken.fromJson(token.toJson()), token);

      // A reminder that has never been snoozed keeps `snoozeFireAt` null.
      expect(Reminder.fromJson(aReminderJson()).snoozeFireAt, isNull);
    });

    test(
      'DonationInitiation and DocumentUploadTarget parse hand-off shapes',
      () {
        final initiation = DonationInitiation.fromJson(
          aDonationInitiationJson(checkoutUrl: 'https://pay.test/c/1'),
        );
        expect(initiation.checkoutUrl, 'https://pay.test/c/1');
        expect(initiation.donationId, 'don-1');

        final target = DocumentUploadTarget.fromJson(
          aDocumentUploadTargetJson(s3Key: 'documents/new.pdf'),
        );
        expect(target.s3Key, 'documents/new.pdf');
        expect(DocumentUploadTarget.fromJson(target.toJson()), target);
      },
    );

    test('a required field that is absent or the wrong type fails loudly', () {
      // construction.md: no silent failures. A contract violation is a
      // FormatException the service layer maps to a typed failure.
      final missingId = aPostJson()..remove('id');
      expect(() => Post.fromJson(missingId), throwsFormatException);

      final nullDateTime = aPostJson()..['dateTime'] = null;
      expect(() => Post.fromJson(nullDateTime), throwsFormatException);

      expect(
        () => parseAwsDateTime('not-a-date', field: 'dateTime'),
        throwsFormatException,
      );
    });
  });

  group('enum parsing (contract-summary.md additive rule)', () {
    test('every declared enum literal parses, including DONATION_CALL_OUT', () {
      // These literals are the ones `amplify/data/resource.ts` declares via
      // POST_TYPES / DONATION_* / DOCUMENT_CATEGORIES / REMINDER_STATUSES.
      expect(PostType.fromGraphQl('EVENT'), PostType.event);
      expect(
        PostType.fromGraphQl('VISITING_DIGNITARY'),
        PostType.visitingDignitary,
      );
      expect(
        PostType.fromGraphQl('DONATION_CALL_OUT'),
        PostType.donationCallOut,
      );

      expect(DonationType.fromGraphQl('ONE_TIME'), DonationType.oneTime);
      expect(DonationType.fromGraphQl('RECURRING'), DonationType.recurring);
      for (final entry in {
        'MONTHLY': DonationFrequency.monthly,
        'QUARTERLY': DonationFrequency.quarterly,
        'YEARLY': DonationFrequency.yearly,
      }.entries) {
        expect(DonationFrequency.fromGraphQl(entry.key), entry.value);
      }
      for (final entry in {
        'INITIATED': DonationStatus.initiated,
        'PENDING': DonationStatus.pending,
        'SUCCEEDED': DonationStatus.succeeded,
        'FAILED': DonationStatus.failed,
        'CANCELLED': DonationStatus.cancelled,
      }.entries) {
        expect(DonationStatus.fromGraphQl(entry.key), entry.value);
      }

      expect(
        DocumentCategory.fromGraphQl('DAILY_POOJAN'),
        DocumentCategory.dailyPoojan,
      );
      expect(
        DocumentCategory.fromGraphQl('VARIOUS_VIDHAANS'),
        DocumentCategory.variousVidhaans,
      );
      expect(
        DocumentCategory.fromGraphQl('BHAKTAMAR'),
        DocumentCategory.bhaktamar,
      );
      expect(DocumentCategory.known, hasLength(3));

      for (final entry in {
        'SCHEDULED': ReminderStatus.scheduled,
        'SNOOZED': ReminderStatus.snoozed,
        'FIRED': ReminderStatus.fired,
        'CLEARED': ReminderStatus.cleared,
        'CANCELLED': ReminderStatus.cancelled,
      }.entries) {
        expect(ReminderStatus.fromGraphQl(entry.key), entry.value);
      }
      expect(DevicePlatform.fromGraphQl('IOS'), DevicePlatform.ios);
      expect(DevicePlatform.fromGraphQl('ANDROID'), DevicePlatform.android);
    });

    test('an unknown enum value falls back tolerantly and never throws', () {
      // A newer backend adding a value must not break an older build.
      expect(PostType.fromGraphQl('SATSANG'), PostType.unknown);
      expect(DonationType.fromGraphQl('ANNUAL_PLEDGE'), DonationType.unknown);
      expect(
        DonationFrequency.fromGraphQl('WEEKLY'),
        DonationFrequency.unknown,
      );
      expect(DonationStatus.fromGraphQl('REFUNDED'), DonationStatus.unknown);
      expect(DocumentCategory.fromGraphQl('AARTI'), DocumentCategory.unknown);
      expect(ReminderStatus.fromGraphQl('DEFERRED'), ReminderStatus.unknown);
      // DevicePlatform is app-supplied on the way out, so an unrecognised value
      // coming back is null rather than a synthetic member.
      expect(DevicePlatform.fromGraphQl('WEB'), isNull);

      // Nulls and non-strings are tolerated on the same path.
      expect(PostType.fromGraphQl(null), PostType.unknown);
      expect(PostType.fromGraphQl(42), PostType.unknown);
      expect(DonationFrequency.fromGraphQl(null), isNull);

      // A whole row carrying an unknown type still parses.
      final post = Post.fromJson(aPostJson(type: 'SATSANG'));
      expect(post.type, PostType.unknown);
      expect(post.isEvent, isFalse);
    });
  });

  group('derived predicates', () {
    test('Donation.canCancel is SUCCEEDED and RECURRING only', () {
      expect(
        aDonation(
          status: DonationStatus.succeeded,
          donationType: DonationType.recurring,
        ).canCancel,
        isTrue,
      );
      // Wrong on exactly one axis each time.
      expect(
        aDonation(
          status: DonationStatus.succeeded,
          donationType: DonationType.oneTime,
        ).canCancel,
        isFalse,
      );
      expect(
        aDonation(
          status: DonationStatus.pending,
          donationType: DonationType.recurring,
        ).canCancel,
        isFalse,
      );
      expect(
        aDonation(
          status: DonationStatus.cancelled,
          donationType: DonationType.recurring,
        ).canCancel,
        isFalse,
      );
    });

    test('Reminder.isActive / canSnooze / canCancel per status', () {
      const active = {ReminderStatus.scheduled, ReminderStatus.snoozed};
      const snoozable = {ReminderStatus.scheduled, ReminderStatus.fired};
      const cancellable = {
        ReminderStatus.scheduled,
        ReminderStatus.snoozed,
        ReminderStatus.fired,
      };

      for (final status in ReminderStatus.values) {
        final reminder = aReminder(status: status);
        expect(
          reminder.isActive,
          active.contains(status),
          reason: 'isActive for ${status.graphQlValue}',
        );
        expect(
          reminder.canSnooze,
          snoozable.contains(status),
          reason: 'canSnooze for ${status.graphQlValue}',
        );
        expect(
          reminder.canCancel,
          cancellable.contains(status),
          reason: 'canCancel for ${status.graphQlValue}',
        );
      }
    });

    test('Post.isEvent is true only for EVENT (FR7.1 calendar filter)', () {
      expect(aPost(type: PostType.event).isEvent, isTrue);
      expect(aPost(type: PostType.visitingDignitary).isEvent, isFalse);
      expect(aPost(type: PostType.donationCallOut).isEvent, isFalse);
      expect(aPost(type: PostType.unknown).isEvent, isFalse);
    });

    test('value equality distinguishes rows that differ in one field', () {
      expect(aPost(id: 'a'), aPost(id: 'a'));
      expect(aPost(id: 'a').hashCode, aPost(id: 'a').hashCode);
      expect(aPost(id: 'a'), isNot(aPost(id: 'b')));
      expect(aPost(title: 'x'), isNot(aPost(title: 'y')));
      expect(aSuggestion(text: 'x'), isNot(aSuggestion(text: 'y')));
      expect(aReminder(status: ReminderStatus.fired), isNot(aReminder()));
    });
  });
}
