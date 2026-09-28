/// The ONE file that imports Amplify's data and auth plugins.
///
/// project.md Mandated / team.md Q12: only `services/` may import
/// `package:amplify_*`, and within `services/` this file is the single place the
/// data and auth SDKs appear. Every other service depends on the `ApiGateway` /
/// `AuthGateway` interfaces in `gateways.dart`, which is what makes them
/// unit-testable with fakes.
///
/// Nothing here is unit-tested: it is a thin adapter over an SDK that cannot run
/// under `flutter test` (no platform channels, no credentials). It is exercised
/// by `integration_test/app_test.dart` against `ampx sandbox` on a device.
library;

import 'dart:async';
import 'dart:convert';

// `ApiException` is hidden from both Amplify imports: this app has its own
// `ApiException` in `gateways.dart`, which is the type every service and
// screen catches. Amplify's is never allowed to escape this file.
import 'package:amplify_api/amplify_api.dart' hide ApiException;
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:amplify_flutter/amplify_flutter.dart' hide ApiException;
import 'package:flutter/foundation.dart';

import 'gateways.dart';

/// Amplify-backed [ApiGateway] + [AuthGateway].
class AmplifyGateway implements ApiGateway, AuthGateway {
  AmplifyGateway();

  final StreamController<AuthEvent> _events =
      StreamController<AuthEvent>.broadcast();
  StreamSubscription<AuthHubEvent>? _hubSubscription;
  bool _configured = false;

  /// Whether [configure] has already run. `Amplify.configure` throws if called
  /// twice, so `app_bootstrap.dart` guards on this.
  bool get isConfigured => _configured;

  /// Adds the Auth and API plugins and configures Amplify from the generated
  /// outputs JSON (`lib/amplify_outputs.dart`).
  ///
  /// Runs on the blocking startup path (performance-design.md) — it does no
  /// network I/O of its own.
  Future<void> configure(String amplifyConfig) async {
    if (_configured) return;
    await Amplify.addPlugins([AmplifyAuthCognito(), AmplifyAPI()]);
    await Amplify.configure(amplifyConfig);
    _configured = true;
    _hubSubscription = Amplify.Hub.listen(HubChannel.Auth, (
      AuthHubEvent event,
    ) {
      final mapped = switch (event.type) {
        AuthHubEventType.signedIn => AuthEvent.signedIn,
        AuthHubEventType.signedOut => AuthEvent.signedOut,
        AuthHubEventType.sessionExpired => AuthEvent.sessionExpired,
        AuthHubEventType.userDeleted => AuthEvent.signedOut,
      };
      if (!_events.isClosed) _events.add(mapped);
    });
  }

  /// Releases the Hub subscription and the event stream.
  Future<void> dispose() async {
    await _hubSubscription?.cancel();
    await _events.close();
  }

  // -------------------------------------------------------------------------
  // ApiGateway
  // -------------------------------------------------------------------------

  @override
  Future<Object?> query({
    required String document,
    required String field,
    required AuthMode authMode,
    Map<String, dynamic>? variables,
  }) => _run(
    document: document,
    field: field,
    authMode: authMode,
    variables: variables,
    isMutation: false,
  );

  @override
  Future<Object?> mutate({
    required String document,
    required String field,
    required AuthMode authMode,
    Map<String, dynamic>? variables,
  }) => _run(
    document: document,
    field: field,
    authMode: authMode,
    variables: variables,
    isMutation: true,
  );

  Future<Object?> _run({
    required String document,
    required String field,
    required AuthMode authMode,
    required Map<String, dynamic>? variables,
    required bool isMutation,
  }) async {
    final request = GraphQLRequest<String>(
      document: document,
      variables: variables ?? const <String, dynamic>{},
      authorizationMode: switch (authMode) {
        AuthMode.userPool => APIAuthorizationType.userPools,
        AuthMode.identityPool => APIAuthorizationType.iam,
      },
    );

    GraphQLResponse<String> response;
    try {
      final operation = isMutation
          ? Amplify.API.mutate(request: request)
          : Amplify.API.query(request: request);
      response = await operation.response;
    } on Object catch (e) {
      // Transport, TLS, DNS, plugin-not-configured. Never include `e` in the
      // user-facing message: an SDK string can carry request details.
      debugPrint('AmplifyGateway: $field transport failure (${e.runtimeType})');
      throw const ApiException.transport(networkMessage);
    }

    if (response.errors.isNotEmpty) {
      // The server's own first error message. Each backend Unit writes these as
      // plain language for exactly this purpose.
      final first = response.errors.first.message;
      throw ApiException(first.isEmpty ? serverRefusedMessage : first);
    }

    final body = response.data;
    if (body == null || body.isEmpty) {
      throw const ApiException.transport(emptyResponseMessage);
    }

    Object? decoded;
    try {
      decoded = jsonDecode(body);
    } on FormatException {
      throw const ApiException.transport(emptyResponseMessage);
    }
    if (decoded is! Map<String, dynamic> || !decoded.containsKey(field)) {
      throw const ApiException.transport(emptyResponseMessage);
    }
    return decoded[field];
  }

  // -------------------------------------------------------------------------
  // AuthGateway
  // -------------------------------------------------------------------------

  @override
  Future<SessionInfo> fetchSession() async {
    try {
      final session =
          await Amplify.Auth.fetchAuthSession() as CognitoAuthSession;
      final identityId = session.identityIdResult.valueOrNull;
      final tokens = session.userPoolTokensResult.valueOrNull;
      if (!session.isSignedIn || tokens == null) {
        return SessionInfo(
          isSignedIn: false,
          groups: const [],
          identityId: identityId,
        );
      }
      final claims = tokens.idToken.claims.toJson();
      return SessionInfo(
        isSignedIn: true,
        sub: claims['sub'] as String?,
        email: claims['email'] as String?,
        groups: _groupsFrom(claims['cognito:groups']),
        identityId: identityId,
      );
    } on Object catch (e) {
      debugPrint('AmplifyGateway: fetchSession failed (${e.runtimeType})');
      throw const AuthGatewayException('Could not read the current session.');
    }
  }

  /// Contract 2's `cognito:groups` claim. Cognito omits it entirely for a user
  /// in no group, and it arrives as a JSON list.
  static List<String> _groupsFrom(Object? claim) {
    if (claim is List) {
      return claim.whereType<String>().toList(growable: false);
    }
    if (claim is String && claim.isNotEmpty) return [claim];
    return const [];
  }

  @override
  Future<bool> signInWithGoogle() async {
    try {
      final result = await Amplify.Auth.signInWithWebUI(
        provider: AuthProvider.google,
      );
      return result.isSignedIn;
    } on UserCancelledException {
      return false;
    } on Object catch (e) {
      // Never surface the raw OAuth/Cognito text (functional-spec.md Screen 2).
      debugPrint('AmplifyGateway: signInWithWebUI failed (${e.runtimeType})');
      throw const AuthGatewayException('Sign-in did not complete.');
    }
  }

  @override
  Future<void> signOut() async {
    final result = await Amplify.Auth.signOut();
    if (result is CognitoFailedSignOut) {
      debugPrint('AmplifyGateway: signOut failed');
      throw const AuthGatewayException('Could not sign out.');
    }
  }

  @override
  Stream<AuthEvent> get events => _events.stream;

  static const String networkMessage =
      'Could not reach the server. Please check your connection and try again.';
  static const String serverRefusedMessage = 'The server refused that request.';
  static const String emptyResponseMessage =
      'The server sent a response this version of the app could not read. '
      'Please try again, or update the app if this keeps happening.';
}
