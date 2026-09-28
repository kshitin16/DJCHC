/// Contract 9 (`Reminder`, `DeviceToken`) — device-scoped, guest-identity
/// reminders for EVENT posts (FR7.x).
library;

import 'package:flutter/foundation.dart';

import 'aws_date_time.dart';

enum ReminderStatus {
  scheduled('SCHEDULED'),
  snoozed('SNOOZED'),
  fired('FIRED'),
  cleared('CLEARED'),
  cancelled('CANCELLED'),
  unknown('UNKNOWN');

  const ReminderStatus(this.graphQlValue);
  final String graphQlValue;

  static ReminderStatus fromGraphQl(Object? value) {
    for (final s in values) {
      if (s != unknown && s.graphQlValue == value) return s;
    }
    return unknown;
  }
}

enum DevicePlatform {
  ios('IOS'),
  android('ANDROID');

  const DevicePlatform(this.graphQlValue);
  final String graphQlValue;

  static DevicePlatform? fromGraphQl(Object? value) {
    for (final p in values) {
      if (p.graphQlValue == value) return p;
    }
    return null;
  }
}

@immutable
class Reminder {
  const Reminder({
    required this.id,
    required this.postId,
    required this.ownerIdentityId,
    required this.status,
    required this.initialFireAt,
    required this.createdAt,
    this.snoozeFireAt,
  });

  factory Reminder.fromJson(Map<String, dynamic> json) => Reminder(
    id: requireString(json, 'id'),
    postId: requireString(json, 'postId'),
    ownerIdentityId: requireString(json, 'ownerIdentityId'),
    status: ReminderStatus.fromGraphQl(json['status']),
    initialFireAt: parseAwsDateTime(
      json['initialFireAt'],
      field: 'initialFireAt',
    ),
    snoozeFireAt: parseOptionalAwsDateTime(
      json['snoozeFireAt'],
      field: 'snoozeFireAt',
    ),
    createdAt: parseAwsDateTime(json['createdAt'], field: 'createdAt'),
  );

  final String id;
  final String postId;
  final String ownerIdentityId;
  final ReminderStatus status;
  final DateTime initialFireAt;
  final DateTime? snoozeFireAt;
  final DateTime createdAt;

  /// A reminder that will still fire (SCHEDULED or SNOOZED).
  bool get isActive =>
      status == ReminderStatus.scheduled || status == ReminderStatus.snoozed;

  /// Snooze is offered while a notification can still be acted on: SCHEDULED
  /// (not yet fired) or FIRED (the 9:00 AM push went out and 9:00 PM IST
  /// has not passed — the server enforces the cutoff, BR7.3).
  bool get canSnooze =>
      status == ReminderStatus.scheduled || status == ReminderStatus.fired;

  /// Cancel is offered for anything not already terminal.
  bool get canCancel =>
      status == ReminderStatus.scheduled ||
      status == ReminderStatus.snoozed ||
      status == ReminderStatus.fired;

  Map<String, dynamic> toJson() => {
    'id': id,
    'postId': postId,
    'ownerIdentityId': ownerIdentityId,
    'status': status.graphQlValue,
    'initialFireAt': formatAwsDateTime(initialFireAt),
    'snoozeFireAt': snoozeFireAt == null
        ? null
        : formatAwsDateTime(snoozeFireAt!),
    'createdAt': formatAwsDateTime(createdAt),
  };

  @override
  bool operator ==(Object other) =>
      other is Reminder &&
      other.id == id &&
      other.postId == postId &&
      other.ownerIdentityId == ownerIdentityId &&
      other.status == status &&
      other.initialFireAt == initialFireAt &&
      other.snoozeFireAt == snoozeFireAt &&
      other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(
    id,
    postId,
    ownerIdentityId,
    status,
    initialFireAt,
    snoozeFireAt,
    createdAt,
  );
}

@immutable
class DeviceToken {
  const DeviceToken({
    required this.id,
    required this.ownerIdentityId,
    required this.pushToken,
    required this.platform,
    required this.remindersEnabled,
    required this.registeredAt,
  });

  factory DeviceToken.fromJson(Map<String, dynamic> json) => DeviceToken(
    id: requireString(json, 'id'),
    ownerIdentityId: requireString(json, 'ownerIdentityId'),
    pushToken: requireString(json, 'pushToken'),
    platform: DevicePlatform.fromGraphQl(json['platform']),
    remindersEnabled: json['remindersEnabled'] == true,
    registeredAt: parseAwsDateTime(json['registeredAt'], field: 'registeredAt'),
  );

  final String id;
  final String ownerIdentityId;
  final String pushToken;

  /// `null` when the server returns a platform this build does not know.
  final DevicePlatform? platform;
  final bool remindersEnabled;
  final DateTime registeredAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'ownerIdentityId': ownerIdentityId,
    'pushToken': pushToken,
    'platform': platform?.graphQlValue,
    'remindersEnabled': remindersEnabled,
    'registeredAt': formatAwsDateTime(registeredAt),
  };

  @override
  bool operator ==(Object other) =>
      other is DeviceToken &&
      other.id == id &&
      other.ownerIdentityId == ownerIdentityId &&
      other.pushToken == pushToken &&
      other.platform == platform &&
      other.remindersEnabled == remindersEnabled &&
      other.registeredAt == registeredAt;

  @override
  int get hashCode => Object.hash(
    id,
    ownerIdentityId,
    pushToken,
    platform,
    remindersEnabled,
    registeredAt,
  );
}
