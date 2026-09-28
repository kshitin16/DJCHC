/// Contract 5 (`Donation`, `DonationInitiation`) — display-only on this side;
/// the state machine belongs to donation-unit (FR5.x, later release).
library;

import 'package:flutter/foundation.dart';

import 'aws_date_time.dart';

enum DonationType {
  oneTime('ONE_TIME'),
  recurring('RECURRING'),
  unknown('UNKNOWN');

  const DonationType(this.graphQlValue);
  final String graphQlValue;

  static DonationType fromGraphQl(Object? value) {
    for (final type in values) {
      if (type != unknown && type.graphQlValue == value) return type;
    }
    return unknown;
  }
}

enum DonationFrequency {
  monthly('MONTHLY'),
  quarterly('QUARTERLY'),
  yearly('YEARLY'),
  unknown('UNKNOWN');

  const DonationFrequency(this.graphQlValue);
  final String graphQlValue;

  static DonationFrequency? fromGraphQl(Object? value) {
    if (value == null) return null;
    for (final f in values) {
      if (f != unknown && f.graphQlValue == value) return f;
    }
    return unknown;
  }
}

enum DonationStatus {
  initiated('INITIATED'),
  pending('PENDING'),
  succeeded('SUCCEEDED'),
  failed('FAILED'),
  cancelled('CANCELLED'),
  unknown('UNKNOWN');

  const DonationStatus(this.graphQlValue);
  final String graphQlValue;

  static DonationStatus fromGraphQl(Object? value) {
    for (final s in values) {
      if (s != unknown && s.graphQlValue == value) return s;
    }
    return unknown;
  }
}

@immutable
class Donation {
  const Donation({
    required this.id,
    required this.donorGoogleId,
    required this.amount,
    required this.donationType,
    required this.status,
    required this.createdAt,
    this.frequency,
    this.aggregatorTransactionId,
    this.cancelledAt,
  });

  factory Donation.fromJson(Map<String, dynamic> json) => Donation(
    id: requireString(json, 'id'),
    donorGoogleId: requireString(json, 'donorGoogleId'),
    amount: (json['amount'] as num).toDouble(),
    donationType: DonationType.fromGraphQl(json['donationType']),
    frequency: DonationFrequency.fromGraphQl(json['frequency']),
    status: DonationStatus.fromGraphQl(json['status']),
    aggregatorTransactionId: json['aggregatorTransactionId'] as String?,
    createdAt: parseAwsDateTime(json['createdAt'], field: 'createdAt'),
    cancelledAt: parseOptionalAwsDateTime(
      json['cancelledAt'],
      field: 'cancelledAt',
    ),
  );

  final String id;
  final String donorGoogleId;
  final double amount;
  final DonationType donationType;
  final DonationFrequency? frequency;
  final DonationStatus status;
  final String? aggregatorTransactionId;
  final DateTime createdAt;
  final DateTime? cancelledAt;

  /// Contract 5: `cancelDonation` is accepted only for an active recurring
  /// donation (status SUCCEEDED and type RECURRING); Screen 9 shows Cancel
  /// only then. The server re-checks regardless.
  bool get canCancel =>
      status == DonationStatus.succeeded &&
      donationType == DonationType.recurring;

  Map<String, dynamic> toJson() => {
    'id': id,
    'donorGoogleId': donorGoogleId,
    'amount': amount,
    'donationType': donationType.graphQlValue,
    'frequency': frequency?.graphQlValue,
    'status': status.graphQlValue,
    'aggregatorTransactionId': aggregatorTransactionId,
    'createdAt': formatAwsDateTime(createdAt),
    'cancelledAt': cancelledAt == null ? null : formatAwsDateTime(cancelledAt!),
  };

  @override
  bool operator ==(Object other) =>
      other is Donation &&
      other.id == id &&
      other.donorGoogleId == donorGoogleId &&
      other.amount == amount &&
      other.donationType == donationType &&
      other.frequency == frequency &&
      other.status == status &&
      other.aggregatorTransactionId == aggregatorTransactionId &&
      other.createdAt == createdAt &&
      other.cancelledAt == cancelledAt;

  @override
  int get hashCode => Object.hash(
    id,
    donorGoogleId,
    amount,
    donationType,
    frequency,
    status,
    aggregatorTransactionId,
    createdAt,
    cancelledAt,
  );
}

/// What `initiateDonation` returns: a checkout hand-off, not a completed
/// donation. The app opens [checkoutUrl] externally and never sees payment
/// details (project.md Forbidden).
@immutable
class DonationInitiation {
  const DonationInitiation({
    required this.donationId,
    required this.checkoutUrl,
    required this.checkoutReference,
  });

  factory DonationInitiation.fromJson(Map<String, dynamic> json) =>
      DonationInitiation(
        donationId: requireString(json, 'donationId'),
        checkoutUrl: requireString(json, 'checkoutUrl'),
        checkoutReference: requireString(json, 'checkoutReference'),
      );

  final String donationId;
  final String checkoutUrl;
  final String checkoutReference;

  Map<String, dynamic> toJson() => {
    'donationId': donationId,
    'checkoutUrl': checkoutUrl,
    'checkoutReference': checkoutReference,
  };

  @override
  bool operator ==(Object other) =>
      other is DonationInitiation &&
      other.donationId == donationId &&
      other.checkoutUrl == checkoutUrl &&
      other.checkoutReference == checkoutReference;

  @override
  int get hashCode => Object.hash(donationId, checkoutUrl, checkoutReference);
}
