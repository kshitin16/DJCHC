/// Contract 4 (`Suggestion`) — a signed-in user's free-text suggestion (FR3.x).
library;

import 'package:flutter/foundation.dart';

import 'aws_date_time.dart';

@immutable
class Suggestion {
  const Suggestion({
    required this.id,
    required this.submittedByGoogleId,
    required this.text,
    required this.submittedAt,
  });

  factory Suggestion.fromJson(Map<String, dynamic> json) => Suggestion(
    id: requireString(json, 'id'),
    submittedByGoogleId: requireString(json, 'submittedByGoogleId'),
    text: requireString(json, 'text'),
    submittedAt: parseAwsDateTime(json['submittedAt'], field: 'submittedAt'),
  );

  final String id;
  final String submittedByGoogleId;
  final String text;
  final DateTime submittedAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'submittedByGoogleId': submittedByGoogleId,
    'text': text,
    'submittedAt': formatAwsDateTime(submittedAt),
  };

  @override
  bool operator ==(Object other) =>
      other is Suggestion &&
      other.id == id &&
      other.submittedByGoogleId == submittedByGoogleId &&
      other.text == text &&
      other.submittedAt == submittedAt;

  @override
  int get hashCode => Object.hash(id, submittedByGoogleId, text, submittedAt);
}
