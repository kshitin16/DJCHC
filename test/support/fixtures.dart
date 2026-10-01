/// Test data builders (unit-test-instructions.md "Test data management").
///
/// Every builder returns a fully-populated valid value with named overrides for
/// the one or two fields a test actually cares about. There are two flavours:
///
/// - `aPost()` / `aSuggestion()` / ... return model instances, for widget tests
///   and state tests that work with already-parsed data.
/// - `aPostJson()` / `aSuggestionJson()` / ... return the wire-shaped
///   `Map<String, dynamic>` an AppSync response carries, for service tests that
///   script a `FakeApiGateway`.
///
/// No fixture directory, no golden files, no snapshots.
library;

import 'package:sarovar_jinalaya/models/document.dart';
import 'package:sarovar_jinalaya/models/donation.dart';
import 'package:sarovar_jinalaya/models/post.dart';
import 'package:sarovar_jinalaya/models/reminder.dart';
import 'package:sarovar_jinalaya/models/suggestion.dart';
import 'package:sarovar_jinalaya/services/gateways.dart';

/// A fixed "now" every time-sensitive test anchors on: 2026-03-01 09:00 IST.
final DateTime fixedNowUtc = DateTime.utc(2026, 3, 1, 3, 30);

// ---------------------------------------------------------------------------
// Post (Contract 3)
// ---------------------------------------------------------------------------

Map<String, dynamic> aPostJson({
  String id = 'post-1',
  String type = 'EVENT',
  String title = 'Mahavir Jayanti Puja',
  String description = 'Morning puja followed by prasad.',
  DateTime? dateTime,
  String createdByGoogleId = 'admin-sub-1',
  DateTime? createdAt,
  DateTime? updatedAt,
}) => {
  'id': id,
  'type': type,
  'title': title,
  'description': description,
  'dateTime': (dateTime ?? fixedNowUtc.add(const Duration(days: 7)))
      .toUtc()
      .toIso8601String(),
  'createdByGoogleId': createdByGoogleId,
  'createdAt': (createdAt ?? fixedNowUtc).toUtc().toIso8601String(),
  'updatedAt': (updatedAt ?? fixedNowUtc).toUtc().toIso8601String(),
};

Post aPost({
  String id = 'post-1',
  PostType type = PostType.event,
  String title = 'Mahavir Jayanti Puja',
  String description = 'Morning puja followed by prasad.',
  DateTime? dateTime,
}) => Post.fromJson(
  aPostJson(
    id: id,
    type: type.graphQlValue,
    title: title,
    description: description,
    dateTime: dateTime,
  ),
);

// ---------------------------------------------------------------------------
// Suggestion (Contract 4)
// ---------------------------------------------------------------------------

Map<String, dynamic> aSuggestionJson({
  String id = 'sug-1',
  String submittedByGoogleId = 'user-sub-1',
  String text = 'Please add an evening aarti slot.',
  DateTime? submittedAt,
}) => {
  'id': id,
  'submittedByGoogleId': submittedByGoogleId,
  'text': text,
  'submittedAt': (submittedAt ?? fixedNowUtc).toUtc().toIso8601String(),
};

Suggestion aSuggestion({
  String id = 'sug-1',
  String submittedByGoogleId = 'user-sub-1',
  String text = 'Please add an evening aarti slot.',
  DateTime? submittedAt,
}) => Suggestion.fromJson(
  aSuggestionJson(
    id: id,
    submittedByGoogleId: submittedByGoogleId,
    text: text,
    submittedAt: submittedAt,
  ),
);

// ---------------------------------------------------------------------------
// Donation (Contract 5)
// ---------------------------------------------------------------------------

Map<String, dynamic> aDonationJson({
  String id = 'don-1',
  String donorGoogleId = 'user-sub-1',
  double amount = 501,
  String donationType = 'ONE_TIME',
  String? frequency,
  String status = 'SUCCEEDED',
  String? aggregatorTransactionId = 'agg-txn-1',
  DateTime? createdAt,
  DateTime? cancelledAt,
}) => {
  'id': id,
  'donorGoogleId': donorGoogleId,
  'amount': amount,
  'donationType': donationType,
  'frequency': frequency,
  'status': status,
  'aggregatorTransactionId': aggregatorTransactionId,
  'createdAt': (createdAt ?? fixedNowUtc).toUtc().toIso8601String(),
  'cancelledAt': cancelledAt?.toUtc().toIso8601String(),
};

