/// Contract 3 (`Post`) — the feed/calendar entity the app reads and admins
/// manage (FR2.x, FR7.1).
library;

import 'package:flutter/foundation.dart';

import 'aws_date_time.dart';

/// `PostType` from Contract 3. [unknown] absorbs any value a newer backend
/// adds (contract-summary.md: consumers must not fail on an unrecognised
/// enum value).
enum PostType {
  event('EVENT'),
  visitingDignitary('VISITING_DIGNITARY'),
  donationCallOut('DONATION_CALL_OUT'),
  unknown('UNKNOWN');

  const PostType(this.graphQlValue);

  /// The exact enum literal the GraphQL schema uses.
  final String graphQlValue;

  /// Tolerant parse: an unrecognised or missing value becomes [unknown]
  /// rather than throwing.
  static PostType fromGraphQl(Object? value) {
    for (final type in values) {
      if (type != unknown && type.graphQlValue == value) return type;
    }
    return unknown;
  }
}

@immutable
class Post {
  const Post({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.dateTime,
    required this.createdByGoogleId,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Post.fromJson(Map<String, dynamic> json) => Post(
    id: requireString(json, 'id'),
    type: PostType.fromGraphQl(json['type']),
    title: requireString(json, 'title'),
    description: requireString(json, 'description'),
    dateTime: parseAwsDateTime(json['dateTime'], field: 'dateTime'),
    createdByGoogleId: requireString(json, 'createdByGoogleId'),
    createdAt: parseAwsDateTime(json['createdAt'], field: 'createdAt'),
    updatedAt: parseAwsDateTime(json['updatedAt'], field: 'updatedAt'),
  );

  final String id;
  final PostType type;
  final String title;
  final String description;

  /// The event/visit instant (UTC). Rendered in IST by the screens.
  final DateTime dateTime;
  final String createdByGoogleId;
  final DateTime createdAt;
  final DateTime updatedAt;

  /// Only EVENT posts appear on the Calendar and get reminders (FR7.1).
  bool get isEvent => type == PostType.event;

  Map<String, dynamic> toJson() => {
    'id': id,
    'type': type.graphQlValue,
    'title': title,
    'description': description,
    'dateTime': formatAwsDateTime(dateTime),
    'createdByGoogleId': createdByGoogleId,
    'createdAt': formatAwsDateTime(createdAt),
    'updatedAt': formatAwsDateTime(updatedAt),
  };

  @override
  bool operator ==(Object other) =>
      other is Post &&
      other.id == id &&
      other.type == type &&
      other.title == title &&
      other.description == description &&
      other.dateTime == dateTime &&
      other.createdByGoogleId == createdByGoogleId &&
      other.createdAt == createdAt &&
      other.updatedAt == updatedAt;

  @override
  int get hashCode => Object.hash(
    id,
    type,
    title,
    description,
    dateTime,
    createdByGoogleId,
    createdAt,
    updatedAt,
  );

  @override
  String toString() => 'Post($id, ${type.graphQlValue}, $title)';
}

/// The `CreatePostInput` shape (Contract 3, `createPost`).
@immutable
class CreatePostInput {
  const CreatePostInput({
    required this.type,
    required this.title,
    required this.description,
    required this.dateTime,
  });

  final PostType type;
  final String title;
  final String description;
  final DateTime dateTime;

  Map<String, dynamic> toJson() => {
    'type': type.graphQlValue,
    'title': title,
    'description': description,
    'dateTime': formatAwsDateTime(dateTime),
  };
}

/// The `UpdatePostInput` shape (Contract 3, `updatePost`): every field is
/// optional and only the provided ones are sent.
@immutable
class UpdatePostInput {
  const UpdatePostInput({
    this.type,
    this.title,
    this.description,
    this.dateTime,
  });

  final PostType? type;
  final String? title;
  final String? description;
  final DateTime? dateTime;

  Map<String, dynamic> toJson() => {
    if (type != null) 'type': type!.graphQlValue,
    if (title != null) 'title': title,
    if (description != null) 'description': description,
    if (dateTime != null) 'dateTime': formatAwsDateTime(dateTime!),
  };
}
