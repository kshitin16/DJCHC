/// `shared_preferences`-backed [PreferencesStore] — the language override only.
///
/// security-design.md: the language override is a plain, non-sensitive UI
/// preference, so standard platform shared-preferences is appropriate and no
/// encryption design is needed. Amplify Auth owns credential storage (Keychain /
/// Keystore-backed) and nothing token-like is ever written here.
///
/// Not unit-tested: `shared_preferences` needs a platform channel. The language
/// controller is tested against an in-memory `FakePreferencesStore`.
library;

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'gateways.dart';

class SharedPreferencesStore implements PreferencesStore {
  @override
  Future<String?> getString(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      return prefs.getString(key);
    } on Object catch (e) {
      // A read failure means "no override stored" — the app falls back to the
      // device locale rather than failing to start.
      debugPrint('SharedPreferencesStore: read failed (${e.runtimeType})');
      return null;
    }
  }

  @override
  Future<void> setString(String key, String value) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, value);
    } on Object catch (e) {
      // The language change still applies for this session; only persistence is
      // lost, which is not worth interrupting the user for.
      debugPrint('SharedPreferencesStore: write failed (${e.runtimeType})');
    }
  }

  @override
  Future<void> remove(String key) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(key);
    } on Object catch (e) {
      debugPrint('SharedPreferencesStore: remove failed (${e.runtimeType})');
    }
  }
}