Donation aDonation({
  String id = 'don-1',
  double amount = 501,
  DonationType donationType = DonationType.oneTime,
  DonationFrequency? frequency,
  DonationStatus status = DonationStatus.succeeded,
}) => Donation.fromJson(
  aDonationJson(
    id: id,
    amount: amount,
    donationType: donationType.graphQlValue,
    frequency: frequency?.graphQlValue,
    status: status.graphQlValue,
  ),
);

Map<String, dynamic> aDonationInitiationJson({
  String donationId = 'don-1',
  String checkoutUrl = 'https://pay.example.test/checkout/abc123',
  String checkoutReference = 'ref-abc123',
}) => {
  'donationId': donationId,
  'checkoutUrl': checkoutUrl,
  'checkoutReference': checkoutReference,
};

// ---------------------------------------------------------------------------
// Document (Contract 6)
// ---------------------------------------------------------------------------

Map<String, dynamic> aDocumentJson({
  String id = 'doc-1',
  String title = 'Daily Poojan Vidhi',
  String category = 'DAILY_POOJAN',
  String s3Key = 'documents/doc-1.pdf',
  String uploadedByGoogleId = 'admin-sub-1',
  DateTime? uploadedAt,
}) => {
  'id': id,
  'title': title,
  'category': category,
  's3Key': s3Key,
  'uploadedByGoogleId': uploadedByGoogleId,
  'uploadedAt': (uploadedAt ?? fixedNowUtc).toUtc().toIso8601String(),
};

Document aDocument({
  String id = 'doc-1',
  String title = 'Daily Poojan Vidhi',
  DocumentCategory category = DocumentCategory.dailyPoojan,
}) => Document.fromJson(
  aDocumentJson(id: id, title: title, category: category.graphQlValue),
);

Map<String, dynamic> aDocumentUploadTargetJson({
  String uploadUrl = 'https://s3.example.test/upload?sig=abc',
  String s3Key = 'documents/doc-1.pdf',
}) => {'uploadUrl': uploadUrl, 's3Key': s3Key};

// ---------------------------------------------------------------------------
// Reminder / DeviceToken (Contract 9)
// ---------------------------------------------------------------------------

Map<String, dynamic> aReminderJson({
  String id = 'rem-1',
  String postId = 'post-1',
  String ownerIdentityId = 'ap-south-1:guest-identity-1',
  String status = 'SCHEDULED',
  DateTime? initialFireAt,
  DateTime? snoozeFireAt,
  DateTime? createdAt,
}) => {
  'id': id,
  'postId': postId,
  'ownerIdentityId': ownerIdentityId,
  'status': status,
  'initialFireAt': (initialFireAt ?? fixedNowUtc.add(const Duration(days: 6)))
      .toUtc()
      .toIso8601String(),
  'snoozeFireAt': snoozeFireAt?.toUtc().toIso8601String(),
  'createdAt': (createdAt ?? fixedNowUtc).toUtc().toIso8601String(),
};

Reminder aReminder({
  String id = 'rem-1',
  String postId = 'post-1',
  ReminderStatus status = ReminderStatus.scheduled,
  DateTime? initialFireAt,
  DateTime? snoozeFireAt,
}) => Reminder.fromJson(
  aReminderJson(
    id: id,
    postId: postId,
    status: status.graphQlValue,
    initialFireAt: initialFireAt,
    snoozeFireAt: snoozeFireAt,
  ),
);

Map<String, dynamic> aDeviceTokenJson({
  String id = 'tok-1',
  String ownerIdentityId = 'ap-south-1:guest-identity-1',
  String pushToken = 'fcm-token-abc',
  String platform = 'ANDROID',
  bool remindersEnabled = true,
  DateTime? registeredAt,
}) => {
  'id': id,
  'ownerIdentityId': ownerIdentityId,
  'pushToken': pushToken,
  'platform': platform,
  'remindersEnabled': remindersEnabled,
  'registeredAt': (registeredAt ?? fixedNowUtc).toUtc().toIso8601String(),
};

// ---------------------------------------------------------------------------
// Session (Contract 1 / Contract 2)
// ---------------------------------------------------------------------------

SessionInfo aSession({
  bool signedIn = true,
  bool admin = false,
  String? sub = 'user-sub-1',
  String? email = 'devotee@example.test',
  String? givenName,
  String? familyName,
  String? identityId = 'ap-south-1:guest-identity-1',
}) => SessionInfo(
  isSignedIn: signedIn,
  sub: signedIn ? sub : null,
  email: signedIn ? email : null,
  // Default to absent, not to a name: Google does not guarantee either claim,
  // so the nameless case is the one every caller gets unless it asks otherwise.
  givenName: signedIn ? givenName : null,
  familyName: signedIn ? familyName : null,
  groups: admin ? const ['Admin'] : const [],
  identityId: identityId,
);
