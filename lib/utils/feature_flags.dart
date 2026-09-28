/// Compile-time feature flags.
///
/// Screens 8-11 (Donate, My Donations, PDF Library, Admin PDF Library) are BUILT
/// but hidden until:
///   - donations: donation-unit's payment-aggregator account exists and FR5.4's
///     tax-exemption precondition clears;
///   - pdf library: the builder chooses to surface it.
///
/// Both default to off and are overridable at build time without a code change:
///
/// ```sh
/// flutter build apk --dart-define=DONATIONS_ENABLED=true
/// flutter build apk --dart-define=PDF_LIBRARY_ENABLED=true
/// ```
///
/// `const` + `String.fromEnvironment` means a flag that is off is tree-shaken
/// out of the release binary rather than merely hidden at runtime.
library;

/// Whether Donate and My Donations (Screens 8-9) are reachable.
const bool donationsEnabled = bool.fromEnvironment('DONATIONS_ENABLED');

/// Whether the PDF Library and its admin screen (Screens 10-11) are reachable.
const bool pdfLibraryEnabled = bool.fromEnvironment('PDF_LIBRARY_ENABLED');

/// The flag values as the running build sees them, so a widget test can assert
/// on nav contents without reaching for the constants directly.
class FeatureFlags {
  const FeatureFlags({required this.donations, required this.pdfLibrary});

  /// The compile-time values.
  static const FeatureFlags current = FeatureFlags(
    donations: donationsEnabled,
    pdfLibrary: pdfLibraryEnabled,
  );

  /// Everything off — the first release's shipping configuration.
  static const FeatureFlags allOff = FeatureFlags(
    donations: false,
    pdfLibrary: false,
  );

  /// Everything on — the later release, and what the flagged-screen widget
  /// tests exercise.
  static const FeatureFlags allOn = FeatureFlags(
    donations: true,
    pdfLibrary: true,
  );

  final bool donations;
  final bool pdfLibrary;

  /// How many bottom-navigation tabs this configuration shows: 4 in the first
  /// release (Feed | Calendar | Suggest | Account), 6 with both flags on.
  int get navTabCount => 4 + (donations ? 1 : 0) + (pdfLibrary ? 1 : 0);
}
