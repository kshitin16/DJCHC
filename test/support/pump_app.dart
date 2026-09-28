/// Widget-test helpers (plan Step 2.3).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/l10n/app_strings.dart';
import 'package:sarovar_jinalaya/services/auth_service.dart';
import 'package:sarovar_jinalaya/state/auth_state.dart';
import 'package:sarovar_jinalaya/state/localization_controller.dart';

import 'fake_gateways.dart';
import 'fixtures.dart';

/// A `LocalizationController` in [language], backed by an in-memory store.
LocalizationController stringsFor([String language = AppLanguages.english]) =>
    LocalizationController(
      FakePreferencesStore(),
      deviceLanguageCode: language,
    );

/// An `AuthState` already resolved to the requested sign-in/admin shape.
///
/// Returns the gateway too, so a test can emit Hub events; close it in a tear-down.
Future<({AuthState state, FakeAuthGateway gateway})> resolvedAuthState({
  bool signedIn = false,
  bool admin = false,
}) async {
  final gateway = FakeAuthGateway(
    session: aSession(signedIn: signedIn, admin: admin),
  );
  final state = AuthState(AuthService(gateway));
  await state.refresh();
  return (state: state, gateway: gateway);
}

/// Pumps [child] inside a `MaterialApp` with the given [language]'s strings.
///
/// The widget under test receives its own services and notifiers by constructor
/// injection, so this wrapper supplies only what `MaterialApp` itself needs. The
/// `ListenableBuilder` means a language change inside the test re-renders the
/// subtree, exactly as `SarovarJinalayaApp` does in production.
Future<void> pumpApp(
  WidgetTester tester,
  Widget child, {
  String language = AppLanguages.english,
  LocalizationController? strings,
  WidgetBuilder? builder,
}) async {
  final controller = strings ?? stringsFor(language);
  await tester.pumpWidget(
    ListenableBuilder(
      listenable: controller,
      builder: (context, _) => MaterialApp(
        locale: Locale(controller.languageCode),
        // A `builder` reconstructs the screen on every language change, exactly
        // as `SarovarJinalayaApp` does in production — a pre-built `child` is the
        // same widget instance each time, so Flutter would skip its rebuild and a
        // language switch would not be visible. Tests that switch language pass
        // `builder`; the rest pass `child`.
        home: builder == null ? child : Builder(builder: builder),
      ),
    ),
  );
  // One extra pump so an `initState` service call that resolves on a microtask
  // has settled out of its Loading state.
  await tester.pump();
}

/// Pumps, then lets every pending microtask and animation finish. Preferred when
/// a screen chains several awaits (Calendar's entry sequence) or opens a dialog.
Future<void> pumpAppAndSettle(
  WidgetTester tester,
  Widget child, {
  String language = AppLanguages.english,
  LocalizationController? strings,
  WidgetBuilder? builder,
}) async {
  await pumpApp(
    tester,
    child,
    language: language,
    strings: strings,
    builder: builder,
  );
  await tester.pumpAndSettle();
}
