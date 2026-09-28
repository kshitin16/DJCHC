/// `LocalizationController` tests (plan Step 8.2) — FR4.1.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/l10n/app_strings.dart';
import 'package:sarovar_jinalaya/state/localization_controller.dart';

import '../support/fake_gateways.dart';

void main() {
  LocalizationController controllerFor(
    String? deviceLanguage, {
    Map<String, String>? stored,
  }) => LocalizationController(
    FakePreferencesStore(stored),
    deviceLanguageCode: deviceLanguage,
  );

  test('a Hindi device locale resolves to Hindi, in every common form', () {
    for (final code in const ['hi', 'hi_IN', 'hi-IN', 'HI']) {
      expect(
        controllerFor(code).languageCode,
        AppLanguages.hindi,
        reason: 'device locale "$code"',
      );
    }
    expect(controllerFor('hi').isHindi, isTrue);
    expect(controllerFor('hi').t('nav.feed'), 'फ़ीड');
  });

  test('any other device locale defaults to English', () {
    for (final code in const ['en', 'en_GB', 'gu', 'mr_IN', 'fr', '', null]) {
      expect(
        controllerFor(code).languageCode,
        AppLanguages.english,
        reason: 'device locale "$code"',
      );
    }
    expect(controllerFor('gu_IN').t('nav.feed'), 'Feed');
  });

  test('a stored override wins over the device locale once loaded', () async {
    final controller = controllerFor(
      'en',
      stored: {LocalizationController.overrideKey: AppLanguages.hindi},
    );
    // The device-locale default is in place immediately — startup is not blocked
    // on the preferences read.
    expect(controller.languageCode, AppLanguages.english);

    await controller.loadOverride();

    expect(controller.languageCode, AppLanguages.hindi);
    expect(controller.t('nav.account'), 'खाता');
  });

  test('an absent or unrecognised stored override is ignored', () async {
    final none = controllerFor('hi');
    await none.loadOverride();
    expect(none.languageCode, AppLanguages.hindi);

    final junk = controllerFor(
      'en',
      stored: {LocalizationController.overrideKey: 'kl'},
    );
    await junk.loadOverride();
    expect(junk.languageCode, AppLanguages.english);
  });

  test(
    'setLanguage applies immediately, persists, and notifies once',
    () async {
      final store = FakePreferencesStore();
      final controller = LocalizationController(
        store,
        deviceLanguageCode: 'en',
      );
      var notifications = 0;
      controller.addListener(() => notifications++);

      await controller.setLanguage(AppLanguages.hindi);

      expect(controller.languageCode, AppLanguages.hindi);
      expect(notifications, 1);
      expect(
        store.values[LocalizationController.overrideKey],
        AppLanguages.hindi,
      );

      // Setting the same language again is a no-op: no notification, no write.
      await controller.setLanguage(AppLanguages.hindi);
      expect(notifications, 1);
      expect(store.writeCount, 1);

      // An unsupported code is rejected rather than stored.
      await controller.setLanguage('kl');
      expect(controller.languageCode, AppLanguages.hindi);
      expect(notifications, 1);

      // toggle() flips back, and persists that too.
      await controller.toggle();
      expect(controller.languageCode, AppLanguages.english);
      expect(notifications, 2);
      expect(
        store.values[LocalizationController.overrideKey],
        AppLanguages.english,
      );
    },
  );

  test('a key missing from Hindi falls back to the English string', () {
    final hindi = controllerFor('hi');

    // Present in English, absent from Hindi.
    expect(AppStrings.hi.containsKey('donationStatus.UNKNOWN'), isFalse);
    expect(AppStrings.en.containsKey('donationStatus.UNKNOWN'), isTrue);
    expect(
      hindi.t('donationStatus.UNKNOWN'),
      AppStrings.en['donationStatus.UNKNOWN'],
    );

    // A key present in both returns the Hindi one, not the English fallback.
    expect(hindi.t('common.retry'), 'पुनः प्रयास करें');
    expect(hindi.t('common.retry'), isNot(AppStrings.en['common.retry']));
  });

  test('t() never returns a raw key, even for a key in no table at all', () {
    for (final controller in [controllerFor('en'), controllerFor('hi')]) {
      for (final key in const [
        'totally.missing.key',
        'calendar.someNewControl',
        'reminderStatus.BRAND_NEW_STATUS',
        'orphan',
      ]) {
        final value = controller.t(key);
        expect(value, isNot(key), reason: 'raw key leaked for "$key"');
        expect(
          value,
          isNot(contains('.')),
          reason: 'dotted key leaked for "$key"',
        );
        expect(value, isNotEmpty);
      }
      // The humanised forms are readable, not mangled.
      expect(controller.t('calendar.someNewControl'), 'Some new control');
      expect(
        controller.t('reminderStatus.BRAND_NEW_STATUS'),
        'Brand New Status',
      );
    }
  });

  test('every Hindi key exists in English, so nothing is Hindi-only', () {
    // The English table is the fallback of record; a Hindi-only key would have
    // no fallback and would reach `_humanise` for an English user.
    final hindiOnly = AppStrings.hi.keys
        .where((k) => !AppStrings.en.containsKey(k))
        .toList();
    expect(hindiOnly, isEmpty, reason: 'keys missing from English: $hindiOnly');
    // And no table carries an empty string, which would silently fall through.
    expect(AppStrings.en.values.where((v) => v.isEmpty), isEmpty);
    expect(AppStrings.hi.values.where((v) => v.isEmpty), isEmpty);
  });
}
