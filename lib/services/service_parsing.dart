/// Shared response-shape helpers for the `services/` layer.
///
/// Every contract call goes through one of these so that a response whose shape
/// does not match the document becomes a typed [ApiException] with copy a
/// screen can render, never a raw `TypeError` or a silent `null`
/// (construction.md: no silent failures at an integration boundary).
library;

import 'gateways.dart';

/// Copy for a response this build cannot read. Deliberately generic: a parse
/// failure is a contract mismatch, not something the user can act on beyond
/// retrying.
const String malformedResponseMessage =
    'The server sent a response this version of the app could not read. '
    'Please try again, or update the app if this keeps happening.';

/// The auth mode for Contract 3's `listPosts` and Contract 6's two public
/// reads: the Identity Pool guest role when signed out, the User Pool JWT when
/// signed in (code-generation-plan.md rule 3).
AuthMode publicReadAuthMode({required bool signedIn}) =>
    signedIn ? AuthMode.userPool : AuthMode.identityPool;

/// Parses a GraphQL list field into models.
List<T> parseList<T>(
  Object? data,
  T Function(Map<String, dynamic>) fromJson, {
  required String field,
}) {
  if (data is! List) {
    throw const ApiException.transport(malformedResponseMessage);
  }
  try {
    return data.map((e) => fromJson(_asMap(e))).toList(growable: false);
  } on FormatException {
    throw const ApiException.transport(malformedResponseMessage);
  } on TypeError {
    throw const ApiException.transport(malformedResponseMessage);
  }
}

/// Parses a GraphQL object field into a model.
T parseObject<T>(
  Object? data,
  T Function(Map<String, dynamic>) fromJson, {
  required String field,
}) {
  try {
    return fromJson(_asMap(data));
  } on FormatException {
    throw const ApiException.transport(malformedResponseMessage);
  } on TypeError {
    throw const ApiException.transport(malformedResponseMessage);
  }
}

/// Parses a GraphQL scalar `String`/`AWSURL` field.
String parseString(Object? data, {required String field}) {
  if (data is! String || data.isEmpty) {
    throw const ApiException.transport(malformedResponseMessage);
  }
  return data;
}

Map<String, dynamic> _asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  throw const ApiException.transport(malformedResponseMessage);
}
