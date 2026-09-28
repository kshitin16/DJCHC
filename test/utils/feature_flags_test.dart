/// `feature_flags` tests (plan Step 8.4).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/utils/feature_flags.dart';

void main() {
  test('both flags default to off in an ordinary build', () {
    // The first release ships with Screens 8-11 built but unreachable: donations
    // wait on the aggregator account, the library on the builder's choice.
    expect(donationsEnabled, isFalse);
    expect(pdfLibraryEnabled, isFalse);
    expect(FeatureFlags.current.donations, isFalse);
    expect(FeatureFlags.current.pdfLibrary, isFalse);
    expect(FeatureFlags.current.donations, FeatureFlags.allOff.donations);
    expect(FeatureFlags.current.pdfLibrary, FeatureFlags.allOff.pdfLibrary);
  });

  test(
    'the nav tab count follows the flags: 4 in the first release, 6 with both',
    () {
      expect(FeatureFlags.allOff.navTabCount, 4);
      expect(FeatureFlags.allOn.navTabCount, 6);
      expect(
        const FeatureFlags(donations: true, pdfLibrary: false).navTabCount,
        5,
      );
      expect(
        const FeatureFlags(donations: false, pdfLibrary: true).navTabCount,
        5,
      );
      expect(FeatureFlags.current.navTabCount, 4);
    },
  );
}
