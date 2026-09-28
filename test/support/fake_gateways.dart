/// Hand-written fakes for the `services/` layer's injected boundaries.
///
/// unit-test-instructions.md: **fakes, not mocking frameworks** — no `mockito`,
/// no `mocktail`. Each fake records what it was called with so a test can assert
/// on the document, the variables and the auth mode, and each can be scripted to
/// return a value or throw.
///
/// No test ever imports `package:amplify_*` or `package:firebase_*`.
library;

import 'dart:async';

import 'package:sarovar_jinalaya/services/gateways.dart';

/// One recorded call to [FakeApiGateway].
class RecordedCall {
  RecordedCall({
    required this.document,
    required this.field,
    required this.authMode,
    required this.variables,
    required this.isMutation,
  });

  final String document;
  final String field;
  final AuthMode authMode;
  final Map<String, dynamic> variables;
  final bool isMutation;

  @override
  String toString() =>
      '${isMutation ? 'mutation' : 'query'} $field '
      'authMode=${authMode.name} variables=$variables';
}

/// An [ApiGateway] that answers from a per-field script and records every call.
class FakeApiGateway implements ApiGateway {
  /// `field` -> the value to return as `data[field]`.
  final Map<String, Object?> responses = {};

  /// `field` -> an exception to throw instead of answering.
  final Map<String, Object> failures = {};

  /// Every call, in order.
  final List<RecordedCall> calls = [];

  /// The most recent call. Throws when nothing has been called, so a test that
  /// asserts on a call that never happened fails loudly rather than passing.
  RecordedCall get lastCall {
    if (calls.isEmpty) {
      throw StateError('FakeApiGateway: no call was made');
    }
    return calls.last;
  }

  /// The single recorded call to [field]. Throws when there is not exactly one.
  RecordedCall callTo(String field) {
    final matching = calls.where((c) => c.field == field).toList();
    if (matching.length != 1) {
      throw StateError(
        'FakeApiGateway: expected exactly one call to "$field", '
        'got ${matching.length} (all calls: $calls)',
      );
    }
    return matching.single;
  }

  /// How many times [field] was called.
  int countOf(String field) => calls.where((c) => c.field == field).length;

  /// Scripts a successful answer.
  void stub(String field, Object? data) => responses[field] = data;

  /// Scripts a server refusal: an [ApiException] carrying the server's message.
  void stubRefusal(String field, String message) =>
      failures[field] = ApiException(message);

  /// Scripts a transport failure.
  void stubTransportFailure(String field, [String message = 'offline']) =>
      failures[field] = ApiException.transport(message);

  @override
  Future<Object?> query({
    required String document,
    required String field,
    required AuthMode authMode,
    Map<String, dynamic>? variables,
  }) => _answer(document, field, authMode, variables, isMutation: false);

  @override
  Future<Object?> mutate({
    required String document,
    required String field,
    required AuthMode authMode,
    Map<String, dynamic>? variables,
  }) => _answer(document, field, authMode, variables, isMutation: true);

  Future<Object?> _answer(
    String document,
    String field,
    AuthMode authMode,
    Map<String, dynamic>? variables, {
    required bool isMutation,
  }) async {
    calls.add(
      RecordedCall(
        document: document,
        field: field,
        authMode: authMode,
        variables: variables ?? const {},
        isMutation: isMutation,
      ),
    );
    final failure = failures[field];
    if (failure != null) throw failure;
    if (!responses.containsKey(field)) {
      throw StateError(
        'FakeApiGateway: no response scripted for "$field" '
        '(scripted: ${responses.keys.toList()})',
      );
    }
    return responses[field];
  }
}

/// An [AuthGateway] with a scriptable session, sign-in outcome and event stream.
class FakeAuthGateway implements AuthGateway {
  FakeAuthGateway({SessionInfo? session})
    : _session = session ?? SessionInfo.signedOut;

  SessionInfo _session;

  /// Set to throw from [fetchSession].
  Object? fetchSessionFailure;

  /// `false` makes [signInWithGoogle] report a user cancellation.
  bool signInCompletes = true;

  /// Set to throw from [signInWithGoogle].
  Object? signInFailure;

  /// Set to throw from [signOut].
  Object? signOutFailure;

  /// The session [fetchSession] returns once sign-in has succeeded. Defaults to
  /// a signed-in, non-admin session.
  SessionInfo? sessionAfterSignIn;

  int fetchSessionCount = 0;
  int signInCount = 0;
  int signOutCount = 0;

  final StreamController<AuthEvent> _events =
      StreamController<AuthEvent>.broadcast();

  /// Replaces the session the gateway reports.
  void setSession(SessionInfo session) => _session = session;

  /// Pushes a Hub event to listeners.
  void emit(AuthEvent event) => _events.add(event);

  Future<void> close() => _events.close();

  @override
  Future<SessionInfo> fetchSession() async {
    fetchSessionCount++;
    final failure = fetchSessionFailure;
    if (failure != null) throw failure;
    return _session;
  }

  @override
  Future<bool> signInWithGoogle() async {
    signInCount++;
    final failure = signInFailure;
    if (failure != null) throw failure;
    if (!signInCompletes) return false;
    _session =
        sessionAfterSignIn ??
        const SessionInfo(
          isSignedIn: true,
          sub: 'user-sub-1',
          email: 'devotee@example.test',
          groups: <String>[],
          identityId: 'ap-south-1:auth-identity-1',
        );
    return true;
  }

  @override
  Future<void> signOut() async {
    signOutCount++;
    final failure = signOutFailure;
    if (failure != null) throw failure;
    _session = SessionInfo.signedOut;
  }

  @override
  Stream<AuthEvent> get events => _events.stream;
}

/// A [PushGateway] with scriptable permission, token and refresh stream.
class FakePushGateway implements PushGateway {
  FakePushGateway({
    this.permissionGranted = true,
    this.token = 'fcm-token-abc',
    this.platform = 'ANDROID',
  });

  bool permissionGranted;
  String? token;

  @override
  String platform;

  int requestPermissionCount = 0;
  int getTokenCount = 0;

  final StreamController<String> _refresh =
      StreamController<String>.broadcast();

  /// Simulates FCM rotating the token.
  void rotateToken(String newToken) {
    token = newToken;
    _refresh.add(newToken);
  }

  Future<void> close() => _refresh.close();

  @override
  Future<bool> requestPermission() async {
    requestPermissionCount++;
    return permissionGranted;
  }

  @override
  Future<String?> getToken() async {
    getTokenCount++;
    return token;
  }

  @override
  Stream<String> get onTokenRefresh => _refresh.stream;
}

/// An in-memory [PreferencesStore].
class FakePreferencesStore implements PreferencesStore {
  FakePreferencesStore([Map<String, String>? initial]) : values = {...?initial};

  final Map<String, String> values;
  int writeCount = 0;

  @override
  Future<String?> getString(String key) async => values[key];

  @override
  Future<void> setString(String key, String value) async {
    writeCount++;
    values[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    values.remove(key);
  }
}
