/// The bottom navigation bar (frontend-components.md "Shared Widgets").
///
/// 4 tabs in the first release (`Feed | Calendar | Suggest | Account`), growing
/// to 6 (`Feed | Calendar | Suggest | Donate | Library | Account`) once the
/// Donate and PDF Library flags are turned on. Exceeding the usual 5-tab
/// guidance is a known, deliberate deferral: restructuring under a "More" entry
/// is left until that later release actually ships.
library;

import 'package:flutter/material.dart';

import '../l10n/app_strings.dart';
import '../state/localization_controller.dart';
import '../utils/feature_flags.dart';

/// The tabs the shell can show, in display order.
enum AppTab {
  feed('nav.feed', Icons.dynamic_feed_outlined, Icons.dynamic_feed),
  calendar('nav.calendar', Icons.calendar_month_outlined, Icons.calendar_month),
  suggest('nav.suggest', Icons.lightbulb_outline, Icons.lightbulb),
  donate(
    'nav.donate',
    Icons.volunteer_activism_outlined,
    Icons.volunteer_activism,
  ),
  library('nav.library', Icons.menu_book_outlined, Icons.menu_book),
  account('nav.account', Icons.person_outline, Icons.person);

  const AppTab(this.labelKey, this.icon, this.selectedIcon);

  final String labelKey;
  final IconData icon;
  final IconData selectedIcon;

  /// The tabs visible under [flags]. The flagged tabs sit between Suggest and
  /// Account so Account stays the rightmost entry in both configurations.
  static List<AppTab> visibleUnder(FeatureFlags flags) => [
    feed,
    calendar,
    suggest,
    if (flags.donations) donate,
    if (flags.pdfLibrary) library,
    account,
  ];
}

class BottomNavBar extends StatelessWidget {
  const BottomNavBar({
    required this.tabs,
    required this.currentTab,
    required this.onSelected,
    required this.strings,
    super.key,
  });

  final List<AppTab> tabs;
  final AppTab currentTab;
  final ValueChanged<AppTab> onSelected;
  final LocalizationController strings;

  /// The key for a tab's destination, e.g. `nav.tab.feed`.
  static Key keyFor(AppTab tab) => ValueKey('nav.tab.${tab.name}');

  @override
  Widget build(BuildContext context) {
    // A tab that is not visible (a flagged route reached directly) must not
    // index out of range — fall back to highlighting Feed.
    final selectedIndex = tabs.indexOf(currentTab);
    return NavigationBar(
      key: const ValueKey('nav.bar'),
      selectedIndex: selectedIndex < 0 ? 0 : selectedIndex,
      onDestinationSelected: (index) => onSelected(tabs[index]),
      destinations: [
        for (final tab in tabs)
          NavigationDestination(
            key: keyFor(tab),
            icon: Icon(tab.icon),
            selectedIcon: Icon(tab.selectedIcon),
            label: strings.t(tab.labelKey),
          ),
      ],
    );
  }
}

/// The two-language toggle on the Account screen (FR4.1, Q2).
class LanguageToggle extends StatelessWidget {
  const LanguageToggle({required this.strings, super.key});

  final LocalizationController strings;

  static const Key englishKey = ValueKey('account.language.en');
  static const Key hindiKey = ValueKey('account.language.hi');

  @override
  Widget build(BuildContext context) => SegmentedButton<String>(
    key: const ValueKey('account.languageToggle'),
    segments: const [
      ButtonSegment(
        value: AppLanguages.english,
        label: Text('English'),
        icon: Icon(Icons.abc, key: englishKey),
      ),
      ButtonSegment(
        value: AppLanguages.hindi,
        label: Text('हिन्दी'),
        icon: Icon(Icons.translate, key: hindiKey),
      ),
    ],
    selected: {strings.languageCode},
    onSelectionChanged: (selection) => strings.setLanguage(selection.first),
  );
}

/// The app-wide "event reminders on/off" switch (BR7.7: affects future
/// auto-creation only, never existing reminders).
class RemindersToggle extends StatelessWidget {
  const RemindersToggle({
    required this.enabled,
    required this.onChanged,
    required this.label,
    this.subtitle,
    super.key,
  });

  final bool enabled;

  /// Null while a change is in flight, which disables the control.
  final ValueChanged<bool>? onChanged;
  final String label;
  final String? subtitle;

  static const Key switchKey = ValueKey('reminders.toggle');

  @override
  Widget build(BuildContext context) => SwitchListTile(
    key: switchKey,
    value: enabled,
    onChanged: onChanged,
    title: Text(label),
    subtitle: subtitle == null ? null : Text(subtitle!),
  );
}
