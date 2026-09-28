/// Root-level sign-in state (frontend-components.md "App-Level State").
///
/// Plain `ChangeNotifier` — team.md Q10: no Provider, Riverpod or Bloc. Built
/// once at the app root and passed down by constructor injection.
///
/// Everything this notifier exposes is a UX convenience. [isAdmin] hides an
/// Admin nav entry; it grants nothing. AppSync's `allow.group('Admin')` is the
/// layer that actually enforces admin access (NFR-AUTHZ.2), and every admin
/// operation is refused server-side regardless of what this flag says.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../services/auth_service.dart';
import '../services/gateways.dart';

class AuthState extends ChangeNotifier {
  AuthState(this._authService) {
    // A sign-in/sign-out that happens anywhere (including the hosted UI
    // returning through the custom URL scheme) re-resolves the session.
    _events = _authService.events.listen((_) => refresh());
  }

  final AuthService _authService;
  late final StreamSubscription<AuthEvent> _events;

  SessionInfo _session = SessionInfo.signedOut;

  /// The last resolved session.
  SessionInfo get session => _session;

  bool get isSignedIn => _session.isSignedIn;

  /// Contract 1's `sub` claim, or `null` when signed out.
  String? get sub => _session.sub;

  /// Contract 1's `email` claim, or `null` when signed out. Never logged.
  String? get email => _session.email;

  /// Contract 2: `cognito:groups` contains `Admin`. A UX gate only.
  bool get isAdmin => _session.isAdmin;

  /// Whether the blocking startup read has completed. Screens show their
  /// loading state until it has.
  bool get isResolved => _resolved;
  bool _resolved = false;

  /// Re-reads the session. On the blocking startup path this serves from
  /// Amplify's local store with no network round trip (performance-design.md).
  Future<void> refresh() async {
    final next = await _authService.currentSession();
    _resolved = true;
    // Notify even when the session is unchanged on the FIRST resolution, so a
    // screen waiting on `isResolved` is released.
    if (next == _session) {
      notifyListeners();
      return;
    }
    _session = next;
    notifyListeners();
  }

  /// Runs Google sign-in and adopts the resulting session.
  ///
  /// Rethrows [AuthFailure] so the Sign In screen can render cancelled and
  /// failed differently.
  Future<void> signIn() async {
    final next = await _authService.signInWithGoogle();
    _session = next;
    _resolved = true;
    notifyListeners();
  }

  /// Signs out and clears the identity. Rethrows [AuthFailure] so Account can
  /// show an inline error and keep the user signed in until it succeeds.
  Future<void> signOut() async {
    await _authService.signOut();
    _session = SessionInfo.signedOut;
    notifyListeners();
  }

  @override
  void dispose() {
    _events.cancel();
    super.dispose();
  }
}
