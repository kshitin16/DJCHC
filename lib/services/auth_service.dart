/// Contract 1 (identity) and Contract 2 (admin group) — the app's view of
/// Amplify Auth.
///
/// Realizes: FR1.1 (Google sign-in), FR1.2/FR1.3 (admin status and screen
/// gating inputs), BR1.1, BR1.2.
///
/// Every authorization decision the app makes from [SessionInfo.isAdmin] is a
/// UX convenience only; AppSync's `allow.group('Admin')` is the enforcing
/// layer (NFR-AUTHZ.2).
library;

import 'gateways.dart';

/// Why a sign-in or sign-out attempt did not complete.
enum AuthFailureKind {
  /// The user backed out of the hosted UI. Not an error; shown as nothing more
  /// than "Sign-in was cancelled."
  cancelled,

  /// Anything else: an OAuth round-trip failure, a network failure, a Cognito
  /// rejection.
  failed,
}

/// A sign-in/sign-out failure with copy that is safe to render.
///
/// [message] is this app's own plain-language text — never Cognito's or
/// Google's raw OAuth error string (functional-spec.md Screen 2: "no raw OAuth
/// error text").
class AuthFailure implements Exception {
  const AuthFailure(this.kind, this.message);

  final AuthFailureKind kind;
  final String message;

  bool get isCancelled => kind == AuthFailureKind.cancelled;

  @override
  String toString() => 'AuthFailure(${kind.name}): $message';
}

/// Plain-language copy for each failure. Kept here (not in the l10n table)
/// because a service must be usable without a `BuildContext`; screens render
/// these strings directly.
class AuthService {
  AuthService(this._auth);

  final AuthGateway _auth;

  /// The current session, or [SessionInfo.signedOut] if it cannot be read.
  ///
  /// A failure here is not surfaced as an error: an unreadable session is
  /// indistinguishable from being signed out from the user's point of view, and
  /// every gated screen redirects to Sign In anyway.
  Future<SessionInfo> currentSession() async {
    try {
      return await _auth.fetchSession();
    } on AuthGatewayException {
      return SessionInfo.signedOut;
    }
  }

  /// Runs the Google federation flow (Contract 1).
  ///
  /// Throws [AuthFailure] with [AuthFailureKind.cancelled] when the user backed
  /// out, and [AuthFailureKind.failed] for a real failure.
  Future<SessionInfo> signInWithGoogle() async {
    bool completed;
    try {
      completed = await _auth.signInWithGoogle();
    } on AuthGatewayException catch (e) {
      throw AuthFailure(
        e.cancelled ? AuthFailureKind.cancelled : AuthFailureKind.failed,
        e.cancelled ? cancelledMessage : signInFailedMessage,
      );
    }
    if (!completed) {
      throw const AuthFailure(AuthFailureKind.cancelled, cancelledMessage);
    }
    return currentSession();
  }

  /// Clears the session. Throws [AuthFailure] on failure so Account can show
  /// an inline error and offer a retry (functional-spec.md Screen 5).
  Future<void> signOut() async {
    try {
      await _auth.signOut();
    } on AuthGatewayException {
      throw const AuthFailure(AuthFailureKind.failed, signOutFailedMessage);
    }
  }

  /// Contract 2: admin iff `cognito:groups` contains `Admin`.
  bool isAdmin(List<String> groups) => groups.contains(SessionInfo.adminGroup);

  /// Sign-in-state changes from Amplify's Hub, for `AuthState` to listen to.
  Stream<AuthEvent> get events => _auth.events;

  static const String cancelledMessage = 'Sign-in was cancelled.';
  static const String signInFailedMessage =
      'Could not sign in right now. Please check your connection and try again.';
  static const String signOutFailedMessage =
      'Could not sign out right now. Please try again.';
}
