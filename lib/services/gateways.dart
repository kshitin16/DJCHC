/// The narrow interfaces every other `services/*.dart` file depends on.
///
/// This file deliberately imports NOTHING from `package:amplify_*`,
/// `package:firebase_*` or `package:http`. It is the seam that makes the five
/// contract services unit-testable with fakes while keeping the real Amplify
/// import confined to `amplify_gateway.dart` and the real Firebase Messaging
/// import to `push_gateway.dart` (project.md Mandated, team.md Q12).
library;

import 'package:flutter/foundation.dart';

/// Which AppSync authorization mode a single call uses.
///
/// The per-call rule (code-generation-plan.md rule 3, derived from
/// `amplify/data/resource.ts`):
///
/// | Operation(s) | Mode |
/// |---|---|
/// | `listPosts`, `listDocuments`, `getDocumentDownloadUrl` | [identityPool] when signed out, [userPool] when signed in |
/// | every Contract 9 operation | always [identityPool] (guest identity, FR7.8) |
/// | everything else | [userPool] |
enum AuthMode {
  /// Cognito User Pool JWT — the schema's `defaultAuthorizationMode`.
  userPool,

  /// Cognito Identity Pool (IAM) credentials, guest or authenticated.
  identityPool,
}

/// A failure returned by an AppSync call: either a GraphQL `errors` entry or a
/// transport/parse failure.
///
/// [message] is always safe to show a user — for a GraphQL error it is the
/// server's own first error message (each backend Unit writes those as
/// plain language), and for a transport failure it is this app's own copy.
/// Never contains a suggestion's text, a donation amount, an email or a push
/// token (project.md Mandated on personal data).
class ApiException implements Exception {
  const ApiException(this.message, {this.isTransport = false});

  /// A transport/parse failure rather than a server refusal.
  const ApiException.transport(String message)
    : this(message, isTransport: true);

  final String message;
  final bool isTransport;

  @override
  String toString() => 'ApiException: $message';
}

/// The AppSync data plane. One implementation wraps Amplify
/// (`AmplifyGateway`); tests use `FakeApiGateway`.
abstract interface class ApiGateway {
  /// Runs a GraphQL query document and returns the value of the single
  /// top-level field under `data`.
  ///
  /// Throws [ApiException] on a GraphQL `errors` payload, a transport failure,
  /// or a response whose shape does not match the document.
  Future<Object?> query({
    required String document,
    required String field,
    required AuthMode authMode,
    Map<String, dynamic>? variables,
  });

  /// Runs a GraphQL mutation document. Same contract as [query].
  Future<Object?> mutate({
    required String document,
    required String field,
    required AuthMode authMode,
    Map<String, dynamic>? variables,
  });
}

/// The resolved Cognito session (Contract 1's `sub`/`email`, Contract 2's
/// `cognito:groups`, plus the Identity Pool id Contract 9 is scoped by).
@immutable
class SessionInfo {
  const SessionInfo({
    required this.isSignedIn,
    required this.groups,
    this.sub,
    this.email,
    this.identityId,
  });

  /// A signed-out session that has no guest identity resolved yet.
  static const SessionInfo signedOut = SessionInfo(
    isSignedIn: false,
    groups: <String>[],
  );

  final bool isSignedIn;

  /// The Google identity's Cognito `sub` claim; `null` when signed out.
  final String? sub;

  /// The user's email from the ID token; `null` when signed out.
  final String? email;

  /// The `cognito:groups` claim (Contract 2). Empty when signed out.
  final List<String> groups;

  /// The Cognito Identity Pool id — present for a guest too, and the value
  /// Contract 9 scopes reminders by. Note it CHANGES on sign-in/out
  /// (code-generation-plan.md rule 4).
  final String? identityId;

  /// Contract 2: admin iff `cognito:groups` contains `Admin`.
  ///
  /// This is a UX convenience only — AppSync's `allow.group('Admin')` is the
  /// layer that actually enforces admin access (NFR-AUTHZ.2).
  bool get isAdmin => groups.contains(adminGroup);

  /// The Cognito group name auth-unit declares (`amplify/auth/resource.ts`).
  static const String adminGroup = 'Admin';

  @override
  bool operator ==(Object other) =>
      other is SessionInfo &&
      other.isSignedIn == isSignedIn &&
      other.sub == sub &&
      other.email == email &&
      other.identityId == identityId &&
      listEquals(other.groups, groups);

  @override
  int get hashCode =>
      Object.hash(isSignedIn, sub, email, identityId, Object.hashAll(groups));
}

/// A change in sign-in state, surfaced from Amplify's Hub.
enum AuthEvent { signedIn, signedOut, sessionExpired }

/// Something went wrong establishing or clearing a session. [cancelled] marks
/// the user backing out of the hosted UI, which is not an error to report.
class AuthGatewayException implements Exception {
  const AuthGatewayException(this.message, {this.cancelled = false});

  final String message;
  final bool cancelled;

  @override
  String toString() => 'AuthGatewayException: $message';
}

/// Amplify Auth, narrowed to what this app does with it.
abstract interface class AuthGateway {
  /// Reads the current session. Serves from Amplify's local, platform-secure
  /// store without a network round trip when the tokens are still valid
  /// (performance-design.md's blocking-path budget).
  Future<SessionInfo> fetchSession();

  /// Runs the Cognito hosted-UI Google federation flow (Contract 1).
  ///
  /// Returns `true` on success and `false` when the user cancelled; throws
  /// [AuthGatewayException] on a real failure.
  Future<bool> signInWithGoogle();

  /// Clears the local session. Throws [AuthGatewayException] on failure.
  Future<void> signOut();

  /// Sign-in-state changes. Never closed for the app's lifetime.
  Stream<AuthEvent> get events;
}

/// The device's push-notification channel (FCM), narrowed to Contract 9's
/// needs. `FirebasePushGateway` is the only implementation that imports
/// `firebase_messaging`.
abstract interface class PushGateway {
  /// Asks the OS for notification permission. Returns whether it was granted.
  /// Safe to call repeatedly — the OS only prompts once.
  Future<bool> requestPermission();

  /// The current FCM registration token, or `null` when unavailable (no
  /// permission, no Firebase project configured, or a transient failure).
  Future<String?> getToken();

  /// Fires when FCM rotates the token, so the device re-registers.
  Stream<String> get onTokenRefresh;

  /// `IOS` or `ANDROID` — the literal Contract 9's `DevicePlatform` expects.
  String get platform;
}

/// A tiny key/value store for non-sensitive UI preferences.
///
/// Used for the language override ONLY. security-design.md is explicit that
/// this is a plain, non-sensitive string; no token, email or other personal
/// data is ever written here (Amplify Auth owns credential storage).
abstract interface class PreferencesStore {
  Future<String?> getString(String key);
  Future<void> setString(String key, String value);
  Future<void> remove(String key);
}
