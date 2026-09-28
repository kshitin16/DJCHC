/// Root-level language state (FR4.1).
///
/// Workflow (functional-spec.md "Language Selection & Localization"):
///   1. On launch, resolve the device locale: Hindi -> Hindi, anything else ->
///      English.
///   2. A manual override from the Account screen wins, and is persisted locally
///      via [PreferencesStore] — a device preference, never a Contract field and
///      never synced across devices.
///   3. A key missing from the active table falls back to English; `t()` never
///      returns a raw key.
library;

import 'package:flutter/foundation.dart';

import '../l10n/app_strings.dart';
import '../services/gateways.dart';

class LocalizationController extends ChangeNotifier {
  /// [deviceLanguageCode] is the device locale's language code (e.g. `hi`,
  /// `hi_IN`, `en_GB`); anything unsupported resolves to English.
  LocalizationController(this._preferences, {String? deviceLanguageCode})
    : _languageCode = _resolveDeviceLanguage(deviceLanguageCode);

  final PreferencesStore _preferences;
  String _languageCode;

  /// The preferences key the manual override is stored under. Non-sensitive
  /// (security-design.md) — nothing token-like is ever written here.
  static const String overrideKey = 'language_override';

  /// The active language code, always one of [AppLanguages.supported].
  String get languageCode => _languageCode;

  bool get isHindi => _languageCode == AppLanguages.hindi;

  /// Loads a stored manual override, if there is one. Called once at startup,
  /// after the device-locale default is already in place, so the app is never
  /// blocked on a preferences read.
  Future<void> loadOverride() async {
    final stored = await _preferences.getString(overrideKey);
    if (stored == null || !AppLanguages.isSupported(stored)) return;
    if (stored == _languageCode) return;
    _languageCode = stored;
    notifyListeners();
  }

  /// Sets the language from the Account screen's toggle and persists it.
  ///
  /// The change applies immediately; if persistence fails the language still
  /// switches for this session (see `SharedPreferencesStore`).
  Future<void> setLanguage(String code) async {
    if (!AppLanguages.isSupported(code) || code == _languageCode) return;
    _languageCode = code;
    notifyListeners();
    await _preferences.setString(overrideKey, code);
  }

  /// Toggles between the two supported languages.
  Future<void> toggle() => setLanguage(
    _languageCode == AppLanguages.hindi
        ? AppLanguages.english
        : AppLanguages.hindi,
  );

  /// Looks up [key] in the active language, falling back to English and then to
  /// a humanised form of the key's last segment.
  ///
  /// It NEVER returns [key] itself: a raw dotted key on screen is a visible bug,
  /// whereas a humanised English-ish word is merely an untranslated label.
  String t(String key) {
    final active = AppStrings.tableFor(_languageCode)[key];
    if (active != null && active.isNotEmpty) return active;
    final english = AppStrings.en[key];
    if (english != null && english.isNotEmpty) return english;
    return _humanise(key);
  }

  /// `calendar.cancelReminder` -> `Cancel reminder`;
  /// `reminderStatus.SCHEDULED` -> `Scheduled`.
  static String _humanise(String key) {
    final segment = key.split('.').last;
    if (segment.isEmpty) return '';
    if (segment.toUpperCase() == segment) {
      // A SCREAMING_SNAKE enum literal.
      final words = segment.split('_').where((w) => w.isNotEmpty).toList();
      return words.map((w) => w[0] + w.substring(1).toLowerCase()).join(' ');
    }
    // camelCase -> spaced words, first letter capitalised.
    final spaced = segment.replaceAllMapped(
      RegExp('([a-z0-9])([A-Z])'),
      (m) => '${m[1]} ${m[2]!.toLowerCase()}',
    );
    return spaced[0].toUpperCase() + spaced.substring(1);
  }

  static String _resolveDeviceLanguage(String? deviceLanguageCode) {
    final code = deviceLanguageCode?.toLowerCase();
    if (code == null) return AppLanguages.defaultLanguage;
    // `hi`, `hi_IN`, `hi-IN` all resolve to Hindi.
    final base = code.split(RegExp('[-_]')).first;
    return AppLanguages.isSupported(base) ? base : AppLanguages.defaultLanguage;
  }
}
