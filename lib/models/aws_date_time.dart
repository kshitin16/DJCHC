/// Helpers for the `AWSDateTime` scalar every contract uses.
///
/// AppSync serialises `AWSDateTime` as an ISO-8601 string with an offset
/// (`2026-01-01T12:00:00.000Z`). Every model parses it as UTC so that the
/// IST rendering in `utils/ist_time.dart` starts from a known instant.
library;

/// Parses an `AWSDateTime` string as a UTC [DateTime].
///
/// Throws [FormatException] when the value is missing or not ISO-8601 — a
/// contract violation the caller surfaces as a typed failure, never silently.
DateTime parseAwsDateTime(Object? value, {required String field}) {
  if (value is! String || value.isEmpty) {
    throw FormatException('$field: expected an AWSDateTime string, got $value');
  }
  return DateTime.parse(value).toUtc();
}

/// Parses an optional `AWSDateTime`; `null` stays `null`.
DateTime? parseOptionalAwsDateTime(Object? value, {required String field}) {
  if (value == null) return null;
  return parseAwsDateTime(value, field: field);
}

/// Serialises a [DateTime] as the `AWSDateTime` string AppSync expects.
String formatAwsDateTime(DateTime value) => value.toUtc().toIso8601String();

/// Reads a required string field, failing loudly on absence.
String requireString(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value is! String) {
    throw FormatException('$field: expected a string, got $value');
  }
  return value;
}
