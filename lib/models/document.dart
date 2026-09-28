/// Contract 6 (`Document`, `DocumentUploadTarget`) — the PDF library (FR6.x,
/// later release).
library;

import 'package:flutter/foundation.dart';

import 'aws_date_time.dart';

enum DocumentCategory {
  dailyPoojan('DAILY_POOJAN'),
  variousVidhaans('VARIOUS_VIDHAANS'),
  bhaktamar('BHAKTAMAR'),
  unknown('UNKNOWN');

  const DocumentCategory(this.graphQlValue);
  final String graphQlValue;

  /// The three real categories, in display order (never [unknown]).
  static const List<DocumentCategory> known = [
    dailyPoojan,
    variousVidhaans,
    bhaktamar,
  ];

  static DocumentCategory fromGraphQl(Object? value) {
    for (final c in known) {
      if (c.graphQlValue == value) return c;
    }
    return unknown;
  }
}

@immutable
class Document {
  const Document({
    required this.id,
    required this.title,
    required this.category,
    required this.s3Key,
    required this.uploadedByGoogleId,
    required this.uploadedAt,
  });

  factory Document.fromJson(Map<String, dynamic> json) => Document(
    id: requireString(json, 'id'),
    title: requireString(json, 'title'),
    category: DocumentCategory.fromGraphQl(json['category']),
    s3Key: requireString(json, 's3Key'),
    uploadedByGoogleId: requireString(json, 'uploadedByGoogleId'),
    uploadedAt: parseAwsDateTime(json['uploadedAt'], field: 'uploadedAt'),
  );

  final String id;
  final String title;
  final DocumentCategory category;
  final String s3Key;
  final String uploadedByGoogleId;
  final DateTime uploadedAt;

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'category': category.graphQlValue,
    's3Key': s3Key,
    'uploadedByGoogleId': uploadedByGoogleId,
    'uploadedAt': formatAwsDateTime(uploadedAt),
  };

  @override
  bool operator ==(Object other) =>
      other is Document &&
      other.id == id &&
      other.title == title &&
      other.category == category &&
      other.s3Key == s3Key &&
      other.uploadedByGoogleId == uploadedByGoogleId &&
      other.uploadedAt == uploadedAt;

  @override
  int get hashCode =>
      Object.hash(id, title, category, s3Key, uploadedByGoogleId, uploadedAt);
}

/// The pre-signed S3 PUT target `createDocumentUploadUrl` returns.
@immutable
class DocumentUploadTarget {
  const DocumentUploadTarget({required this.uploadUrl, required this.s3Key});

  factory DocumentUploadTarget.fromJson(Map<String, dynamic> json) =>
      DocumentUploadTarget(
        uploadUrl: requireString(json, 'uploadUrl'),
        s3Key: requireString(json, 's3Key'),
      );

  final String uploadUrl;
  final String s3Key;

  Map<String, dynamic> toJson() => {'uploadUrl': uploadUrl, 's3Key': s3Key};

  @override
  bool operator ==(Object other) =>
      other is DocumentUploadTarget &&
      other.uploadUrl == uploadUrl &&
      other.s3Key == s3Key;

  @override
  int get hashCode => Object.hash(uploadUrl, s3Key);
}
